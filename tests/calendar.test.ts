import { describe, it, expect } from 'vitest';
import { vazioStatus, VAZIO_SOJA_2026 } from '../api/_lib/tools/calendar';

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
