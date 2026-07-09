/**
 * Founder daily-digest cron. Computes the last 24h rollup, stores it, delivers
 * to the founder via WhatsApp when FOUNDER_WHATSAPP is set, and always returns
 * the digest as JSON (so it's viewable on demand with the CRON_SECRET).
 *
 * Auth: CRON_SECRET bearer. Cost: 1 invocation/day.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { computeDigestStats, formatDigest, scrubDigestForPersistence } from '../_lib/digest';
import { getDb } from '../_lib/db';
import { TwilioAdapter } from '../_lib/transport/twilio';
import { createLogger } from '../_lib/logger';

const log = createLogger('digest-cron');

function authorized(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers['authorization'] === `Bearer ${secret}`;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (!authorized(req)) {
    res.status(401).json({ success: false, error: 'unauthorized' });
    return;
  }

  // Window: last 24h by default; overridable with ?hours= for ad-hoc pulls.
  const hours = Math.min(720, Math.max(1, parseInt(String(req.query.hours ?? '24'), 10) || 24));
  const until = new Date();
  const since = new Date(until.getTime() - hours * 3_600_000);

  const stats = await computeDigestStats(since.toISOString(), until.toISOString());
  const text = formatDigest(stats);

  // Persist the run (best-effort) — scrubbed: no verbatim farmer text outlives
  // the messages table, so "apaga meus dados" stays complete. The delivered
  // WhatsApp digest below keeps the samples.
  try {
    const db = getDb();
    const scrubbed = scrubDigestForPersistence(stats, text);
    const { error } = await db.from('digests').insert({
      ran_at: until.toISOString(),
      period_start: since.toISOString(),
      period_end: until.toISOString(),
      stats: scrubbed.stats,
      text: scrubbed.text,
    });
    if (error) log.error('digest insert failed:', error.message);
  } catch (e) {
    log.error('digest persistence failed:', (e as Error).message);
  }

  // Deliver to the founder via WhatsApp when configured (best-effort).
  let delivered = false;
  const founder = process.env.FOUNDER_WHATSAPP;
  if (founder) {
    try {
      await new TwilioAdapter().send({ to: founder, text });
      delivered = true;
    } catch (e) {
      log.error('digest delivery failed:', (e as Error).message);
    }
  }

  res.status(200).json({ success: true, data: { delivered, stats, text } });
}
