import { describe, it, expect } from 'vitest';
import { classifyFrostRisk, pickWorstFrostDay } from '../api/_lib/tools/frost';
import { buildFrostAlertText, frostDedupKey } from '../api/_lib/alerts';

describe('classifyFrostRisk', () => {
  it('flags likely frost at ≤1°C', () => {
    expect(classifyFrostRisk(0.5)).toBe('geada');
    expect(classifyFrostRisk(-2)).toBe('geada');
    expect(classifyFrostRisk(1)).toBe('geada');
  });
  it('flags frost risk at ≤3°C', () => {
    expect(classifyFrostRisk(2.4)).toBe('risco');
    expect(classifyFrostRisk(3)).toBe('risco');
  });
  it('is silent above 3°C', () => {
    expect(classifyFrostRisk(3.1)).toBeNull();
    expect(classifyFrostRisk(12)).toBeNull();
  });
});

describe('pickWorstFrostDay', () => {
  it('picks the coldest flagged day', () => {
    const worst = pickWorstFrostDay([
      { date: '2026-07-10', minC: 5 },
      { date: '2026-07-11', minC: 2.1 },
      { date: '2026-07-12', minC: 0.2 },
    ]);
    expect(worst).toEqual({ date: '2026-07-12', minC: 0.2, risk: 'geada' });
  });
  it('returns null when no day is flagged', () => {
    expect(
      pickWorstFrostDay([
        { date: '2026-07-10', minC: 8 },
        { date: '2026-07-11', minC: 6 },
      ])
    ).toBeNull();
  });
});

describe('buildFrostAlertText', () => {
  it('states the temperature, date, risk level, and cites the source honestly', () => {
    const t = buildFrostAlertText({ date: '2026-07-12', minC: 0.2, risk: 'geada' });
    expect(t).toMatch(/geada/i);
    expect(t).toContain('0.2'.replace('.', ','));
    expect(t).toContain('12/07');
    expect(t).toMatch(/previs[ãa]o/i);
    expect(t).toMatch(/INMET|fontes locais/i);
  });
  it('softer framing for risco level', () => {
    const t = buildFrostAlertText({ date: '2026-07-11', minC: 2.5, risk: 'risco' });
    expect(t).toMatch(/risco de geada/i);
  });
  it('never has a prescription shape', () => {
    for (const d of [
      { date: '2026-07-12', minC: 0.2, risk: 'geada' as const },
      { date: '2026-07-11', minC: 2.5, risk: 'risco' as const },
    ]) {
      const t = buildFrostAlertText(d);
      expect(t).not.toMatch(/\d+\s?(l|ml|kg|g)\s?\/\s?ha/i);
      expect(t).not.toMatch(/aplique/i);
    }
  });
});

describe('frostDedupKey', () => {
  it('is per forecast date', () => {
    expect(frostDedupKey({ date: '2026-07-12', minC: 0.2, risk: 'geada' })).toBe(
      'frost:2026-07-12'
    );
  });
});
