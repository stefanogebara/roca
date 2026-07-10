/**
 * Prospect dispatch cron — runs the outbound engine on a schedule so disparos
 * happen without a founder pressing the button. All safety rails live in
 * runDispatch itself (business hours BRT, 20/day cap, opt-outs, dedup,
 * ready-status only, jittered pacing); this wrapper only adds cron auth and
 * an audit response. Scheduled 3× on weekday business hours; each run sends
 * at most one batch (8), so the daily cap is reached gradually, not in bursts.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runDispatch, runBumpDispatch } from '../_lib/prospect/dispatch';
import { createLogger } from '../_lib/logger';

const log = createLogger('dispatch-cron');

function authorized(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers['authorization'] === `Bearer ${secret}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!authorized(req)) {
    res.status(401).json({ success: false, error: 'unauthorized' });
    return;
  }
  try {
    const report = await runDispatch({ dryRun: false });
    log.info(
      `dispatch cron: sent=${report.sent} failed=${report.failed} eligible=${report.eligible}` +
        (report.skippedOutsideHours ? ' (outside hours)' : '') +
        (report.aborted ? ' (ABORTED)' : '')
    );
    // D+3 bumps run after intros and share the daily cap (countSentSince sees
    // the intros just sent). Isolated: a bump problem never fails the cron.
    let bumps = null;
    try {
      bumps = await runBumpDispatch();
      if (bumps.sent > 0 || bumps.failed > 0) {
        log.info(`bump dispatch: sent=${bumps.sent} failed=${bumps.failed} due=${bumps.due}`);
      }
    } catch (e) {
      log.error('bump dispatch failed:', (e as Error).message);
    }
    res.status(200).json({ success: true, data: { ...report, bumps } });
  } catch (e) {
    log.error('dispatch cron failed:', (e as Error).message);
    res.status(500).json({ success: false, error: 'erro interno' });
  }
}
