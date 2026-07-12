/**
 * Daily canary — the pure halves: transition detection (alert on NEWLY broken
 * or recovered, stay silent on steady state, in both directions) and the
 * fallback-rate verdict. The anti-noise property is the whole point: a check
 * that's been red for a week must not page the founders every morning.
 */
import { describe, it, expect } from 'vitest';
import {
  diffCanary,
  formatCanaryAlert,
  fallbackVerdict,
  type CanaryCheck,
} from '../api/_lib/canary';

const check = (name: string, ok: boolean, detail: string | null = null): CanaryCheck => ({
  check: name,
  ok,
  detail,
});

describe('diffCanary', () => {
  it('first run: failures alert (they are real), successes stay quiet', () => {
    const d = diffCanary(null, [check('a', true), check('b', false, 'timeout')]);
    expect(d.broke.map((c) => c.check)).toEqual(['b']);
    expect(d.recovered).toEqual([]);
  });

  it('transition ok→fail is "broke"; fail→ok is "recovered"', () => {
    const prev = [check('a', true), check('b', false)];
    const curr = [check('a', false, '500'), check('b', true)];
    const d = diffCanary(prev, curr);
    expect(d.broke.map((c) => c.check)).toEqual(['a']);
    expect(d.recovered.map((c) => c.check)).toEqual(['b']);
  });

  it('steady state — still broken or still fine — never re-alerts', () => {
    const prev = [check('a', true), check('b', false)];
    const curr = [check('a', true), check('b', false)];
    const d = diffCanary(prev, curr);
    expect(d.broke).toEqual([]);
    expect(d.recovered).toEqual([]);
  });

  it('a check that first appears already failing alerts (new information)', () => {
    const d = diffCanary([check('a', true)], [check('a', true), check('novo', false)]);
    expect(d.broke.map((c) => c.check)).toEqual(['novo']);
  });
});

describe('formatCanaryAlert', () => {
  it('is null when nothing changed', () => {
    expect(formatCanaryAlert({ broke: [], recovered: [] })).toBeNull();
  });

  it('names what broke, with detail', () => {
    const msg = formatCanaryAlert({
      broke: [check('template stevi_parceria_v1', false, 'PAUSED')],
      recovered: [],
    });
    expect(msg).toContain('stevi_parceria_v1');
    expect(msg).toContain('PAUSED');
  });

  it('reports recoveries even without new breakage', () => {
    const msg = formatCanaryAlert({ broke: [], recovered: [check('yahoo-prices', true)] });
    expect(msg).toContain('yahoo-prices');
    expect(msg).toMatch(/voltou/i);
  });
});

describe('fallbackVerdict', () => {
  it('quiet day (no outbound) is fine', () => {
    expect(fallbackVerdict(0, 0).ok).toBe(true);
  });
  it('a couple of fallbacks are noise, not an outage', () => {
    expect(fallbackVerdict(2, 4).ok).toBe(true);
  });
  it('3+ fallbacks above 20% of replies is an outage signal', () => {
    expect(fallbackVerdict(3, 10).ok).toBe(false);
    expect(fallbackVerdict(3, 10).detail).toContain('3');
  });
  it('3 fallbacks out of hundreds is not', () => {
    expect(fallbackVerdict(3, 100).ok).toBe(true);
  });
});
