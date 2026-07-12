import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  mintToken,
  verifyToken,
  safeEqual,
  passwordOk,
  loginThrottled,
  clearSessionCookie,
  LOGIN_MAX_FAILS_PER_IP,
  LOGIN_MAX_FAILS_GLOBAL,
} from '../api/_lib/opsAuth';
import { maskWa } from '../api/_lib/opsData';

beforeAll(() => {
  process.env.OPS_SESSION_SECRET = 'test-signing-secret';
  process.env.OPS_PASSWORD = 'correct horse';
});

describe('opsAuth token', () => {
  it('mints a token that verifies', () => {
    const t = mintToken(1_000_000);
    expect(verifyToken(t, 1_000_000)).toBe(true);
  });

  it('rejects an expired token', () => {
    const t = mintToken(0);
    expect(verifyToken(t, 13 * 60 * 60 * 1000)).toBe(false); // past 12h TTL
  });

  it('rejects a tampered payload', () => {
    const t = mintToken(1_000_000);
    const [, sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'ops', exp: 9e15 })).toString('base64').replace(/=+$/, '');
    expect(verifyToken(`${forged}.${sig}`, 1_000_000)).toBe(false);
  });

  it('rejects a tampered signature', () => {
    const t = mintToken(1_000_000);
    const [payload] = t.split('.');
    expect(verifyToken(`${payload}.deadbeef`, 1_000_000)).toBe(false);
  });

  it('rejects junk / empty', () => {
    expect(verifyToken(undefined)).toBe(false);
    expect(verifyToken('')).toBe(false);
    expect(verifyToken('nodot')).toBe(false);
  });

  it("a token signed with a different key doesn't verify", () => {
    const t = mintToken(1_000_000);
    process.env.OPS_SESSION_SECRET = 'rotated-secret';
    expect(verifyToken(t, 1_000_000)).toBe(false);
    process.env.OPS_SESSION_SECRET = 'test-signing-secret'; // restore
  });
});

describe('token versioning (session revocation)', () => {
  afterEach(() => {
    delete process.env.OPS_TOKEN_VERSION; // never leak into later tests, even on assert failure
  });

  it('rejects a token minted under an older OPS_TOKEN_VERSION', () => {
    process.env.OPS_TOKEN_VERSION = 'v1';
    const t = mintToken(1_000_000);
    expect(verifyToken(t, 1_000_000)).toBe(true);
    process.env.OPS_TOKEN_VERSION = 'v2'; // the revocation act: bump the env
    expect(verifyToken(t, 1_000_000)).toBe(false);
  });

  it('rejects a legacy token with no version claim (valid signature, pre-versioning payload)', () => {
    const b64url = (b: Buffer) =>
      b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const payload = b64url(Buffer.from(JSON.stringify({ sub: 'ops', exp: 2_000_000 })));
    const sig = b64url(createHmac('sha256', 'test-signing-secret').update(payload).digest());
    expect(verifyToken(`${payload}.${sig}`, 1_000_000)).toBe(false);
  });
});

describe('clearSessionCookie (server-side logout)', () => {
  it('expires the HttpOnly cookie — client JS cannot, so this endpoint must', () => {
    const setHeader = vi.fn();
    clearSessionCookie({ setHeader } as never);
    const value = setHeader.mock.calls[0][1] as string;
    expect(setHeader.mock.calls[0][0]).toBe('Set-Cookie');
    expect(value).toContain('stevi_ops=;');
    expect(value).toContain('Max-Age=0');
    expect(value).toContain('HttpOnly');
    expect(value).toContain('Path=/');
  });
});

describe('passwordOk / safeEqual', () => {
  it('accepts the correct password, rejects wrong/empty', () => {
    expect(passwordOk('correct horse')).toBe(true);
    expect(passwordOk('wrong')).toBe(false);
    expect(passwordOk('')).toBe(false);
  });
  it('safeEqual is true only for identical strings (incl. differing lengths)', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('abc', 'abd')).toBe(false);
  });
});

describe('loginThrottled', () => {
  it('allows below both limits', () => {
    expect(loginThrottled(0, 0)).toBe(false);
    expect(loginThrottled(LOGIN_MAX_FAILS_PER_IP - 1, LOGIN_MAX_FAILS_GLOBAL - 1)).toBe(false);
  });

  it('throttles at the per-IP limit', () => {
    expect(loginThrottled(LOGIN_MAX_FAILS_PER_IP, 0)).toBe(true);
  });

  it('throttles at the global limit (IP-rotation defense)', () => {
    expect(loginThrottled(0, LOGIN_MAX_FAILS_GLOBAL)).toBe(true);
  });

  it('fails closed when a count query errored (null)', () => {
    expect(loginThrottled(null, 0)).toBe(true);
    expect(loginThrottled(0, null)).toBe(true);
  });
});

describe('maskWa', () => {
  it('shows country code + last 4 only', () => {
    expect(maskWa('5511999002121')).toBe('+55 ••••2121');
    expect(maskWa('whatsapp:+5519984321221')).toBe('+55 ••••1221');
  });
  it('handles missing / short numbers', () => {
    expect(maskWa(null)).toBe('—');
    expect(maskWa('123')).toBe('••••');
  });
});
