import { describe, it, expect } from 'vitest';
import { buildVazioAlertText, alertDedupKey } from '../api/_lib/alerts';
import type { CalendarTransition } from '../api/_lib/tools/calendar';

const start: CalendarTransition = { uf: 'MT', kind: 'vazio_start', date: '2026-06-08', daysAway: 3 };
const end: CalendarTransition = { uf: 'MG', kind: 'vazio_end', date: '2026-09-30', daysAway: 5 };

describe('buildVazioAlertText', () => {
  it('warns about a starting vazio with date, source and the no-live-soy rule', () => {
    const t = buildVazioAlertText(start);
    expect(t).toContain('MT');
    expect(t).toMatch(/come[çc]a/i);
    expect(t).toContain('3 dia');
    expect(t).toMatch(/Portaria SDA\/MAPA/);
    expect(t).toMatch(/guaxa|soja viva/i);
  });

  it('frames an ending vazio as planting opening up', () => {
    const t = buildVazioAlertText(end);
    expect(t).toMatch(/termina/i);
    expect(t).toContain('5 dia');
    expect(t).toMatch(/plantio|plantar/i);
  });

  it('uses singular for 1 day away', () => {
    expect(buildVazioAlertText({ ...start, daysAway: 1 })).toContain('1 dia');
    expect(buildVazioAlertText({ ...start, daysAway: 1 })).not.toContain('1 dias');
  });

  it('never has the shape of a prescription (no dose, no product)', () => {
    for (const t of [buildVazioAlertText(start), buildVazioAlertText(end)]) {
      expect(t).not.toMatch(/\d+\s?(l|ml|kg|g)\s?\/\s?ha/i);
      expect(t).not.toMatch(/aplique|dose de/i);
    }
  });
});

describe('alertDedupKey', () => {
  it('is stable per transition and distinct across transitions', () => {
    expect(alertDedupKey(start)).toBe(alertDedupKey({ ...start, daysAway: 1 }));
    expect(alertDedupKey(start)).not.toBe(alertDedupKey(end));
    expect(alertDedupKey(start)).not.toBe(alertDedupKey({ ...start, kind: 'vazio_end' }));
  });
});
