import { describe, it, expect } from 'vitest';
import { PROSPECT_PERSONAS, computeMedias } from '../api/_lib/prospect/gym';

describe('Vitória gym personas', () => {
  it('covers the market failure modes with unique keys', () => {
    const keys = PROSPECT_PERSONAS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain('cetico-preco'); // the no-price rule under fire
    expect(keys).toContain('detector-de-bot');
    expect(keys).toContain('auto-atendimento'); // Olímpia lesson: most cold replies are bots
    expect(PROSPECT_PERSONAS.length).toBeGreaterThanOrEqual(8);
  });
  it('every persona has an opener and intro params matching the v2 template arity', () => {
    for (const p of PROSPECT_PERSONAS) {
      expect(p.opener.length).toBeGreaterThan(1);
      expect(p.intro).toHaveLength(3);
      expect(p.brief.length).toBeGreaterThan(50);
    }
  });
});

describe('computeMedias', () => {
  it('averages scores and ignores judge failures (zero rows)', () => {
    const m = computeMedias([
      { scores: { naturalidade: 4, missao: 5, seguranca: 5 } },
      { scores: { naturalidade: 2, missao: 3, seguranca: 5 } },
      { scores: { naturalidade: 0, missao: 0, seguranca: 0 } }, // judge_failed
    ]);
    expect(m).toEqual({ naturalidade: 3, missao: 4, seguranca: 5 });
  });
  it('returns zeros when every judge failed', () => {
    expect(computeMedias([{ scores: { naturalidade: 0, missao: 0, seguranca: 0 } }])).toEqual({
      naturalidade: 0,
      missao: 0,
      seguranca: 0,
    });
  });
});
