import { describe, it, expect } from 'vitest';
import { resolveRun } from '../api/_lib/gym/judge';
import { PERSONAS } from '../api/_lib/gym/personas';
import type { PairedVerdict, Lens } from '../api/_lib/gym/types';

const V = (
  persona: string,
  winner: 'A' | 'B' | 'tie',
  safety: { A: boolean; B: boolean } = { A: false, B: false }
): PairedVerdict => ({
  persona,
  winner,
  lenses: { naturalidade: winner, clareza: winner, seguranca: winner } as Record<Lens, 'A' | 'B' | 'tie'>,
  safety,
  rationale: 'test',
});

describe('resolveRun — recommendation + safety veto', () => {
  it('promotes the challenger when it wins the tally with no safety violation', () => {
    const r = resolveRun(1, 2, [V('a', 'B'), V('b', 'B'), V('c', 'A')]);
    expect(r.tally).toEqual({ A: 1, B: 2, tie: 0 });
    expect(r.recommended).toBe(2);
    expect(r.recommendedReason).toMatch(/promovido/i);
  });

  it('VETOES a tally-winning challenger that violated safety anywhere', () => {
    const r = resolveRun(1, 2, [V('a', 'B'), V('b', 'B', { A: false, B: true }), V('c', 'A')]);
    expect(r.tally.B).toBe(2);
    expect(r.recommended).toBe(1); // champion kept despite losing the tally
    expect(r.recommendedReason).toMatch(/veto/i);
  });

  it('keeps the champion on a tied tally (no clear improvement)', () => {
    const r = resolveRun(1, 2, [V('a', 'A'), V('b', 'B')]);
    expect(r.recommended).toBe(1);
    expect(r.recommendedReason).toMatch(/empat/i);
  });

  it('keeps the champion when it wins the tally', () => {
    const r = resolveRun(3, 4, [V('a', 'A'), V('b', 'A'), V('c', 'B')]);
    expect(r.recommended).toBe(3);
  });

  it('a champion safety violation never forces a challenger promotion by itself', () => {
    // Challenger ties the tally but champion violated on one persona: still no
    // promotion (challenger must WIN the tally to be promoted).
    const r = resolveRun(1, 2, [V('a', 'A', { A: true, B: false }), V('b', 'B')]);
    expect(r.tally).toEqual({ A: 1, B: 1, tie: 0 });
    expect(r.recommended).toBe(1);
  });
});

describe('PERSONAS — the seeded farmer roster', () => {
  it('has a solid roster with unique keys and the key adversarial probe', () => {
    expect(PERSONAS.length).toBeGreaterThanOrEqual(10);
    const keys = PERSONAS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain('perigoso-dose'); // the dose-pressure safety probe must exist
  });

  it('every persona has a brief and an opener', () => {
    for (const p of PERSONAS) {
      expect(p.key, 'key').toBeTruthy();
      expect(p.label, `label ${p.key}`).toBeTruthy();
      expect(p.brief.length, `brief ${p.key}`).toBeGreaterThan(40);
      expect(p.opener.length, `opener ${p.key}`).toBeGreaterThan(0);
    }
  });
});
