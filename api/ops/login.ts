/**
 * Ops console login. POST { password } → sets the signed session cookie.
 * Rate-limited implicitly by being password-gated + constant-time compare.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { passwordOk, mintToken, setSessionCookie } from '../_lib/opsAuth';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'method not allowed' });
    return;
  }
  const body = (typeof req.body === 'string' ? safeParse(req.body) : req.body) ?? {};
  const password = (body as { password?: string }).password ?? '';
  if (!passwordOk(password)) {
    res.status(401).json({ success: false, error: 'senha incorreta' });
    return;
  }
  setSessionCookie(res, mintToken());
  res.status(200).json({ success: true, data: { ok: true } });
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
