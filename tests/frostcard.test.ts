/**
 * Frost card — July in MG coffee country makes this the most forward-worthy
 * alert in the product. The card must read at arm's length (big worst-night
 * number), never prescribe, and pack losslessly into the card URL.
 */
import { describe, it, expect } from 'vitest';
import { frostSvg } from '../api/_lib/cards/frost';
import { frostCardUrl } from '../api/_lib/alerts';

const days = [
  { date: '2026-07-15', minC: 1.2, risk: 'geada' as const },
  { date: '2026-07-16', minC: 2.8, risk: 'risco' as const },
];

describe('frostSvg', () => {
  it('leads with the worst night and lists each risky day', () => {
    const svg = frostSvg(days);
    expect(svg).toContain('1,2'); // pt-BR decimal for the worst minC
    expect(svg).toMatch(/[Gg]eada/);
    expect(svg).toContain('15/07');
    expect(svg).toContain('16/07');
    expect(svg).toContain('Stevi');
  });
  it('never prescribes products — protection guidance only', () => {
    const svg = frostSvg(days);
    expect(svg).not.toMatch(/dose|produto|aplicar\s+\w+cida/i);
  });
});

describe('frostCardUrl', () => {
  it('packs days compactly for the card endpoint', () => {
    const url = frostCardUrl(days)!;
    expect(url).toContain('type=frost');
    expect(decodeURIComponent(url)).toContain('2026-07-15:1.2:geada');
    expect(decodeURIComponent(url)).toContain('2026-07-16:2.8:risco');
  });
  it('no risky days → no card', () => {
    expect(frostCardUrl([])).toBeUndefined();
  });
});
