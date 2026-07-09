import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireOps } from '../_lib/opsAuth';
import { createLogger } from '../_lib/logger';
import { opsConversations, opsThread } from '../_lib/opsData';

const log = createLogger('ops');

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireOps(req, res)) return;
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : null;
    if (userId) {
      res.status(200).json({ success: true, data: await opsThread(userId) });
      return;
    }
    res.status(200).json({ success: true, data: await opsConversations() });
  } catch (e) {
    log.error(`conversations failed:`, (e as Error).message);
    res.status(500).json({ success: false, error: 'erro interno' });
  }
}
