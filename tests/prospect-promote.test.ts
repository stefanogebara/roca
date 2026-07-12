/**
 * Prospect → partner promotion: the pure halves. The geocode picker must never
 * return wrong-state coordinates (a bad centroid silently mis-routes farmer
 * leads), and the partner draft must land in the same crop vocabulary the farm
 * matcher uses (exact-label overlap in partnerCovers).
 */
import { describe, it, expect } from 'vitest';
import { pickBrazilHit, type GeocodeHit } from '../api/_lib/tools/geo';
import { partnerFromProspect } from '../api/_lib/prospect/promote';

const hit = (over: Partial<GeocodeHit> = {}): GeocodeHit => ({
  name: 'Varginha',
  latitude: -21.55,
  longitude: -45.43,
  country_code: 'BR',
  admin1: 'Minas Gerais',
  ...over,
});

describe('pickBrazilHit', () => {
  it('ignores non-Brazilian results entirely', () => {
    expect(pickBrazilHit([hit({ country_code: 'PT' })], 'Varginha', null)).toBeNull();
    expect(pickBrazilHit([hit({ country_code: 'US' }), hit()], 'Varginha', null)?.admin1).toBe('Minas Gerais');
  });

  it('rejects alternate-name hits — the hit must be NAMED like the queried city', () => {
    // Live failure mode: querying "Bom Jesus" ranks Crisópolis-BA (which only
    // CARRIES the name as an alias) above the real Bom Jesus towns.
    const alias = hit({ name: 'Crisópolis', admin1: 'Bahia', latitude: -11.51 });
    const real = hit({ name: 'Bom Jesus da Serra', admin1: 'Bahia', latitude: -14.37 });
    expect(pickBrazilHit([alias, real], 'Bom Jesus', 'BA')?.latitude).toBe(-14.37);
    expect(pickBrazilHit([alias], 'Bom Jesus', 'BA')).toBeNull();
  });

  it('prefers an exact-name hit over a prefix hit', () => {
    const prefix = hit({ name: 'Bom Jesus de Goiás', admin1: 'Goiás', latitude: -18 });
    const exact = hit({ name: 'Bom Jesus', admin1: 'Goiás', latitude: -15 });
    expect(pickBrazilHit([prefix, exact], 'Bom Jesus', 'GO')?.latitude).toBe(-15);
    // Prefix alone still resolves ("Bom Jesus de Goiás" for "Bom Jesus").
    expect(pickBrazilHit([prefix], 'Bom Jesus', 'GO')?.latitude).toBe(-18);
  });

  it('prefers the hit in the given UF (accent/case-insensitive)', () => {
    const sp = hit({ name: 'Bom Jesus', admin1: 'São Paulo', latitude: -23 });
    const pi = hit({ name: 'Bom Jesus', admin1: 'Piauí', latitude: -9 });
    expect(pickBrazilHit([sp, pi], 'Bom Jesus', 'PI')?.latitude).toBe(-9);
    expect(pickBrazilHit([sp, pi], 'Bom Jesus', 'sp')?.latitude).toBe(-23);
  });

  it('returns null (not a wrong-state guess) when the UF is given but unmatched', () => {
    const sp = hit({ admin1: 'São Paulo' });
    expect(pickBrazilHit([sp], 'Varginha', 'MG')).toBeNull();
  });

  it('with no UF, refuses to guess among homonyms across states', () => {
    const sp = hit({ name: 'Bom Jesus', admin1: 'São Paulo' });
    const pi = hit({ name: 'Bom Jesus', admin1: 'Piauí' });
    expect(pickBrazilHit([sp, pi], 'Bom Jesus', null)).toBeNull();
    expect(pickBrazilHit([sp], 'Bom Jesus', null)?.admin1).toBe('São Paulo');
  });

  it('treats a free-text non-UF value ("MINAS GERAIS") as no UF, not as reject-everything', () => {
    const only = hit({ name: 'Varginha', admin1: 'Minas Gerais' });
    expect(pickBrazilHit([only], 'Varginha', 'MINAS GERAIS')?.latitude).toBe(-21.55);
    const sp = hit({ name: 'Bom Jesus', admin1: 'São Paulo' });
    const pi = hit({ name: 'Bom Jesus', admin1: 'Piauí' });
    expect(pickBrazilHit([sp, pi], 'Bom Jesus', 'PIAUI STATE')).toBeNull(); // ambiguous → refuse
  });
});

describe('partnerFromProspect', () => {
  const base = { name: 'AgroVale Consultoria', phone: '+5535999990000', city: 'Varginha', uf: 'MG' };

  it('requires a phone (the partner channel IS the phone)', () => {
    const d = partnerFromProspect({ ...base, phone: null }, null);
    expect('error' in d).toBe(true);
  });

  it('builds coverage from the mined qualification, falling back to city/UF', () => {
    const mined = partnerFromProspect(base, { coverage: ['Varginha e região', 'Três Pontas'] });
    expect('error' in mined ? null : mined.coverage_label).toBe('Varginha e região, Três Pontas');
    const fallback = partnerFromProspect(base, null);
    expect('error' in fallback ? null : fallback.coverage_label).toBe('Varginha, MG');
  });

  it('normalizes mined crops into the farm vocabulary (exact-label matcher)', () => {
    const d = partnerFromProspect(base, { crops: ['Café e citros', 'laranja'] });
    expect('error' in d ? null : d.crops).toEqual(['café', 'citros']);
  });

  it('leaves crops null when nothing is recognizable — matches any crop, never a wrong one', () => {
    const d = partnerFromProspect(base, { crops: ['hidroponia de morango'] });
    expect('error' in d ? null : d.crops).toBeNull();
  });

  it('defaults the coverage radius to 60 km', () => {
    const d = partnerFromProspect(base, null);
    expect('error' in d ? null : d.radius_km).toBe(60);
  });

  it('caps and whitespace-collapses the coverage label (it lands in farmer-facing copy)', () => {
    const d = partnerFromProspect(base, { coverage: ['região   de\nVarginha', 'x'.repeat(200)] });
    const label = 'error' in d ? '' : d.coverage_label!;
    expect(label.length).toBeLessThanOrEqual(80);
    expect(label).not.toMatch(/\s{2}|\n/);
  });
});
