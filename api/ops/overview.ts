import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireOps } from '../_lib/opsAuth';
import { createLogger } from '../_lib/logger';
import { opsOverview } from '../_lib/opsData';

const log = createLogger('ops');

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireOps(req, res)) return;
  try {
    res.status(200).json({ success: true, data: await opsOverview() });
  } catch (e) {
    log.error(`overview failed:`, (e as Error).message);
    res.status(500).json({ success: false, error: 'erro interno' });
  }
}
