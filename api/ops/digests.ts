import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireOps } from '../_lib/opsAuth';
import { opsDigests } from '../_lib/opsData';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireOps(req, res)) return;
  try {
    res.status(200).json({ success: true, data: await opsDigests() });
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message });
  }
}
