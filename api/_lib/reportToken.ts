/**
 * Signed, expiring URLs for the applications report card.
 *
 * Unlike the weather/vigor cards (low-sensitivity data encoded in the query
 * string), the applications report is the farmer's private chemical history —
 * it must never sit at a guessable public URL. So the card endpoint takes only
 * an opaque user id + an expiry + an HMAC signature; it fetches the actual
 * records server-side and renders. The signature (over `userId.exp`) prevents
 * enumeration; the TTL bounds the exposure window. WhatsApp fetches within the
 * window, then the link dies.
 *
 * If REPORT_URL_SECRET isn't configured, signing is unavailable and callers
 * degrade to a gate-safe text summary rather than shipping an unsigned card.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1h — long enough for provider fetch + a re-open
const SIG_LEN = 32; // truncated hex; 128 bits is ample for a short-lived URL token

function secret(): string {
  return process.env.REPORT_URL_SECRET ?? '';
}

/** Whether report URL signing is available (secret configured). */
export function reportSecretConfigured(): boolean {
  return secret().length > 0;
}

function sign(userId: string, expMs: number): string {
  return createHmac('sha256', secret()).update(`${userId}.${expMs}`).digest('hex').slice(0, SIG_LEN);
}

/** Constant-time string compare (equal length required). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * Query string for a signed applications-report card URL. Returns null when no
 * secret is configured (caller should fall back to text). `now` injectable for
 * tests.
 */
export function reportCardParams(
  userId: string,
  opts: { ttlMs?: number; now?: number } = {}
): string | null {
  if (!reportSecretConfigured()) return null;
  const exp = (opts.now ?? Date.now()) + (opts.ttlMs ?? DEFAULT_TTL_MS);
  const sig = sign(userId, exp);
  const u = encodeURIComponent(userId);
  return `type=applications&u=${u}&exp=${exp}&sig=${sig}`;
}

/** Verify a report token. False on bad/expired/tampered signature or no secret. */
export function verifyReportToken(
  userId: string,
  exp: string,
  sig: string,
  now: number = Date.now()
): boolean {
  if (!reportSecretConfigured()) return false;
  const expMs = Number(exp);
  if (!Number.isFinite(expMs) || expMs < now) return false;
  return safeEqual(sig, sign(userId, expMs));
}
