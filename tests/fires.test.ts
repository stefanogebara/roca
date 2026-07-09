import { describe, it, expect } from 'vitest';
import { haversineKm, firesNear, parseFireCsv } from '../api/_lib/tools/fires';
import { buildFireAlertText, fireDedupKey } from '../api/_lib/alerts';

describe('haversineKm', () => {
  it('measures known distances within tolerance', () => {
    // Varginha → Três Corações is ~25km
    const d = haversineKm({ lat: -21.55, lon: -45.43 }, { lat: -21.7, lon: -45.25 });
    expect(d).toBeGreaterThan(20);
    expect(d).toBeLessThan(30);
  });
  it('is zero for the same point', () => {
    expect(haversineKm({ lat: -12.5, lon: -55.7 }, { lat: -12.5, lon: -55.7 })).toBe(0);
  });
});

describe('parseFireCsv', () => {
  it('extracts lat/lon/municipio rows and skips malformed lines', () => {
    const csv = [
      'id,lat,lon,data_hora_gmt,satelite,municipio,estado,pais',
      'a1, -12.933700, -49.474400,2026-07-09 00:00:00,GOES-19,ARAGUAÇU,TOCANTINS,Brasil',
      'bad line without commas enough',
      'a2, -21.560000, -45.440000,2026-07-09 00:10:00,GOES-19,VARGINHA,MINAS GERAIS,Brasil',
    ].join('\n');
    const fires = parseFireCsv(csv);
    expect(fires).toHaveLength(2);
    expect(fires[1]).toEqual({ lat: -21.56, lon: -45.44, municipio: 'VARGINHA' });
  });
});

describe('firesNear', () => {
  const fires = [
    { lat: -21.56, lon: -45.44, municipio: 'VARGINHA' }, // ~1.4km from farm
    { lat: -21.9, lon: -45.9, municipio: 'LONGE' }, // ~60km away
    { lat: -12.9, lon: -49.4, municipio: 'ARAGUAÇU' }, // another state
  ];
  const farm = { lat: -21.55, lon: -45.43 };

  it('finds only fires within the radius, nearest first', () => {
    const near = firesNear(fires, farm, 10);
    expect(near).toHaveLength(1);
    expect(near[0].municipio).toBe('VARGINHA');
    expect(near[0].distanceKm).toBeGreaterThan(0.5);
    expect(near[0].distanceKm).toBeLessThan(3);
  });

  it('returns empty when nothing is close', () => {
    expect(firesNear(fires, { lat: 2.8, lon: -60.7 }, 10)).toEqual([]);
  });
});

describe('buildFireAlertText', () => {
  it('states count, distance, municipio and cites INPE', () => {
    const t = buildFireAlertText([
      { lat: 0, lon: 0, municipio: 'VARGINHA', distanceKm: 1.4 },
      { lat: 0, lon: 0, municipio: 'VARGINHA', distanceKm: 6.2 },
    ]);
    expect(t).toMatch(/🔥/);
    expect(t).toContain('2 foco');
    expect(t).toMatch(/1,4\s?km/);
    expect(t).toMatch(/INPE/);
    expect(t).not.toMatch(/aplique|\d+\s?l\/ha/i);
  });
  it('singular form for one focus', () => {
    const t = buildFireAlertText([{ lat: 0, lon: 0, municipio: 'X', distanceKm: 3 }]);
    expect(t).toContain('1 foco');
    expect(t).not.toContain('focos');
  });
});

describe('fireDedupKey', () => {
  it('is per calendar date', () => {
    expect(fireDedupKey('2026-07-09')).toBe('fire:2026-07-09');
  });
});
