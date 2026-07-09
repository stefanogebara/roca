/**
 * Ops console login. POST { password } → sets the signed session cookie.
 *
 * Brute-force protection is DB-backed (ops_login_attempts): per-IP and global
 * failure caps in a sliding window, checked BEFORE the password compare and
 * failing closed if the counts can't be read. Constant-time compare handles
 * timing leaks; this handles guessing volume.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  passwordOk,
  mintToken,
  setSessionCookie,
  loginThrottled,
  LOGIN_WINDOW_MS,
} from '../_lib/opsAuth';
import { countOpsLoginFailures, recordOpsLoginAttempt } from '../_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'method not allowed' });
    return;
  }

  const ip = clientIp(req);
  const since = new Date(Date.now() - LOGIN_WINDOW_MS).toISOString();
  const [ipFails, globalFails] = await Promise.all([
    countOpsLoginFailures(ip, since),
    countOpsLoginFailures(null, since),
  ]);
  if (loginThrottled(ipFails, globalFails)) {
    res.status(429).json({ success: false, error: 'muitas tentativas — tente de novo em alguns minutos' });
    return;
  }

  const body = (typeof req.body === 'string' ? safeParse(req.body) : req.body) ?? {};
  const password = (body as { password?: string }).password ?? '';
  const ok = passwordOk(password);
  await recordOpsLoginAttempt(ip, ok);
  if (!ok) {
    res.status(401).json({ success: false, error: 'senha incorreta' });
    return;
  }
  setSessionCookie(res, mintToken());
  res.status(200).json({ success: true, data: { ok: true } });
}

/** First hop of x-forwarded-for (set by Vercel's edge), else socket address. */
function clientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  return first || req.socket?.remoteAddress || 'unknown';
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
