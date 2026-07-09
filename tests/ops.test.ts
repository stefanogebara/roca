import { describe, it, expect, beforeAll } from 'vitest';
import { mintToken, verifyToken, safeEqual, passwordOk } from '../api/_lib/opsAuth';
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
