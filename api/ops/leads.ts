import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireOps } from '../_lib/opsAuth';
import { opsLeads, setLeadStatus, isLeadStatus } from '../_lib/opsLeads';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireOps(req, res)) return;
  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {};
      const { id, status } = body as { id?: unknown; status?: unknown };
      if (typeof id !== 'string' || !isLeadStatus(status)) {
        res.status(400).json({ success: false, error: 'id and a valid status are required' });
        return;
      }
      const ok = await setLeadStatus(id, status);
      res.status(ok ? 200 : 500).json(ok ? { success: true } : { success: false, error: 'update failed' });
      return;
    }
    res.status(200).json({ success: true, data: await opsLeads() });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
}
