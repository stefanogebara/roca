/**
 * Growth loops — pure halves. Source tokens make the flight plan's gate
 * metric (D7 vouchado vs. orgânico) measurable; the referral nudge builds the
 * produtor→produtor chain with self-attributing links; both must be sparing
 * and never fire on the wrong moment.
 */
import { describe, it, expect } from 'vitest';
import {
  parseSourceToken,
  shouldPromptReferral,
  referralNudge,
} from '../api/_lib/growth';
import { pricesSvg } from '../api/_lib/cards/prices';
import { priceCardUrl } from '../api/_lib/pipeline';

const NOW = new Date('2026-07-20T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

describe('parseSourceToken', () => {
  it('captures "vim pelo/pela" attributions, normalized', () => {
    expect(parseSourceToken('Oi! Vim pelo José da Cooxupé')).toBe('josé da cooxupé');
    expect(parseSourceToken('vim pela Maria')).toBe('maria');
    expect(parseSourceToken('Oi, vim pelo cartaz do armazém!')).toBe('cartaz do armazém');
  });
  it('captures explicit #tokens and generic indicação', () => {
    expect(parseSourceToken('oi #tec-jose')).toBe('tec-jose');
    expect(parseSourceToken('Oi! Vim por indicação')).toBe('indicação');
  });
  it('returns null for ordinary first messages', () => {
    expect(parseSourceToken('oi')).toBeNull();
    expect(parseSourceToken('posso pulverizar hoje?')).toBeNull();
    expect(parseSourceToken(null)).toBeNull();
  });
  it('bounds the captured value (no unbounded PII blobs)', () => {
    const long = 'vim pelo ' + 'x'.repeat(200);
    expect(parseSourceToken(long)!.length).toBeLessThanOrEqual(40);
  });
});

describe('shouldPromptReferral', () => {
  const base = {
    intent: 'pest_triage',
    hasVisual: true,
    firstContact: false,
    gateSafe: true,
    lastPromptedAt: null as string | null,
  };

  it('fires after a delivered victory moment (visual attached, value intent)', () => {
    expect(shouldPromptReferral(base, NOW)).toBe(true);
    expect(shouldPromptReferral({ ...base, intent: 'spray_window' }, NOW)).toBe(true);
    expect(shouldPromptReferral({ ...base, intent: 'field_health' }, NOW)).toBe(true);
  });
  it('never on first contact, gated replies, non-value intents, or pin-asks (no visual)', () => {
    expect(shouldPromptReferral({ ...base, firstContact: true }, NOW)).toBe(false);
    expect(shouldPromptReferral({ ...base, gateSafe: false }, NOW)).toBe(false);
    expect(shouldPromptReferral({ ...base, intent: 'smalltalk' }, NOW)).toBe(false);
    expect(shouldPromptReferral({ ...base, hasVisual: false }, NOW)).toBe(false);
  });
  it('is sparing: at most once per 14 days per farmer', () => {
    expect(shouldPromptReferral({ ...base, lastPromptedAt: daysAgo(3) }, NOW)).toBe(false);
    expect(shouldPromptReferral({ ...base, lastPromptedAt: daysAgo(20) }, NOW)).toBe(true);
  });
});

describe('referralNudge', () => {
  it('builds a forwardable wa.me link pre-filled with the farmer\'s own name (self-attributing chain)', () => {
    const n = referralNudge('João Silva');
    expect(n).toContain('wa.me/');
    expect(n).toContain(encodeURIComponent('Vim pelo(a) João'));
  });
  it('falls back to generic indicação when the farmer has no profile name', () => {
    expect(referralNudge(null)).toContain(encodeURIComponent('Vim por indicação'));
  });
});

describe('price card', () => {
  const quotes = [
    { key: 'cafe' as const, label: 'Café arábica (NY)', sacaBrl: 2451.3, weekChangePct: 1.8 },
    { key: 'soja' as const, label: 'Soja (Chicago)', sacaBrl: 171.2, weekChangePct: -0.4 },
  ];

  it('priceCardUrl packs quotes compactly and survives a round-trip mindset', () => {
    const url = priceCardUrl(quotes, 5.43)!;
    expect(url).toContain('type=prices');
    expect(url).toContain('cafe');
    expect(decodeURIComponent(url)).toContain('2451.3');
  });
  it('no quotes → no card', () => {
    expect(priceCardUrl([], 5.43)).toBeUndefined();
  });
  it('pricesSvg renders each commodity with R$/saca and the weekly arrow', () => {
    const svg = pricesSvg(quotes, 5.43, '20/07');
    expect(svg).toContain('Café arábica');
    expect(svg).toContain('2.451'); // pt-BR thousands
    expect(svg).toContain('Soja');
    expect(svg).toMatch(/R\$/);
    expect(svg).toContain('Stevi');
  });
});
