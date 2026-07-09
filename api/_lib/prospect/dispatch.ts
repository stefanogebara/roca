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
import { alertFounders } from '../alert';
import { createLogger } from '../logger';

const log = createLogger('prospect-dispatch');

const TEMPLATE_NAME = 'stevi_parceria_v1';
const TEMPLATE_LANG = 'pt_BR';
// Gentle spacing between individual sends in a batch (avoids a burst that spikes
// the block/report rate). Skipped in dryRun.
const PER_SEND_DELAY_MS = Math.round(BATCH_DELAY_MS / BATCH_SIZE);

export interface DispatchOptions {
  dryRun?: boolean;
  dailyCap?: number;
  /** Bypass the business-hours gate (manual ops trigger). Never bypasses opt-out/dedup/cap. */
  force?: boolean;
}

export interface DispatchReport {
  dryRun: boolean;
  skippedOutsideHours: boolean;
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
    return { dryRun, skippedOutsideHours: true, eligible: 0, planned: 0, sent: 0, failed: 0, recipients: [] };
  }

  const [optouts, ready, sentToday] = await Promise.all([
    loadOptouts(),
    loadReadyProspects(),
    countSentSince(brtDayStartIso(now)),
  ]);

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
    try {
      const { wamid } = await sendProspectTemplate(phone, TEMPLATE_NAME, TEMPLATE_LANG, [
        p.name.slice(0, 60),
      ]);
      await recordSend(p.id, { wamid, template: TEMPLATE_NAME });
      recipients.push({ id: p.id, name: p.name, phone, result: 'sent' });
      sent++;
    } catch (e) {
      await recordSendFailed(p.id);
      recipients.push({ id: p.id, name: p.name, phone, result: 'failed' });
      failed++;
      log.error(`dispatch send failed for ${p.id}:`, (e as Error).message);
    }
    if (batch.indexOf(p) < batch.length - 1) await sleep(PER_SEND_DELAY_MS);
  }

  if (failed > 0) {
    await alertFounders(`⚠️ Prospecção: ${failed} de ${batch.length} envio(s) falharam.`);
  }
  return { dryRun, skippedOutsideHours: false, eligible: eligible.length, planned: batch.length, sent, failed, recipients };
}
