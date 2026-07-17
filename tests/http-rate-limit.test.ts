/**
 * Public-endpoint rate limiter — the cost/DoS backstop for card/report/qr
 * (audit 2026-07-16, security §2). Pins the fixed-window behaviour, per-key
 * isolation, IP extraction from proxy headers, and that the guard writes a 429
 * with Retry-After without touching the handler body.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkRateLimit,
  clientIp,
  enforcePublicRateLimit,
  resetRateLimits,
} from '../api/_lib/httpRateLimit';

beforeEach(() => resetRateLimits());

describe('checkRateLimit (fixed window)', () => {
  it('allows up to the limit, then blocks within the window', () => {
    const opts = { limit: 3, windowMs: 60_000 };
    const t0 = 1_000_000;
    expect(checkRateLimit('k', opts, t0).allowed).toBe(true); // 1
    expect(checkRateLimit('k', opts, t0).allowed).toBe(true); // 2
    expect(checkRateLimit('k', opts, t0).allowed).toBe(true); // 3
    const blocked = checkRateLimit('k', opts, t0); // 4 — over
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(60);
  });

  it('resets after the window elapses', () => {
    const opts = { limit: 1, windowMs: 10_000 };
    const t0 = 5_000_000;
    expect(checkRateLimit('k', opts, t0).allowed).toBe(true);
    expect(checkRateLimit('k', opts, t0).allowed).toBe(false);
    // A hit past resetAt opens a fresh window.
    expect(checkRateLimit('k', opts, t0 + 10_000).allowed).toBe(true);
  });

  it('isolates windows per key (IP A does not consume IP B budget)', () => {
    const opts = { limit: 1, windowMs: 60_000 };
    const t0 = 2_000_000;
    expect(checkRateLimit('card:1.1.1.1', opts, t0).allowed).toBe(true);
    expect(checkRateLimit('card:1.1.1.1', opts, t0).allowed).toBe(false);
    expect(checkRateLimit('card:2.2.2.2', opts, t0).allowed).toBe(true);
  });
});

describe('clientIp', () => {
  it('takes the first hop of x-forwarded-for', () => {
    expect(clientIp({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })).toBe('203.0.113.7');
  });
  it('falls back to x-real-ip, then to a shared unknown bucket', () => {
    expect(clientIp({ 'x-real-ip': '198.51.100.9' })).toBe('198.51.100.9');
    expect(clientIp({})).toBe('unknown');
  });
});

describe('enforcePublicRateLimit', () => {
  function fakeRes() {
    const headers: Record<string, string> = {};
    const captured = { code: 0, body: '' };
    return {
      headers,
      captured,
      setHeader(n: string, v: string) {
        headers[n] = v;
      },
      status(code: number) {
        captured.code = code;
        return { send: (b: string) => (captured.body = b) };
      },
    };
  }

  it('lets the first request through and 429s once the per-IP limit is exceeded', () => {
    process.env.PUBLIC_RATE_LIMIT = '2';
    process.env.PUBLIC_RATE_WINDOW_MS = '60000';
    const headers = { 'x-forwarded-for': '203.0.113.50' };

    const r1 = fakeRes();
    expect(enforcePublicRateLimit('card', headers, r1)).toBe(true);
    expect(r1.captured.code).toBe(0); // untouched — handler proceeds

    enforcePublicRateLimit('card', headers, fakeRes()); // 2nd — still ok

    const r3 = fakeRes();
    expect(enforcePublicRateLimit('card', headers, r3)).toBe(false);
    expect(r3.captured.code).toBe(429);
    expect(r3.headers['Retry-After']).toBeDefined();
    expect(r3.headers['Cache-Control']).toBe('no-store');

    delete process.env.PUBLIC_RATE_LIMIT;
    delete process.env.PUBLIC_RATE_WINDOW_MS;
  });

  it('scopes the budget per endpoint (card flood does not block report)', () => {
    process.env.PUBLIC_RATE_LIMIT = '1';
    const headers = { 'x-forwarded-for': '203.0.113.60' };
    expect(enforcePublicRateLimit('card', headers, fakeRes())).toBe(true);
    expect(enforcePublicRateLimit('card', headers, fakeRes())).toBe(false);
    // Different scope, same IP — independent window.
    expect(enforcePublicRateLimit('report', headers, fakeRes())).toBe(true);
    delete process.env.PUBLIC_RATE_LIMIT;
  });
});
