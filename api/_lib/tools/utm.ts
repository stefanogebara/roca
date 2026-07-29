/**
 * WGS84 ↔ UTM. Puro, sem dependência.
 *
 * Existe porque as cenas Sentinel-2 são distribuídas em UTM, e para ler o NDVI
 * de um pixel a gente precisa converter o pino do produtor (lat/lon) na
 * coordenada da imagem. Antes isso era feito por um servidor de tiles público
 * (titiler.xyz, endpoint de DEMONSTRAÇÃO da Development Seed) a 18 requisições
 * por resposta — 9 pontos da grade × 2 bandas.
 *
 * Um erro aqui não quebra: devolve o NDVI de OUTRO lugar, com cara de certo. O
 * produtor leria "vigor bom" sobre o pasto do vizinho. Daí os testes serem de
 * invariante e ida-e-volta.
 *
 * Séries de Krüger até 4ª ordem (padrão Snyder / USGS 1395). Precisão
 * sub-métrica dentro da zona, muito além do pixel de 10 m do Sentinel-2.
 */

const A = 6378137.0; // semi-eixo maior WGS84
const F = 1 / 298.257223563; // achatamento
const K0 = 0.9996; // fator de escala UTM
const E2 = F * (2 - F); // excentricidade²
const EP2 = E2 / (1 - E2); // excentricidade² segunda
const FALSE_EASTING = 500_000;
const FALSE_NORTHING_SOUTH = 10_000_000;

const rad = (d: number): number => (d * Math.PI) / 180;
const deg = (r: number): number => (r * 180) / Math.PI;

/** Zona UTM (1–60) da longitude. */
export function utmZone(lon: number): number {
  // Normaliza para [-180, 180) antes de fatiar em faixas de 6°.
  const l = ((((lon + 180) % 360) + 360) % 360) - 180;
  return Math.floor((l + 180) / 6) + 1;
}

/** Meridiano central da zona, em graus. */
const centralMeridian = (zone: number): number => (zone - 1) * 6 - 180 + 3;

/** Comprimento de arco meridional do equador até `lat` (radianos). */
function meridionalArc(latRad: number): number {
  return (
    A *
    ((1 - E2 / 4 - (3 * E2 * E2) / 64 - (5 * E2 * E2 * E2) / 256) * latRad -
      ((3 * E2) / 8 + (3 * E2 * E2) / 32 + (45 * E2 * E2 * E2) / 1024) * Math.sin(2 * latRad) +
      ((15 * E2 * E2) / 256 + (45 * E2 * E2 * E2) / 1024) * Math.sin(4 * latRad) -
      ((35 * E2 * E2 * E2) / 3072) * Math.sin(6 * latRad))
  );
}

export interface UtmPoint {
  easting: number;
  northing: number;
  zone: number;
  /** Hemisfério sul — muda o falso norte e o EPSG (327xx em vez de 326xx). */
  south: boolean;
}

/** Projeta lat/lon (graus, WGS84) em UTM. */
export function latLonToUtm(lat: number, lon: number, forceZone?: number): UtmPoint {
  const zone = forceZone ?? utmZone(lon);
  const φ = rad(lat);
  const λ = rad(lon);
  const λ0 = rad(centralMeridian(zone));

  const N = A / Math.sqrt(1 - E2 * Math.sin(φ) ** 2);
  const T = Math.tan(φ) ** 2;
  const C = EP2 * Math.cos(φ) ** 2;
  const Aa = Math.cos(φ) * (λ - λ0);
  const M = meridionalArc(φ);

  const easting =
    K0 *
      N *
      (Aa +
        ((1 - T + C) * Aa ** 3) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * EP2) * Aa ** 5) / 120) +
    FALSE_EASTING;

  let northing =
    K0 *
    (M +
      N *
        Math.tan(φ) *
        (Aa ** 2 / 2 +
          ((5 - T + 9 * C + 4 * C * C) * Aa ** 4) / 24 +
          ((61 - 58 * T + T * T + 600 * C - 330 * EP2) * Aa ** 6) / 720));

  const south = lat < 0;
  if (south) northing += FALSE_NORTHING_SOUTH;

  return { easting, northing, zone, south };
}

/** Inverso — usado nos testes de ida-e-volta e para depurar leitura de pixel. */
export function utmToLatLon(
  easting: number,
  northing: number,
  zone: number,
  south: boolean
): { lat: number; lon: number } {
  const x = easting - FALSE_EASTING;
  const y = south ? northing - FALSE_NORTHING_SOUTH : northing;

  const M = y / K0;
  const mu = M / (A * (1 - E2 / 4 - (3 * E2 * E2) / 64 - (5 * E2 * E2 * E2) / 256));
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));

  const φ1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);

  const N1 = A / Math.sqrt(1 - E2 * Math.sin(φ1) ** 2);
  const T1 = Math.tan(φ1) ** 2;
  const C1 = EP2 * Math.cos(φ1) ** 2;
  const R1 = (A * (1 - E2)) / (1 - E2 * Math.sin(φ1) ** 2) ** 1.5;
  const D = x / (N1 * K0);

  const lat =
    φ1 -
    ((N1 * Math.tan(φ1)) / R1) *
      (D ** 2 / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) * D ** 6) / 720);

  const lon =
    rad(centralMeridian(zone)) +
    (D -
      ((1 + 2 * T1 + C1) * D ** 3) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * D ** 5) / 120) /
      Math.cos(φ1);

  return { lat: deg(lat), lon: deg(lon) };
}

/**
 * EPSG da zona — 326xx no norte, 327xx no sul. É o código que aparece nas
 * GeoKeys do COG do Sentinel-2, e serve para confirmar que estamos projetando
 * na MESMA zona em que a cena foi distribuída.
 */
export function utmEpsg(zone: number, south: boolean): number {
  return (south ? 32700 : 32600) + zone;
}
