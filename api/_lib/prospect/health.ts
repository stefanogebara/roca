/**
 * Number health — the graded cap ramp. The WhatsApp number is the business
 * asset; instead of a static daily cap, the cap is EARNED: healthy delivery
 * over real volume climbs a ladder (20 → 30 → 45 → 60), degradation drops to
 * a trickle, severe damage pauses dispatch and pages the founders. Trust in
 * numbers, hard floors in code.
 *
 * Also owns the monotonic send-status machine fed by Meta's status webhooks
 * (sent → delivered → read; replied is sticky; failed only from pre-delivery
 * states) and its DB application by wamid.
 */

import { getDb } from '../db';
import { alertFounders } from '../alert';
import { maskWa } from '../opsData';
import { createLogger } from '../logger';
import { DAILY_CAP_DEFAULT, DAILY_CAP_CEILING, clampDailyCap } from './core';

const log = createLogger('prospect-health');

// ── Send-status machine ──────────────────────────────────────────────────────

// Rank order of the lifecycle; only forward moves apply. 'replied' (set by an
// inbound reply) outranks everything a webhook can say. A NULL current status
// means the row was deliberately re-queued (resetProspectSend) — late
// callbacks for the old send must not resurrect it.
const RANK: Record<string, number> = { sending: 0, sent: 1, delivered: 2, read: 3, replied: 4 };

export type IncomingStatus = 'sent' | 'delivered' | 'read' | 'failed';

/** Next stored status for an incoming webhook status, or null to ignore. */
export function nextSendStatus(current: string | null, incoming: IncomingStatus): string | null {
  if (current == null || !(current in RANK)) return null; // reset row, or failed (terminal)
  if (incoming === 'failed') {
    // Only a message that never reached the phone can fail.
    return current === 'sending' || current === 'sent' ? 'failed' : null;
  }
  return RANK[incoming] > RANK[current] ? incoming : null;
}

/** States an incoming status may transition FROM (drives the atomic UPDATE).
 * DERIVED from nextSendStatus so the tested machine is the single authority —
 * the two cannot drift. */
function allowedFrom(incoming: IncomingStatus): string[] {
  return Object.keys(RANK).filter((s) => nextSendStatus(s, incoming) !== null);
}

export interface CloudStatusEvent {
  wamid: string;
  status: IncomingStatus;
  errorDetail: string | null;
}

/**
 * Apply Meta status callbacks to prospects by wamid. One atomic conditional
 * UPDATE per event — duplicates and out-of-order arrivals fall out naturally
 * (the WHERE matches nothing). Farmer-message wamids match no prospect row and
 * cost one no-op query. A transition INTO 'failed' pages the founders once
 * (the transition can only happen once).
 */
export async function applyProspectStatuses(
  events: CloudStatusEvent[]
): Promise<{ applied: number }> {
  const db = getDb();
  let applied = 0;
  for (const ev of events) {
    const { data, error } = await db
      .from('prospects')
      .update({ send_status: ev.status, updated_at: new Date().toISOString() })
      .eq('wamid', ev.wamid)
      .in('send_status', allowedFrom(ev.status))
      .select('id, name, phone');
    if (error) {
      log.error('status apply failed:', error.message);
      continue;
    }
    const row = (data ?? [])[0] as { id: string; name: string; phone: string | null } | undefined;
    if (!row) continue;
    applied++;
    if (ev.status === 'failed') {
      await alertFounders(
        `⚠️ Prospecção: envio pra ${row.name} (${maskWa(row.phone)}) FALHOU pós-aceite` +
          (ev.errorDetail ? ` — ${ev.errorDetail.slice(0, 140)}` : '') +
          '. Conta no termômetro do número.'
      );
    }
  }
  return { applied };
}

// ── Health aggregation + cap ladder ──────────────────────────────────────────

export const HEALTH = {
  windowDays: 7,
  /** Delivery usually lands in seconds; give stragglers this long before a
   * still-'sent' row counts as undelivered. */
  graceHours: 2,
  /** Sends from BEFORE the status webhooks went live can never progress past
   * 'sent' (Meta doesn't re-deliver old callbacks) — grading them would read
   * as 0% delivery and pause dispatch on phantom evidence. Only sends after
   * this instant count. Overridable via PROSPECT_HEALTH_SINCE. */
  trackingSinceIso: '2026-07-13T03:00:00Z',
  minWindowSends: 20,
  degradedBelowDelivered: 0.8,
  degradedAboveFail: 0.1,
  degradedAboveOptout: 0.08,
  pausedBelowDelivered: 0.5,
  pausedAboveFail: 0.25,
  pausedAboveOptout: 0.15,
  /** Lifetime-attempts thresholds for the healthy ladder. */
  ladder: [
    { minLifetime: 300, cap: DAILY_CAP_CEILING },
    { minLifetime: 150, cap: 45 },
    { minLifetime: 60, cap: 30 },
  ],
  degradedCap: 10,
} as const;

const DELIVERED_SET = new Set(['delivered', 'read', 'replied']);
// 'sending' (stranded claim: nothing left our side) is an ops issue, not a
// number-health signal — excluded from the delivery denominator.
const COUNTED_SET = new Set(['sent', 'delivered', 'read', 'replied', 'failed']);

export interface SendHealth {
  windowSends: number;
  delivered: number;
  failed: number;
  deliveredRate: number;
  failRate: number;
  optoutRate: number;
}

/** Pure rollup of the trailing window (sends older than the grace period and
 * newer than the status-tracking floor). */
export function computeHealth(
  sends: Array<{ sent_at: string | null; send_status: string | null }>,
  optoutsInWindow: number,
  now: Date,
  trackingSince: string = process.env.PROSPECT_HEALTH_SINCE || HEALTH.trackingSinceIso
): SendHealth {
  const graceCutoff = now.getTime() - HEALTH.graceHours * 3_600_000;
  const floor = new Date(trackingSince).getTime();
  const counted = sends.filter(
    (s) =>
      s.sent_at &&
      new Date(s.sent_at).getTime() < graceCutoff &&
      new Date(s.sent_at).getTime() >= floor &&
      s.send_status != null &&
      COUNTED_SET.has(s.send_status)
  );
  const delivered = counted.filter((s) => DELIVERED_SET.has(s.send_status as string)).length;
  const failed = counted.filter((s) => s.send_status === 'failed').length;
  const n = counted.length;
  return {
    windowSends: n,
    delivered,
    failed,
    deliveredRate: n ? delivered / n : 0,
    failRate: n ? failed / n : 0,
    optoutRate: n ? optoutsInWindow / n : 0,
  };
}

export interface CapGrade {
  cap: number;
  grade: 'manual' | 'warming' | 'healthy' | 'degraded' | 'paused';
  reasons: string[];
}

/**
 * The ladder. Pure — thresholds in HEALTH, floors absolute.
 *
 * Pause is a COOL-DOWN, not a latch: with sends stopped, the bad window ages
 * out within windowDays, the sample drops under minWindowSends and the grade
 * re-enters at 'warming' (base cap). That retry generates fresh evidence — if
 * the number is durably damaged it will re-pause on the next window. If you
 * see pause→warm→pause oscillation, that's Meta telling you something the
 * ramp can't fix: stop manually (PROSPECT_DAILY_CAP=0) and investigate.
 */
export function gradeCap(health: SendHealth, lifetimeSends: number): CapGrade {
  if (health.windowSends < HEALTH.minWindowSends) {
    return { cap: DAILY_CAP_DEFAULT, grade: 'warming', reasons: ['amostra pequena — cap base'] };
  }
  const reasons: string[] = [];
  if (health.deliveredRate < HEALTH.pausedBelowDelivered)
    reasons.push(`entrega ${(health.deliveredRate * 100).toFixed(0)}%`);
  if (health.failRate > HEALTH.pausedAboveFail)
    reasons.push(`falhas ${(health.failRate * 100).toFixed(0)}%`);
  if (health.optoutRate > HEALTH.pausedAboveOptout)
    reasons.push(`opt-outs ${(health.optoutRate * 100).toFixed(0)}%`);
  if (reasons.length) return { cap: 0, grade: 'paused', reasons };

  if (health.deliveredRate < HEALTH.degradedBelowDelivered)
    reasons.push(`entrega ${(health.deliveredRate * 100).toFixed(0)}%`);
  if (health.failRate > HEALTH.degradedAboveFail)
    reasons.push(`falhas ${(health.failRate * 100).toFixed(0)}%`);
  if (health.optoutRate > HEALTH.degradedAboveOptout)
    reasons.push(`opt-outs ${(health.optoutRate * 100).toFixed(0)}%`);
  if (reasons.length) return { cap: HEALTH.degradedCap, grade: 'degraded', reasons };

  for (const tier of HEALTH.ladder) {
    if (lifetimeSends >= tier.minLifetime) {
      return { cap: tier.cap, grade: 'healthy', reasons: [`${lifetimeSends} envios de vida`] };
    }
  }
  return { cap: DAILY_CAP_DEFAULT, grade: 'healthy', reasons: [`${lifetimeSends} envios de vida`] };
}

/**
 * Manual override: env wins over the grade (clamped to the ceiling).
 * ZERO IS VALID — it's the emergency stop (forces the paused path), and a
 * kill switch that silently no-ops on its most critical value is worse than
 * none. Unusable values (negative/NaN) are rejected LOUDLY, not silently.
 * NOTE: while set, the override bypasses the health thermometer entirely,
 * including the automatic pause — a deliberate founder lever, documented in
 * .env.example; don't leave it set long-term.
 */
export function envCapOverride(): number | null {
  const raw = process.env.PROSPECT_DAILY_CAP;
  if (!raw || !raw.trim()) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    log.error(`PROSPECT_DAILY_CAP="${raw}" is unusable — falling back to the graded cap`);
    return null;
  }
  return clampDailyCap(n);
}

/**
 * Load the health inputs. THROWS on error — the dispatch run must abort
 * (fail closed) rather than ramp on unverifiable data, same posture as
 * loadOptouts/countSentSince.
 */
export async function loadSendHealth(
  now = new Date()
): Promise<{ health: SendHealth; lifetimeSends: number }> {
  const db = getDb();
  const windowStart = new Date(now.getTime() - HEALTH.windowDays * 86_400_000).toISOString();
  const [sends, optouts, lifetime] = await Promise.all([
    db.from('prospects').select('sent_at, send_status').gte('sent_at', windowStart),
    db
      .from('prospect_optouts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', windowStart),
    db.from('prospects').select('id', { count: 'exact', head: true }).not('sent_at', 'is', null),
  ]);
  if (sends.error || optouts.error || lifetime.error || lifetime.count == null) {
    throw new Error(
      `loadSendHealth unavailable: ${sends.error?.message ?? optouts.error?.message ?? lifetime.error?.message ?? 'null count'}`
    );
  }
  return {
    health: computeHealth(
      (sends.data ?? []) as Array<{ sent_at: string | null; send_status: string | null }>,
      optouts.count ?? 0,
      now
    ),
    lifetimeSends: lifetime.count,
  };
}
