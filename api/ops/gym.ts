import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireOps } from '../_lib/opsAuth';
import { createLogger } from '../_lib/logger';
import { getDb } from '../_lib/db';
import { PERSONAS } from '../_lib/gym/personas';

/**
 * Ops Gym panel data: the seeded personas (from code) + stored A/B run history.
 * Runs themselves are CLI-triggered (npm run gym) because they make many LLM
 * calls; this endpoint is read-only.
 */
const log = createLogger('ops');

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireOps(req, res)) return;
  try {
    const db = getDb();
    const { data } = await db
      .from('gym_runs')
      .select('id, ran_at, champion, challenger, tally, recommended, reason, verdicts')
      .order('ran_at', { ascending: false })
      .limit(20);
    res.status(200).json({
      success: true,
      data: {
        personas: PERSONAS.map((p) => ({ key: p.key, label: p.label, crop: p.crop ?? null })),
        runs: data ?? [],
      },
    });
  } catch (e) {
    log.error(`gym failed:`, (e as Error).message);
    res.status(500).json({ success: false, error: 'erro interno' });
  }
}
