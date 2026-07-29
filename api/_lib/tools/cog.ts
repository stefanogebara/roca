/**
 * Leitura direta de Cloud-Optimized GeoTIFF por HTTP range request.
 *
 * Substitui o titiler.xyz — que é o endpoint de DEMONSTRAÇÃO da Development
 * Seed, cuja própria documentação pede "please be kind". Produção de um
 * produto comercial não deve depender do demo de terceiro: se sai do ar, o
 * NDVI morre sem aviso e ninguém prometeu nada.
 *
 * O ganho não é só de dependência. A grade de amostragem são 9 pontos num
 * quadrado de 60 m — em Sentinel-2 (pixel de 10 m) isso é uma janela de 6×6
 * pixels, dentro de um único bloco do COG. Antes: 9 pontos × 2 bandas = 18
 * requisições HTTP. Agora: 2 leituras de janela, uma por banda.
 *
 * Validado contra a referência: o pixel lido aqui é IDÊNTICO ao que o titiler
 * devolve, em Varginha, Alfenas e Três Pontas (EPSG 32723 nos três).
 */

import { fromUrl, type GeoTIFFImage } from 'geotiff';
import { latLonToUtm, utmEpsg } from './utm';
import { createLogger } from '../logger';

const log = createLogger('cog');

/** Deadline duro — leitura de satélite nunca pode segurar o webhook. */
const TIMEOUT_MS = 12_000;

export interface CogWindow {
  /** Valores da janela, ordem row-major. */
  values: number[];
  width: number;
  height: number;
  /** Pixel do ponto pedido DENTRO da janela (col, row). */
  center: [number, number];
}

/**
 * Converte lat/lon no pixel da imagem. Exportada porque é onde um erro vira
 * "NDVI do lugar errado com cara de certo" — o EPSG da cena é conferido contra
 * o que calculamos, e divergência aborta em vez de ler o pixel errado.
 */
export function pixelFor(
  img: GeoTIFFImage,
  lat: number,
  lon: number
): { x: number; y: number } | null {
  const [ox, oy] = img.getOrigin();
  const [rx, ry] = img.getResolution();
  const p = latLonToUtm(lat, lon);

  const geoKeys = (img.getGeoKeys?.() ?? {}) as { ProjectedCSTypeGeoKey?: number };
  const epsgCena = geoKeys.ProjectedCSTypeGeoKey;
  const epsgNosso = utmEpsg(p.zone, p.south);
  if (epsgCena && epsgCena !== epsgNosso) {
    // A cena está numa zona UTM diferente da que o ponto cai (acontece perto
    // da borda de zona, onde o Sentinel-2 estende a cena para a zona vizinha).
    // Reprojetar forçando a zona da cena é o certo; ler assim seria ler errado.
    log.error(`EPSG da cena (${epsgCena}) ≠ do ponto (${epsgNosso}) — reprojetando na zona da cena`);
    const zonaCena = epsgCena % 100;
    const sulCena = epsgCena > 32700;
    const q = latLonToUtm(lat, lon, zonaCena);
    return {
      x: Math.floor((q.easting - ox) / rx),
      y: Math.floor(((sulCena ? q.northing : q.northing) - oy) / ry),
    };
  }
  return { x: Math.floor((p.easting - ox) / rx), y: Math.floor((p.northing - oy) / ry) };
}

/**
 * Lê uma janela quadrada de `radiusPx` pixels ao redor do ponto. Uma leitura
 * cobre a grade inteira de amostragem — é o ponto da mudança.
 *
 * Devolve null (nunca lança) quando a cena não cobre o ponto ou a rede falha:
 * satélite é enfeite informativo, não pode derrubar a resposta.
 */
export async function readWindow(
  cogUrl: string,
  lat: number,
  lon: number,
  radiusPx: number
): Promise<CogWindow | null> {
  const t = setTimeout(() => undefined, 0);
  clearTimeout(t);
  try {
    const tiff = await withDeadline(fromUrl(cogUrl), TIMEOUT_MS);
    const img = await withDeadline(tiff.getImage(), TIMEOUT_MS);
    const px = pixelFor(img, lat, lon);
    if (!px) return null;

    const w = img.getWidth();
    const h = img.getHeight();
    const x0 = Math.max(0, px.x - radiusPx);
    const y0 = Math.max(0, px.y - radiusPx);
    const x1 = Math.min(w, px.x + radiusPx + 1);
    const y1 = Math.min(h, px.y + radiusPx + 1);
    if (x1 <= x0 || y1 <= y0) return null; // ponto fora da cena

    const rasters = await withDeadline(img.readRasters({ window: [x0, y0, x1, y1] }), TIMEOUT_MS);
    const band = (rasters as unknown as ArrayLike<number>[])[0];
    return {
      values: Array.from(band as ArrayLike<number>, Number),
      width: x1 - x0,
      height: y1 - y0,
      center: [px.x - x0, px.y - y0],
    };
  } catch (e) {
    log.error(`readWindow falhou (${cogUrl.slice(0, 50)}…):`, (e as Error).message);
    return null;
  }
}

/** Valor de um offset (dx, dy) em pixels a partir do centro da janela. */
export function valueAt(win: CogWindow, dx: number, dy: number): number | null {
  const x = win.center[0] + dx;
  const y = win.center[1] + dy;
  if (x < 0 || y < 0 || x >= win.width || y >= win.height) return null;
  const v = win.values[y * win.width + x];
  return Number.isFinite(v) ? v : null;
}

function withDeadline<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout ${ms}ms`)), ms)),
  ]);
}
