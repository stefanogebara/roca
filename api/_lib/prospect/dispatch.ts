/**
 * Prospect dispatch engine — the safe outbound loop. Every send is gated by the
 * P1 core: opt-out/dedup eligibility, the daily cap, and business hours. Supports
 * dryRun (plan only, no send) so the wiring can be exercised without touching the
 * number. Failures are recorded and alerted, never silent.
 */

import {
  eligibleToSend,
  planBatch,
  isBusinessHours,
  brtDayStartIso,
  DAILY_CAP_DEFAULT,
  BATCH_SIZE,
  BATCH_DELAY_MS,
} from './core';
import {
  loadReadyProspects,
  loadOptouts,
  countSentSince,
  recordSend,
  recordSendFailed,
} from './db';
import { sendProspectTemplate } from './send';
import { buildTemplateParams, renderTemplateText } from './personalize';
import { logProspectMessage } from './db';
import { alertFounders } from '../alert';
import { createLogger } from '../logger';

const log = createLogger('prospect-dispatch');

// Template selection is env-driven so approving the personalized v2 in
// WhatsApp Manager upgrades the copy without a deploy (see personalize.ts).
const TEMPLATE_NAME = process.env.PROSPECT_TEMPLATE_NAME || 'stevi_parceria_v1';
const TEMPLATE_PARAMS = Number(process.env.PROSPECT_TEMPLATE_PARAMS || '1');
const TEMPLATE_LANG = 'pt_BR';
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
  recipients: Array<{ id: string; name: string; phone: string; result: 'planned' | 'sent' | 'failed' }>;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function runDispatch(opts: DispatchOptions = {}): Promise<DispatchReport> {
  const dryRun = !!opts.dryRun;
  const now = new Date();

  if (!dryRun && !opts.force && !isBusinessHours(now)) {
    log.info('dispatch skipped — outside business hours');
    return { dryRun, skippedOutsideHours: true, aborted: false, eligible: 0, planned: 0, sent: 0, failed: 0, recipients: [] };
  }

  // Preconditions FAIL CLOSED: if opt-outs or the daily count can't be verified,
  // abort the whole run rather than risk over-sending / hitting an opted-out number.
  let optouts: Set<string>;
  let ready: Awaited<ReturnType<typeof loadReadyProspects>>;
  let sentToday: number;
  try {
    [optouts, ready, sentToday] = await Promise.all([
      loadOptouts(),
      loadReadyProspects(),
      countSentSince(brtDayStartIso(now)),
    ]);
  } catch (e) {
    const error = (e as Error).message;
    log.error('dispatch aborted — safety precondition unavailable:', error);
    if (!dryRun) await alertFounders(`⛔ Prospecção abortada: não deu pra verificar opt-outs/limite (${error.slice(0, 120)}). Nenhum envio feito.`);
    return { dryRun, skippedOutsideHours: false, aborted: true, error, eligible: 0, planned: 0, sent: 0, failed: 0, recipients: [] };
  }

  const eligible = ready.filter((p) => eligibleToSend(p, optouts));
  const batch = planBatch(eligible, { dailyCap: opts.dailyCap ?? DAILY_CAP_DEFAULT, sentToday });

  const recipients: DispatchReport['recipients'] = [];
  let sent = 0;
  let failed = 0;

  for (const p of batch) {
    const phone = p.phone as string; // eligibleToSend guarantees non-null
    if (dryRun) {
      recipients.push({ id: p.id, name: p.name, phone, result: 'planned' });
      continue;
    }
    let wamid: string;
    const params = buildTemplateParams(p, TEMPLATE_PARAMS);
    try {
      ({ wamid } = await sendProspectTemplate(phone, TEMPLATE_NAME, TEMPLATE_LANG, params));
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
      await recordSend(p.id, { wamid, template: TEMPLATE_NAME });
      recipients.push({ id: p.id, name: p.name, phone, result: 'sent' });
      sent++;
      // Thread completeness: the painel conversation view starts with the
      // template that actually went out. Best-effort — never fails the batch.
      await logProspectMessage(p.id, 'out', 'text', renderTemplateText(params)).catch(() => {});
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
  return { dryRun, skippedOutsideHours: false, aborted: false, eligible: eligible.length, planned: batch.length, sent, failed, recipients };
}
