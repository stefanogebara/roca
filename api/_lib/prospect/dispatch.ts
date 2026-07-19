/**
 * Prospect dispatch engine — the safe outbound loop. Every send is gated by the
 * P1 core: opt-out/dedup eligibility, the daily cap, and business hours. Supports
 * dryRun (plan only, no send) so the wiring can be exercised without touching the
 * number. Failures are recorded and alerted, never silent.
 */

import {
  eligibleToSend,
  planBatch,
  clampDailyCap,
  isBusinessHours,
  brtDayStartIso,
  BATCH_SIZE,
  BATCH_DELAY_MS,
} from './core';
import {
  loadReadyProspects,
  loadOptouts,
  countSentSince,
  claimProspectForSend,
  claimProspectForBump,
  recordSend,
  recordSendFailed,
} from './db';
import { sendProspectTemplate } from './send';
import {
  buildTemplateParams,
  renderTemplateText,
  buildBumpParams,
  renderBumpText,
  buildCoopParams,
  renderCoopText,
} from './personalize';
import { logProspectMessage, loadBumpDueProspects, recordBump } from './db';
import {
  gradeCap,
  loadSendHealth,
  envCapOverride,
  isDispatchLatched,
  recordDispatchPause,
  type CapGrade,
} from './health';

// Campaign kind gating: the current intro template pitches lead-generation,
// which reads as a competitive threat to coops/revendas (their business IS
// the receituário moment — red-team F3). Until the distribution-pitch
// template is approved, only right-fit kinds receive sends. Widen with
// PROSPECT_SEND_KINDS (csv of kinds, or 'all').
function kindAllowed(kind: string): boolean {
  // Coops/revendas unlocked 19/jul — their distribution template
  // (stevi_parceria_coop_v1) is APPROVED; they get THAT pitch, never lead-gen.
  const kinds = (process.env.PROSPECT_SEND_KINDS || 'agronomo,consultoria,cooperativa,revenda')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return kinds.includes('all') || kinds.includes(kind);
}
import { alertFounders } from '../alert';
import { V2_NAME, COOP_NAME, registryParamCount, templateShapeError } from './template';
import { createLogger } from '../logger';

const log = createLogger('prospect-dispatch');

// Intro template for agronomos/consultorias — env-overridable, default the
// personalized v2. Param COUNTS are derived from the template registry, never
// from an env var: PROSPECT_TEMPLATE_PARAMS drifting from the approved shape
// caused the Jul/13 outage (#132000 on every send → 0% delivery → latch).
const TEMPLATE_NAME = process.env.PROSPECT_TEMPLATE_NAME || V2_NAME;
const TEMPLATE_LANG = 'pt_BR';

/** Which template a prospect kind receives. Pure; exported for tests. */
export function templateForKind(kind: string | null): string {
  const k = (kind ?? '').toLowerCase();
  return k === 'cooperativa' || k === 'coop' || k === 'revenda' ? COOP_NAME : TEMPLATE_NAME;
}
// Gentle spacing between individual sends in a batch (avoids a burst that spikes
// the block/report rate). Skipped in dryRun.
const PER_SEND_DELAY_MS = Math.round(BATCH_DELAY_MS / BATCH_SIZE);
// Human-like pacing: uniform machine intervals look like a bot to Meta's
// quality systems and to anyone watching a phone; jitter ±40%.
const jitteredDelay = (): number =>
  Math.round(PER_SEND_DELAY_MS * (0.6 + Math.random() * 0.8));

export interface DispatchOptions {
  dryRun?: boolean;
  dailyCap?: number;
  /** Bypass the business-hours gate (manual ops trigger). Never bypasses opt-out/dedup/cap. */
  force?: boolean;
}

export interface DispatchReport {
  dryRun: boolean;
  skippedOutsideHours: boolean;
  /** True when a safety precondition (opt-outs/cap) couldn't be verified → no sends. */
  aborted: boolean;
  error?: string;
  eligible: number;
  planned: number;
  sent: number;
  failed: number;
  /** 'skipped' = another concurrent run claimed the row first (not a failure). */
  recipients: Array<{ id: string; name: string; phone: string; result: 'planned' | 'sent' | 'failed' | 'skipped' }>;
  /** Today's effective cap + how it was earned (graded ramp / manual). Absent
   * on aborts that happen before the cap is resolved. */
  cap?: number;
  capGrade?: string;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function runDispatch(opts: DispatchOptions = {}): Promise<DispatchReport> {
  const dryRun = !!opts.dryRun;
  const now = new Date();

  if (!dryRun && !opts.force && !isBusinessHours(now)) {
    log.info('dispatch skipped — outside business hours');
    return { dryRun, skippedOutsideHours: true, aborted: false, eligible: 0, planned: 0, sent: 0, failed: 0, recipients: [] };
  }

  // Golden rule (same as bumps): business-initiated sends need an APPROVED
  // template whose LIVE SHAPE matches the params we build. Meta can pause,
  // reject or re-approve an edited template at any time; without this
  // pre-flight every send in the batch throws (#132000 and friends) and each
  // prospect gets burned as send_status='failed'. Both templates the round can
  // use are checked. FAILS CLOSED when a status can't be verified.
  if (!dryRun) {
    let error: string | null = null;
    let badTemplate = TEMPLATE_NAME;
    try {
      for (const name of [TEMPLATE_NAME, COOP_NAME]) {
        const reason = await templateShapeError(name);
        if (reason) {
          badTemplate = name;
          error = reason;
          break;
        }
      }
    } catch (e) {
      error = `template_check_failed: ${(e as Error).message.slice(0, 80)}`;
    }
    if (error) {
      log.error('dispatch aborted —', error);
      await alertFounders(`⛔ Prospecção abortada: template "${badTemplate}" não passou na checagem (${error}). Nenhum envio feito.`);
      return { dryRun, skippedOutsideHours: false, aborted: true, error, eligible: 0, planned: 0, sent: 0, failed: 0, recipients: [] };
    }
  }

  // Preconditions FAIL CLOSED: if opt-outs, the daily count or the number's
  // health can't be verified, abort the whole run rather than risk
  // over-sending / hitting an opted-out number / ramping on blind data.
  let optouts: Set<string>;
  let ready: Awaited<ReturnType<typeof loadReadyProspects>>;
  let sentToday: number;
  let capInfo: CapGrade;
  try {
    const manual = opts.dailyCap ?? envCapOverride();
    const [o, r, s, healthRes, latched] = await Promise.all([
      loadOptouts(),
      loadReadyProspects(),
      countSentSince(brtDayStartIso(now)),
      manual == null ? loadSendHealth(now) : Promise.resolve(null),
      isDispatchLatched(now),
    ]);
    optouts = o;
    ready = r;
    sentToday = s;
    // The LATCH outranks everything, including manual overrides: two health
    // pauses inside 21 days means a human must decide (clear dispatch_pauses)
    // before another send leaves — oscillation is not a retry loop.
    if (latched) {
      const error = 'paused_latched (2 pausas de saúde em 21 dias — limpe dispatch_pauses para religar)';
      log.error('dispatch latched off:', error);
      if (!dryRun) {
        await alertFounders(
          '⛔ Prospecção TRAVADA: 2 pausas de saúde do número em 21 dias. Religar é decisão humana — investigue e limpe a tabela dispatch_pauses.'
        );
      }
      return { dryRun, skippedOutsideHours: false, aborted: true, error, eligible: 0, planned: 0, sent: 0, failed: 0, recipients: [], cap: 0, capGrade: 'latched' };
    }
    // The cap is EARNED: manual override wins, otherwise the number's trailing
    // health grades it (warming 20 → healthy ladder up to 60 → degraded 10 →
    // paused 0). See prospect/health.ts.
    capInfo =
      manual != null
        ? { cap: clampDailyCap(manual), grade: 'manual', reasons: [] }
        : gradeCap(healthRes!.health, healthRes!.lifetimeSends);
  } catch (e) {
    const error = (e as Error).message;
    log.error('dispatch aborted — safety precondition unavailable:', error);
    if (!dryRun) await alertFounders(`⛔ Prospecção abortada: não deu pra verificar opt-outs/limite/saúde (${error.slice(0, 120)}). Nenhum envio feito.`);
    return { dryRun, skippedOutsideHours: false, aborted: true, error, eligible: 0, planned: 0, sent: 0, failed: 0, recipients: [] };
  }

  if (capInfo.cap === 0) {
    // Two stop levers share the path: the health thermometer (page the
    // founders) and the manual PROSPECT_DAILY_CAP=0 emergency stop (the
    // founder pulled it — no page needed).
    const manualStop = capInfo.grade === 'manual';
    // A real (non-manual) pause is an EPISODE — two episodes in 21 days
    // engage the latch checked in the preconditions above.
    if (!dryRun && !manualStop) await recordDispatchPause(capInfo.reasons);
    const error = manualStop
      ? 'paused_by_override (PROSPECT_DAILY_CAP=0)'
      : `number_health_paused (${capInfo.reasons.join('; ')})`;
    log.error('dispatch paused:', error);
    if (!dryRun && !manualStop) {
      await alertFounders(
        `⛔ Prospecção PAUSADA pela saúde do número: ${capInfo.reasons.join('; ')}. Nenhum envio até os indicadores voltarem.`
      );
    }
    return { dryRun, skippedOutsideHours: false, aborted: true, error, eligible: 0, planned: 0, sent: 0, failed: 0, recipients: [], cap: 0, capGrade: capInfo.grade };
  }

  const eligible = ready.filter((p) => eligibleToSend(p, optouts) && kindAllowed(p.kind));
  const cap = capInfo.cap;
  const batch = planBatch(eligible, { dailyCap: cap, sentToday });

  const recipients: DispatchReport['recipients'] = [];
  let sent = 0;
  let failed = 0;

  for (const p of batch) {
    const phone = p.phone as string; // eligibleToSend guarantees non-null
    if (dryRun) {
      recipients.push({ id: p.id, name: p.name, phone, result: 'planned' });
      continue;
    }
    // Concurrent-safe cap recheck: claims stamp sent_at, so a fresh count sees
    // another overlapping run's claims too. Counting BEFORE claiming means a
    // cap stop never strands a row at 'sending'. Unverifiable count → stop
    // (fail closed), same posture as the preconditions.
    try {
      if ((await countSentSince(brtDayStartIso(new Date()))) >= cap) {
        log.info('daily cap reached mid-run — stopping the batch');
        break;
      }
    } catch (e) {
      log.error('mid-run cap recheck unavailable — stopping the batch:', (e as Error).message);
      break;
    }
    // Atomic claim — the row-level lock against a concurrent run (cron firing
    // while a founder presses "Disparar"). Losing the claim means the other
    // run owns this prospect: skip without pacing (nothing left our side).
    const claimed = await claimProspectForSend(p.id);
    if (!claimed) {
      recipients.push({ id: p.id, name: p.name, phone, result: 'skipped' });
      log.info(`dispatch skipped ${p.id} — claimed by a concurrent run`);
      continue;
    }
    let wamid: string;
    // Per-kind routing: coops/revendas get the distribution pitch, everyone
    // else the intro. Param count comes from the registry for THAT template.
    const tpl = templateForKind(p.kind);
    const params =
      tpl === COOP_NAME
        ? buildCoopParams(p)
        : buildTemplateParams(p, registryParamCount(tpl) ?? 3);
    try {
      ({ wamid } = await sendProspectTemplate(phone, tpl, TEMPLATE_LANG, params));
    } catch (e) {
      // Send itself failed → nothing went out; record + continue is safe.
      await recordSendFailed(p.id);
      recipients.push({ id: p.id, name: p.name, phone, result: 'failed' });
      failed++;
      log.error(`dispatch send failed for ${p.id}:`, (e as Error).message);
      if (batch.indexOf(p) < batch.length - 1) await sleep(jitteredDelay());
      continue;
    }

    // The message WENT OUT. If we can't record it, stop the batch: continuing
    // risks re-sending this one next run (it still looks unsent). Page ops with
    // the wamid to reconcile by hand.
    try {
      await recordSend(p.id, { wamid, template: tpl });
      recipients.push({ id: p.id, name: p.name, phone, result: 'sent' });
      sent++;
      // Thread completeness: the painel conversation view starts with the
      // template that actually went out. Best-effort — never fails the batch.
      const threadText = tpl === COOP_NAME ? renderCoopText(params) : renderTemplateText(params);
      await logProspectMessage(p.id, 'out', 'text', threadText).catch(() => {});
    } catch (e) {
      sent++; // it did send — count it, then abort to avoid a duplicate next run
      recipients.push({ id: p.id, name: p.name, phone, result: 'sent' });
      log.error(`recordSend failed after a live send for ${p.id}:`, (e as Error).message);
      await alertFounders(
        `⚠️ Prospecção: enviado pra ${p.name} (wamid ${wamid}) mas NÃO consegui gravar. Batch interrompido — confira o cadastro pra não reenviar.`
      );
      break;
    }
    if (batch.indexOf(p) < batch.length - 1) await sleep(jitteredDelay());
  }

  if (failed > 0) {
    await alertFounders(`⚠️ Prospecção: ${failed} de ${batch.length} envio(s) falharam.`);
  }
  return {
    dryRun,
    skippedOutsideHours: false,
    aborted: false,
    eligible: eligible.length,
    planned: batch.length,
    sent,
    failed,
    recipients,
    cap,
    capGrade: capInfo.grade,
  };
}

// ── D+3 bump (multi-touch cadence, Olímpia pattern) ─────────────────────────
// One follow-up for never-repliers, 3+ days after the intro. Golden rule: the
// touch only happens if its template is APPROVED at Meta — otherwise the run
// reports 'template_not_approved' and does nothing (no error, no send).

const BUMP_TEMPLATE = process.env.PROSPECT_BUMP_TEMPLATE_NAME || 'stevi_parceria_bump';
const BUMP_AFTER_DAYS = Number(process.env.PROSPECT_BUMP_AFTER_DAYS || '3');

export interface BumpReport {
  skipped: string | null; // reason when nothing ran (outside hours / template / cap)
  due: number;
  sent: number;
  failed: number;
}

export async function runBumpDispatch(opts: { dailyCap?: number } = {}): Promise<BumpReport> {
  const now = new Date();
  if (!isBusinessHours(now)) return { skipped: 'outside_hours', due: 0, sent: 0, failed: 0 };

  // Golden rule: approved template WITH the shape our params match, or no touch.
  try {
    const reason = await templateShapeError(BUMP_TEMPLATE);
    if (reason) return { skipped: reason, due: 0, sent: 0, failed: 0 };
  } catch (e) {
    return { skipped: `template_check_failed: ${(e as Error).message.slice(0, 80)}`, due: 0, sent: 0, failed: 0 };
  }

  // Same fail-closed preconditions as intros; bumps share the daily cap AND
  // the graded number-health ramp (the intro run in the same cron pass already
  // alerted if paused — bumps just skip quietly).
  let optouts: Set<string>;
  let due: Awaited<ReturnType<typeof loadBumpDueProspects>>;
  let sentToday: number;
  let capInfo: CapGrade;
  try {
    const manual = opts.dailyCap ?? envCapOverride();
    const [o, d, s, healthRes] = await Promise.all([
      loadOptouts(),
      loadBumpDueProspects(BUMP_AFTER_DAYS),
      countSentSince(brtDayStartIso(now)),
      manual == null ? loadSendHealth(now) : Promise.resolve(null),
    ]);
    optouts = o;
    due = d;
    sentToday = s;
    capInfo =
      manual != null
        ? { cap: clampDailyCap(manual), grade: 'manual', reasons: [] }
        : gradeCap(healthRes!.health, healthRes!.lifetimeSends);
  } catch (e) {
    log.error('bump dispatch aborted — safety precondition unavailable:', (e as Error).message);
    return { skipped: 'precondition_unavailable', due: 0, sent: 0, failed: 0 };
  }

  if (capInfo.cap === 0) {
    const reason =
      capInfo.grade === 'manual'
        ? 'paused_by_override (PROSPECT_DAILY_CAP=0)'
        : `number_health_paused (${capInfo.reasons.join('; ')})`;
    return { skipped: reason, due: 0, sent: 0, failed: 0 };
  }

  // Kind gating applies to bumps too — the bump template carries the same
  // lead-gen pitch that's wrong for coops/revendas.
  const eligible = due.filter((p) => p.phone && !optouts.has(p.phone) && kindAllowed(p.kind));
  const cap = capInfo.cap;
  const batch = planBatch(eligible, { dailyCap: cap, sentToday });
  if (!batch.length) return { skipped: eligible.length ? 'daily_cap_reached' : null, due: eligible.length, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  for (const p of batch) {
    // Same concurrent-safe cap recheck as intros (bumps share the daily cap).
    try {
      if ((await countSentSince(brtDayStartIso(new Date()))) >= cap) {
        log.info('daily cap reached mid-run — stopping bumps');
        break;
      }
    } catch (e) {
      log.error('mid-run cap recheck unavailable — stopping bumps:', (e as Error).message);
      break;
    }
    // Atomic claim (touches 1→2): only one overlapping run may bump this row.
    // If the send below then fails, touches stays 2 and the prospect is never
    // re-bumped — a missed follow-up is the safe failure direction here.
    const claimed = await claimProspectForBump(p.id);
    if (!claimed) {
      log.info(`bump skipped ${p.id} — claimed by a concurrent run`);
      continue;
    }
    const params = buildBumpParams(p);
    let wamid: string;
    try {
      ({ wamid } = await sendProspectTemplate(p.phone as string, BUMP_TEMPLATE, TEMPLATE_LANG, params));
    } catch (e) {
      failed++;
      log.error(`bump send failed for ${p.id}:`, (e as Error).message);
      if (batch.indexOf(p) < batch.length - 1) await sleep(jitteredDelay());
      continue;
    }
    // Sent but unrecorded = re-bump risk next run → stop the batch, page ops.
    try {
      await recordBump(p.id, { wamid, template: BUMP_TEMPLATE });
      sent++;
      await logProspectMessage(p.id, 'out', 'text', renderBumpText(params)).catch(() => {});
    } catch (e) {
      sent++;
      log.error(`recordBump failed after a live send for ${p.id}:`, (e as Error).message);
      await alertFounders(
        `⚠️ Prospecção: bump enviado pra ${p.name} (wamid ${wamid}) mas NÃO consegui gravar. Batch interrompido — confira pra não reenviar.`
      );
      break;
    }
    if (batch.indexOf(p) < batch.length - 1) await sleep(jitteredDelay());
  }
  if (failed > 0) await alertFounders(`⚠️ Prospecção (bump): ${failed} de ${batch.length} envio(s) falharam.`);
  return { skipped: null, due: eligible.length, sent, failed };
}
