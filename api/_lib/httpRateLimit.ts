/**
 * Best-effort in-memory rate limiter for the UNAUTHENTICATED public endpoints
 * (card, report, qr). These render images/PDFs and some fire external API calls
 * (weather/soil/geo/NDVI) per request, and an attacker can vary query params
 * (lat/lon) to slip past the CDN cache and hit the origin repeatedly — an
 * unmetered cost/DoS amplification lever (audit 2026-07-16, security §2).
 *
 * Design choices, deliberately proportionate to a pre-revenue single-number op:
 * - In-memory fixed window, keyed by client IP. Vercel Fluid Compute reuses warm
 *   instances so the counter persists across requests; a cold instance just
 *   starts fresh. No DB round-trip (the thing we're protecting is cost), no new
 *   infra. It is NOT a globally-consistent guarantee — it caps single-source
 *   amplification and the bill, which is the actual threat.
 * - The cap is generous on purpose. WhatsApp/Twilio fetch card media server-side
 *   from a small set of egress IPs; the limit must sit well above any legitimate
 *   provider burst of distinct cache-missing cards, while still stopping a flood
 *   that varies coordinates thousands of times a minute. Tune via env if needed.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets — for the Retry-After header on a block. */
  retryAfterSec: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
// Sweep expired buckets when the map grows past this, so a spray of distinct
// spoofed IPs can't grow memory without bound (the endpoint we're protecting).
const SWEEP_THRESHOLD = 5_000;

function sweep(now: number): void {
  for (const [key, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(key);
  }
}

/**
 * Count one hit against `key` and report whether it's allowed. Fixed window:
 * the first hit opens a window of `windowMs`; hits beyond `limit` within it are
 * blocked until it resets. `now` is injectable for tests.
 */
export function checkRateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
  now: number = Date.now()
): RateLimitResult {
  if (buckets.size > SWEEP_THRESHOLD) sweep(now);

  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  b.count++;
  if (b.count > opts.limit) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

/**
 * First-hop client IP from proxy headers (Vercel populates x-forwarded-for).
 * Falls back to a shared 'unknown' bucket when absent — a missing IP shouldn't
 * become an unlimited bypass, so those callers share one conservative window.
 */
export function clientIp(headers: Record<string, string | string[] | undefined>): string {
  const xff = headers['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff[0] : xff;
  if (raw && raw.trim()) return raw.split(',')[0].trim();
  const real = headers['x-real-ip'];
  const realStr = Array.isArray(real) ? real[0] : real;
  return realStr && realStr.trim() ? realStr.trim() : 'unknown';
}

/** Default public-endpoint limit, env-tunable. Generous per the header note. */
export function publicLimit(): { limit: number; windowMs: number } {
  const limit = Number(process.env.PUBLIC_RATE_LIMIT ?? 120);
  const windowMs = Number(process.env.PUBLIC_RATE_WINDOW_MS ?? 60_000);
  return {
    limit: Number.isFinite(limit) && limit > 0 ? limit : 120,
    windowMs: Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 60_000,
  };
}

/**
 * Guard a public endpoint: count the caller's hit under `scope:ip` and, if over
 * the limit, write a 429 with Retry-After and return false. Returns true when the
 * caller may proceed. Keeps the wiring identical across card/report/qr.
 */
export function enforcePublicRateLimit(
  scope: string,
  headers: Record<string, string | string[] | undefined>,
  res: { setHeader(name: string, value: string): void; status(code: number): { send(body: string): void } }
): boolean {
  const ip = clientIp(headers);
  const { allowed, retryAfterSec } = checkRateLimit(`${scope}:${ip}`, publicLimit());
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSec));
    res.setHeader('Cache-Control', 'no-store');
    res.status(429).send('too many requests');
    return false;
  }
  return true;
}

/** Test hook: clear all windows between cases. */
export function resetRateLimits(): void {
  buckets.clear();
}
