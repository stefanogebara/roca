/**
 * WGS84 → UTM. É a peça que decide QUAL pixel do satélite a gente lê.
 *
 * Um erro aqui não quebra nada: devolve o NDVI de um lugar errado, com cara de
 * certo. O produtor recebe "sua lavoura está com vigor bom" sobre o pasto do
 * vizinho. Por isso os testes aqui são de invariante e de ida-e-volta, não de
 * "rodou sem erro".
 */
import { describe, it, expect } from 'vitest';
import { utmZone, latLonToUtm, utmToLatLon } from '../api/_lib/tools/utm';

describe('utmZone', () => {
  it('calcula a zona a partir da longitude', () => {
    expect(utmZone(-45.43)).toBe(23); // Sul de Minas
    expect(utmZone(-3)).toBe(30);
    expect(utmZone(3)).toBe(31);
    expect(utmZone(-180)).toBe(1);
    expect(utmZone(179.9)).toBe(60);
  });
});

describe('latLonToUtm — invariantes que não dependem de tabela externa', () => {
  it('no meridiano central o easting é exatamente 500.000', () => {
    // Zona 23 tem meridiano central em -45°.
    const p = latLonToUtm(-21.5, -45);
    expect(p.easting).toBeCloseTo(500_000, 1);
    expect(p.zone).toBe(23);
  });

  it('no equador, hemisfério norte, o northing é 0', () => {
    expect(latLonToUtm(0, -45).northing).toBeCloseTo(0, 1);
  });

  it('no hemisfério SUL o northing usa o falso norte de 10.000.000', () => {
    const p = latLonToUtm(-21.5, -45.43);
    expect(p.south).toBe(true);
    // ~21,5° ao sul do equador ≈ 2.378 km → 10.000.000 − 2.378.000.
    expect(p.northing).toBeGreaterThan(7_500_000);
    expect(p.northing).toBeLessThan(7_700_000);
  });

  it('a leste do meridiano central o easting cresce; a oeste, diminui', () => {
    const oeste = latLonToUtm(-21.5, -45.4);
    const leste = latLonToUtm(-21.5, -44.6);
    expect(oeste.easting).toBeLessThan(500_000);
    expect(leste.easting).toBeGreaterThan(500_000);
  });
});

describe('ida e volta — o teste que pega erro de sinal e de série', () => {
  const pontos: Array<[number, number, string]> = [
    [-21.5556, -45.4300, 'Varginha MG'],
    [-21.4256, -45.9470, 'Alfenas MG'],
    [-15.7939, -47.8828, 'Brasília'],
    [-3.1190, -60.0217, 'Manaus'],
    [-30.0346, -51.2177, 'Porto Alegre'],
    [10.0, -66.0, 'hemisfério norte'],
  ];

  for (const [lat, lon, nome] of pontos) {
    it(`volta ao ponto original: ${nome}`, () => {
      const p = latLonToUtm(lat, lon);
      const v = utmToLatLon(p.easting, p.northing, p.zone, p.south);
      // 1e-6 grau ≈ 11 cm. O pixel do Sentinel-2 tem 10 m.
      expect(v.lat).toBeCloseTo(lat, 6);
      expect(v.lon).toBeCloseTo(lon, 6);
    });
  }
});

describe('precisão suficiente pro pixel de 10 m', () => {
  it('30 m no terreno viram ~30 m em UTM (a grade de amostragem depende disso)', () => {
    const a = latLonToUtm(-21.5556, -45.43);
    // 30 m em latitude ≈ 30/111320 grau.
    const b = latLonToUtm(-21.5556 + 30 / 111_320, -45.43);
    const d = Math.hypot(b.easting - a.easting, b.northing - a.northing);
    expect(d).toBeGreaterThan(29);
    expect(d).toBeLessThan(31);
  });
});
