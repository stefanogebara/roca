/**
 * Ops console logout. POST → expires the HttpOnly session cookie server-side
 * (client JS cannot delete an HttpOnly cookie, so "Sair" needs this endpoint).
 *
 * Deliberately public (no requireOps): it only clears the caller's own cookie,
 * reads nothing, and writes nothing beyond the Set-Cookie header — an
 * unauthenticated call is a no-op with a 200.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clearSessionCookie } from '../_lib/opsAuth';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'method not allowed' });
    return;
  }
  clearSessionCookie(res);
  res.status(200).json({ success: true, data: { ok: true } });
}
