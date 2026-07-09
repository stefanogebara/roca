import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireOps } from '../_lib/opsAuth';
import { createLogger } from '../_lib/logger';
import { opsStylePacks, opsActivatePack } from '../_lib/opsData';

const log = createLogger('ops');

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireOps(req, res)) return;
  try {
    if (req.method === 'POST') {
      const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) ?? {};
      const version = Number((body as { version?: number }).version);
      if (!Number.isInteger(version)) {
        res.status(400).json({ success: false, error: 'version required' });
        return;
      }
      const ok = await opsActivatePack(version);
      res.status(ok ? 200 : 500).json({ success: ok, data: { active: version } });
      return;
    }
    const withBody = req.query.body === '1';
    res.status(200).json({ success: true, data: await opsStylePacks(withBody) });
  } catch (e) {
    log.error(`voice failed:`, (e as Error).message);
    res.status(500).json({ success: false, error: 'erro interno' });
  }
}
