/**
 * Founder daily digest — turns the message log into validation signal.
 *
 * Stevi records every conversation but nothing surfaced it. This computes a
 * 24h rollup (volume, intent mix, media kinds, referrals, failures, sample
 * questions) so the founder can SEE what farmers actually ask — and where Stevi
 * fell short. `formatDigest` is pure (unit-tested); `computeDigestStats` queries.
 */

import { getDb } from './db';
import { cohortStats, partnerScorecard, type CohortStats, type PartnerScore, type CohortMsg } from './cohort';
import { createLogger } from './logger';

const log = createLogger('digest');

export interface DigestStats {
  since: string;
  until: string;
  inboundTotal: number;
  uniqueUsers: number;
  newUsers: number;
  byIntent: Record<string, number>;
  byKind: Record<string, number>;
  referrals: number;
  /** Open leads still to contact (status novo/legacy 'new'), any day — the CRM
   * backlog. Shown even on a quiet day so it never goes unworked. Optional so
   * existing DigestStats fixtures stay valid. */
  openLeads?: number;
  /** Active farmers this period who already knew Stevi (created before the
   * window) — the daily retention signal. */
  returningUsers: number;
  failures: number;
  sampleQuestions: string[];
  /** Weekly cohort block (WAU trend, D7 retention, habit-by-intent). Optional
   * so existing fixtures stay valid. */
  cohort?: CohortStats;
  /** Lead-pipeline rollup — the partner side of the business. */
  partners?: PartnerScore;
}

// Outbound replies that mean Stevi couldn't help — real gaps worth the founder's
// attention (distinct from the receituário handoff, which is by design).
const FAILURE_RE =
  /não consegui|nao consegui|tive um problema|não deu pra|nao deu pra|não entendi|nao entendi/i;

interface MsgRow {
  direction: 'in' | 'out';
  kind: string | null;
  intent: string | null;
  raw: string | null;
  user_id: string | null;
  created_at: string;
}

/** Query the message log for a period and roll it up. */
export async function computeDigestStats(since: string, until: string): Promise<DigestStats> {
  const db = getDb();

  const { data: msgs, error } = await db
    .from('messages')
    .select('direction, kind, intent, raw, user_id, created_at')
    .gte('created_at', since)
    .lt('created_at', until)
    .order('created_at', { ascending: false });
  if (error) log.error('digest messages query failed:', error.message);
  const rows = (msgs ?? []) as MsgRow[];

  const inbound = rows.filter((r) => r.direction === 'in');
  const outbound = rows.filter((r) => r.direction === 'out');

  const uniqueUsers = new Set(inbound.map((r) => r.user_id).filter(Boolean)).size;

  const byIntent: Record<string, number> = {};
  for (const r of outbound) {
    const k = r.intent || 'desconhecido';
    byIntent[k] = (byIntent[k] ?? 0) + 1;
  }

  const byKind: Record<string, number> = {};
  for (const r of inbound) {
    const k = r.kind || 'desconhecido';
    byKind[k] = (byKind[k] ?? 0) + 1;
  }

  // Failure = a couldn't-help reply, or a reply the farmer never received
  // (send exhausted its retries; pipeline records it as intent 'send_failed').
  const failures = outbound.filter(
    (r) => r.intent === 'send_failed' || (r.raw && FAILURE_RE.test(r.raw))
  ).length;

  const sampleQuestions = inbound
    .filter((r) => r.raw && r.raw.trim().length > 0)
    .slice(0, 6)
    .map((r) => (r.raw as string).replace(/\s+/g, ' ').slice(0, 90));

  // Returning = active this window AND created before it started.
  const activeIds = [...new Set(inbound.map((r) => r.user_id).filter(Boolean))] as string[];
  let returningUsers = 0;
  if (activeIds.length > 0) {
    const { count, error: retErr } = await db
      .from('users')
      .select('id', { count: 'exact', head: true })
      .in('id', activeIds)
      .lt('created_at', since);
    if (retErr) log.error('returning-users query failed:', retErr.message);
    returningUsers = count ?? 0;
  }

  // Weekly cohort inputs: 14 days of messages + 14 days of signups feed the
  // pure cohort math (WAU trend needs two weeks; the D7 cohort is the 7-14d
  // signup band). Bounded reads; at current volume these are tiny.
  const now = new Date(until);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const [
    { count: newUsers },
    { count: referrals },
    { count: openLeads },
    cohortMsgs,
    cohortUsers,
    leadRows,
  ] = await Promise.all([
    db
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since)
      .lt('created_at', until),
    db
      .from('referral_requests')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since)
      .lt('created_at', until),
    // Open backlog across all time: still 'novo' (or legacy 'new'/null).
    db
      .from('referral_requests')
      .select('id', { count: 'exact', head: true })
      .or('status.eq.novo,status.eq.new,status.is.null'),
    // Ordered newest-first: if a window ever exceeds the cap (or PostgREST's
    // server-side max-rows clamps below it), we lose the OLDEST rows — a
    // defined bias — instead of an arbitrary subset skewing WAU/D7 randomly.
    db
      .from('messages')
      .select('user_id, created_at, direction, intent')
      .gte('created_at', twoWeeksAgo)
      .lt('created_at', until)
      .order('created_at', { ascending: false })
      .limit(5000),
    db
      .from('users')
      .select('id, created_at, source')
      .gte('created_at', twoWeeksAgo)
      .order('created_at', { ascending: false })
      .limit(2000),
    db
      .from('referral_requests')
      .select('status, created_at')
      .order('created_at', { ascending: false })
      .limit(2000),
  ]);

  // Truncation detection: hitting the cap (ours or PostgREST's 1000 default)
  // means the cohort numbers describe a sample, not the population — say so.
  for (const [label, res, cap] of [
    ['messages', cohortMsgs, 5000],
    ['users', cohortUsers, 2000],
    ['referral_requests', leadRows, 2000],
  ] as const) {
    const n = res.data?.length ?? 0;
    if (n >= 1000 && (n >= cap || n === 1000)) {
      log.error(`cohort feed "${label}" hit a row cap (${n}) — weekly metrics may be truncated`);
    }
  }

  let cohort: CohortStats | undefined;
  let partners: PartnerScore | undefined;
  if (!cohortMsgs.error && !cohortUsers.error) {
    cohort = cohortStats(
      (cohortUsers.data ?? []) as Array<{ id: string; created_at: string; source: string | null }>,
      (cohortMsgs.data ?? []) as CohortMsg[],
      now
    );
  } else {
    log.error('cohort inputs query failed:', cohortMsgs.error?.message ?? cohortUsers.error?.message);
  }
  if (!leadRows.error) {
    partners = partnerScorecard(
      (leadRows.data ?? []) as Array<{ status: string | null; created_at: string }>,
      now
    );
  } else {
    log.error('partner scorecard query failed:', leadRows.error.message);
  }

  return {
    since,
    until,
    inboundTotal: inbound.length,
    uniqueUsers,
    newUsers: newUsers ?? 0,
    byIntent,
    byKind,
    referrals: referrals ?? 0,
    openLeads: openLeads ?? 0,
    returningUsers,
    failures,
    sampleQuestions,
    cohort,
    partners,
  };
}

function dm(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}

function topEntries(rec: Record<string, number>): string {
  const entries = Object.entries(rec).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return '—';
  return entries.map(([k, v]) => `${k} ${v}`).join(' · ');
}

/** Format the digest as a compact, WhatsApp-friendly PT-BR message. Pure. */
export function formatDigest(s: DigestStats): string {
  const lines: string[] = [];
  lines.push(`🌱 *Stevi — resumo do dia* (${dm(s.since)}→${dm(s.until)})`);
  lines.push('');
  lines.push(`👥 ${s.inboundTotal} mensagens de ${s.uniqueUsers} produtor(es) · ${s.newUsers} novo(s)`);
  // The CRM backlog nudge — shown even on a quiet day so leads never go stale.
  if ((s.openLeads ?? 0) > 0) {
    lines.push(`📋 Leads a contatar: ${s.openLeads} (veja no painel → Leads)`);
  }
  if (s.inboundTotal === 0) {
    lines.push('');
    lines.push('Nenhuma conversa no período. 🤙');
    return lines.join('\n');
  }
  lines.push(`🔁 Voltaram: ${s.returningUsers} de ${s.uniqueUsers} ativos já conheciam a Stevi`);
  lines.push(`🎯 Intenções: ${topEntries(s.byIntent)}`);
  lines.push(`📎 Tipos: ${topEntries(s.byKind)}`);
  if (s.cohort) {
    const c = s.cohort;
    const trend = c.wau > c.wauPrev ? '↑' : c.wau < c.wauPrev ? '↓' : '=';
    // The gate variable: vouched vs organic retention, shown as soon as any
    // vouched member exists in the cohort.
    const split =
      c.d7Vouched.size > 0
        ? ` — vouchados ${c.d7Vouched.retained}/${c.d7Vouched.size} · orgânicos ${c.d7Organic.retained}/${c.d7Organic.size}`
        : '';
    const d7 =
      c.d7.rate == null
        ? 'sem coorte ainda'
        : `${c.d7.retained}/${c.d7.size} (${Math.round(c.d7.rate * 100)}%)${split}`;
    lines.push(`📈 Semana: ${c.wau} ativos (${trend} de ${c.wauPrev}) · retenção D7: ${d7}`);
    if (c.newSources.length > 0) {
      lines.push(
        `🧭 Origem (novos 7d): ${c.newSources.slice(0, 5).map((x) => `${x.source} ${x.count}`).join(' · ')}`
      );
    }
    if (c.habits.length > 0) {
      const top = c.habits
        .slice(0, 4)
        .map((h) => `${h.intent} ${h.users}→${h.repeaters} voltaram`)
        .join(' · ');
      lines.push(`🔥 Hábito (7d): ${top}`);
    }
  }
  if (s.partners) {
    const p = s.partners;
    const close = p.closeRate == null ? '—' : `${Math.round(p.closeRate * 100)}%`;
    lines.push(`🤝 Leads: ${p.leads7d} na semana · ${p.open} a contatar · fechamento: ${close}`);
  }
  if (s.referrals > 0) lines.push(`🤝 Pedidos de agrônomo: ${s.referrals}`);
  lines.push(`${s.failures > 0 ? '⚠️' : '✅'} Falhas (não ajudou): ${s.failures}`);
  if (s.sampleQuestions.length > 0) {
    lines.push('');
    lines.push('💬 Amostras do que perguntaram:');
    for (const q of s.sampleQuestions) lines.push(`• ${q}`);
  }
  return lines.join('\n');
}

/**
 * Strip verbatim farmer text before PERSISTING a digest run. LGPD deletion
 * wipes the messages table, but persisted digests used to keep raw excerpts
 * forever (security review M4). The delivered WhatsApp digest still carries
 * the samples; only the stored copy is scrubbed. Pure — unit-tested.
 */
export function scrubDigestForPersistence(
  stats: DigestStats,
  text: string
): { stats: DigestStats; text: string } {
  const cut = text.indexOf('💬 Amostras');
  return {
    stats: { ...stats, sampleQuestions: [] },
    text: cut === -1 ? text : text.slice(0, cut).trimEnd(),
  };
}
