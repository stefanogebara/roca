import { describe, it, expect } from 'vitest';
import {
  vazioStatus,
  VAZIO_SOJA_2026,
  upcomingTransitions,
  isCalendarStale,
} from '../api/_lib/tools/calendar';

// Windows pinned from Portaria SDA/MAPA nº 1.579/2026
// (knowledge/portaria-sda-mapa-1579-2026.txt).
describe('vazioStatus', () => {
  it('MT is in vazio on 2026-07-07 (window Jun 8 – Sep 6)', () => {
    const s = vazioStatus('MT', new Date('2026-07-07T12:00:00Z'));
    expect(s.known).toBe(true);
    expect(s.active).toBe(true);
    expect(s.line).toMatch(/vazio sanitário/i);
    expect(s.line).toMatch(/1\.579/);
  });

  it('GO window boundaries are inclusive (Jun 27 – Sep 24)', () => {
    expect(vazioStatus('GO', new Date('2026-06-27T12:00:00Z')).active).toBe(true);
    expect(vazioStatus('GO', new Date('2026-09-24T12:00:00Z')).active).toBe(true);
    expect(vazioStatus('GO', new Date('2026-06-26T12:00:00Z')).active).toBe(false);
    expect(vazioStatus('GO', new Date('2026-09-25T12:00:00Z')).active).toBe(false);
  });

  it('outside the window still informs the dates', () => {
    const s = vazioStatus('MT', new Date('2026-10-15T12:00:00Z'));
    expect(s.known).toBe(true);
    expect(s.active).toBe(false);
    expect(s.line).toMatch(/08 de junho/);
  });

  it('regional states hedge instead of asserting one date', () => {
    const s = vazioStatus('PR', new Date('2026-07-07T12:00:00Z'));
    expect(s.known).toBe(true);
    expect(s.active).toBe(true);
    expect(s.line).toMatch(/varia por região/i);
  });

  it('unknown UF stays silent (never invent)', () => {
    const s = vazioStatus('XX', new Date('2026-07-07T12:00:00Z'));
    expect(s.known).toBe(false);
    expect(s.line).toBeNull();
  });

  it('null UF stays silent', () => {
    const s = vazioStatus(null, new Date('2026-07-07T12:00:00Z'));
    expect(s.known).toBe(false);
  });

  it('table covers the main soy states', () => {
    for (const uf of ['MT', 'MS', 'GO', 'PR', 'RS', 'BA', 'MG', 'SP', 'TO', 'MA', 'PI']) {
      expect(VAZIO_SOJA_2026[uf], `missing ${uf}`).toBeDefined();
    }
  });
});

describe('upcomingTransitions (daily monitor)', () => {
  it('flags a vazio end within the window (GO ends 2026-09-24)', () => {
    const list = upcomingTransitions(new Date('2026-09-20T12:00:00Z'), 7);
    const go = list.find((t) => t.uf === 'GO' && t.kind === 'vazio_end');
    expect(go).toBeDefined();
    expect(go!.daysAway).toBe(4);
  });

  it('flags a vazio start within the window (MT starts 2026-06-08)', () => {
    const list = upcomingTransitions(new Date('2026-06-05T12:00:00Z'), 7);
    expect(list.some((t) => t.uf === 'MT' && t.kind === 'vazio_start')).toBe(true);
  });

  it('returns nothing in a quiet stretch and sorts by proximity', () => {
    expect(upcomingTransitions(new Date('2026-08-01T12:00:00Z'), 3)).toEqual([]);
    const list = upcomingTransitions(new Date('2026-09-18T12:00:00Z'), 14);
    for (let i = 1; i < list.length; i++) {
      expect(list[i].daysAway).toBeGreaterThanOrEqual(list[i - 1].daysAway);
    }
  });
});

describe('isCalendarStale', () => {
  it('is fresh during the 2026/27 season', () => {
    expect(isCalendarStale(new Date('2026-07-07T12:00:00Z'))).toBe(false);
  });
  it('goes stale well past the last window', () => {
    expect(isCalendarStale(new Date('2027-03-01T12:00:00Z'))).toBe(true);
  });
});
