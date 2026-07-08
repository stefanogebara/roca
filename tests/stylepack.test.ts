import { describe, it, expect, beforeEach } from 'vitest';
import {
  composeSystem,
  getActiveStylePack,
  resetStylePackCache,
} from '../api/_lib/stylepack';

describe('composeSystem', () => {
  it('returns the base prompt untouched when there is no pack', () => {
    expect(composeSystem('BASE', null)).toBe('BASE');
    expect(composeSystem('BASE', '')).toBe('BASE');
    expect(composeSystem('BASE', '   ')).toBe('BASE');
  });

  it('appends the pack under a labeled voice section', () => {
    const out = composeSystem('BASE', 'fale simples');
    expect(out.startsWith('BASE')).toBe(true);
    expect(out).toMatch(/## Voz da Stevi/);
    expect(out).toMatch(/fale simples/);
  });

  it('scopes the pack as style-only in the section header', () => {
    // The header must make clear the pack governs HOW to talk, not WHAT to claim
    // — the textual guard that keeps Layer 2 from overriding Layer 1.
    expect(composeSystem('BASE', 'x')).toMatch(/como falar, nunca o que afirmar/);
  });
});

describe('getActiveStylePack (cache behavior)', () => {
  beforeEach(() => resetStylePackCache());

  it('caches the fetched pack within the TTL', async () => {
    let calls = 0;
    const fetcher = async () => {
      calls++;
      return 'pack-v1';
    };
    let t = 0;
    const now = () => t;
    expect(await getActiveStylePack(fetcher, now)).toBe('pack-v1');
    t = 60_000; // +1 min, inside 3-min TTL
    expect(await getActiveStylePack(fetcher, now)).toBe('pack-v1');
    expect(calls).toBe(1);
  });

  it('refetches after the TTL expires', async () => {
    let calls = 0;
    const fetcher = async () => `pack-${++calls}`;
    let t = 0;
    const now = () => t;
    expect(await getActiveStylePack(fetcher, now)).toBe('pack-1');
    t = 4 * 60_000; // past the 3-min TTL
    expect(await getActiveStylePack(fetcher, now)).toBe('pack-2');
    expect(calls).toBe(2);
  });

  it('fails soft to null and caches the failure (no hammering)', async () => {
    let calls = 0;
    const fetcher = async () => {
      calls++;
      throw new Error('db down');
    };
    let t = 0;
    const now = () => t;
    expect(await getActiveStylePack(fetcher, now)).toBeNull();
    t = 30_000;
    expect(await getActiveStylePack(fetcher, now)).toBeNull();
    expect(calls).toBe(1); // failure cached for the TTL window
  });

  it('returns null when no pack is active', async () => {
    expect(await getActiveStylePack(async () => null, () => 0)).toBeNull();
  });
});
