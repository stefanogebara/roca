/**
 * Sentinel-2 NDVI — a field-vigor read for the farmer's pin (dossier Stage 3).
 *
 * NDVI = (NIR − Red) / (NIR + Red): healthy chlorophyll reflects near-infrared
 * strongly while absorbing red, so the ratio is a vegetation-vigor proxy visible
 * from space. Because it's a ratio, raw digital numbers work — no reflectance
 * scaling needed.
 *
 * Data path (free, no key): Earth Search STAC finds the latest low-cloud
 * Sentinel-2 L2A scene over the point; a hosted titiler reads the Red (B04) and
 * NIR (B08) COGs at exact lon/lat, handling the UTM reprojection for us.
 *
 * A single 10 m pixel is noise. `fetchFieldNdvi` samples a small grid of
 * independent pixels around the pin from the *same* scene and aggregates them —
 * giving (a) a field-representative mean instead of one pixel, (b) a spread that
 * reads as field uniformity, and (c) resilience, since one failed pixel read no
 * longer nulls the whole reply. Everything fails soft to null (like soil) — a
 * satellite hiccup never blocks a farmer's answer. ⚠️ Production should self-host
 * titiler or move to GEE (Startups program) rather than lean on the demo instance.
 */

import { createLogger } from '../logger';

const log = createLogger('ndvi');

const STAC_URL = 'https://earth-search.aws.element84.com/v1/search';
const TITILER_POINT = 'https://titiler.xyz/cog/point';
const TIMEOUT_MS = 9000;
const LOOKBACK_DAYS = 75;

/** Field-sampling grid: a (2·ring+1)² lattice at GRID_SPACING_M between points. */
const GRID_RING = 1; // 3×3 = 9 pixels
const GRID_SPACING_M = 30; // 3 Sentinel pixels apart → independent, ~60×60 m span
const POINT_CONCURRENCY = 5; // gentle on the public titiler; avoids 429 bursts
/** Below this many resolved pixels, spread is too noisy to call uniformity. */
export const UNIFORMITY_MIN_SAMPLES = 5;

export interface NdviReading {
  ndvi: number;
  /** Scene date, YYYY-MM-DD. */
  date: string;
  /** Scene cloud cover %, rounded. */
  cloud: number;
}

/** Area-mean read: the field vigor plus how uniform it is across the grid. */
export interface FieldNdviReading {
  /** Area-mean NDVI over the resolved grid pixels, rounded 2dp. */
  ndvi: number;
  /** Std of NDVI across the grid — the uniformity signal, rounded 3dp. */
  std: number;
  /** How many grid pixels actually resolved (≤ grid size). */
  samples: number;
  date: string;
  cloud: number;
}

export interface VigorClass {
  label: string;
  emoji: string;
  note: string;
}

export interface Uniformity {
  label: string;
  note: string;
}

/**
 * Plain-language vigor bands. Crop-agnostic and deliberately hedged — even an
 * area mean is a proxy, not a verdict.
 */
export function classifyVigor(ndvi: number): VigorClass {
  if (ndvi < 0.15) {
    return {
      label: 'solo praticamente exposto',
      emoji: '🟤',
      note: 'Pouca ou nenhuma vegetação ativa nesse ponto — pode ser entressafra, pós-colheita, área recém-plantada ou solo mesmo.',
    };
  }
  if (ndvi < 0.3) {
    return {
      label: 'vegetação rala',
      emoji: '🟡',
      note: 'Cobertura baixa — início de cultura, rebrota, ou possível estresse. Vale olhar de perto.',
    };
  }
  if (ndvi < 0.5) {
    return {
      label: 'desenvolvimento moderado',
      emoji: '🌱',
      note: 'A lavoura está se desenvolvendo, mas ainda não fechou o dossel.',
    };
  }
  if (ndvi < 0.7) {
    return {
      label: 'lavoura vigorosa',
      emoji: '🟢',
      note: 'Boa massa verde e atividade fotossintética — sinal de lavoura saudável.',
    };
  }
  return {
    label: 'vigor alto, dossel fechado',
    emoji: '🟢',
    note: 'Vegetação muito densa e ativa.',
  };
}

/**
 * Field uniformity from the NDVI spread across the sampled grid. Thresholds are
 * heuristic and the language is hedged — the value is flagging *where to look*,
 * not quantifying anything.
 */
export function classifyUniformity(std: number): Uniformity {
  if (std < 0.06) {
    return {
      label: 'lavoura parelha',
      note: 'O vigor está uniforme no entorno do ponto — desenvolvimento homogêneo.',
    };
  }
  if (std < 0.13) {
    return {
      label: 'alguma variação',
      note: 'Há diferença de vigor entre as partes — pode ser relevo, umidade ou manejo. Vale olhar as partes mais fracas.',
    };
  }
  return {
    label: 'áreas desiguais',
    note: 'O vigor varia bastante no entorno — há zonas visivelmente mais fracas. Vale investigar essas manchas no campo (falha de plantio, compactação, praga localizada ou água).',
  };
}

/**
 * A (2·ring+1)² lattice of [lat, lon] around a center, `spacingM` metres apart.
 * Longitude spacing is scaled by cos(lat) so the ground distance is isotropic.
 * Pure — the center is always included (i=j=0).
 */
export function gridPoints(
  lat: number,
  lon: number,
  spacingM: number,
  ring = GRID_RING
): Array<[number, number]> {
  const dLat = spacingM / 111_320;
  const dLon = spacingM / (111_320 * Math.cos((lat * Math.PI) / 180));
  const pts: Array<[number, number]> = [];
  for (let i = -ring; i <= ring; i++) {
    for (let j = -ring; j <= ring; j++) {
      pts.push([lat + i * dLat, lon + j * dLon]);
    }
  }
  return pts;
}

/**
 * Mean + population std of a set of NDVI samples. Returns null if empty. Pure;
 * no rounding here so the math stays exact for callers and tests.
 */
export function aggregateNdvi(
  values: number[]
): { mean: number; std: number; samples: number } | null {
  const v = values.filter((x) => Number.isFinite(x));
  if (v.length === 0) return null;
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const variance = v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length;
  return { mean, std: Math.sqrt(variance), samples: v.length };
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`${url.slice(0, 60)} → ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function pointValue(cogUrl: string, lat: number, lon: number): Promise<number | null> {
  const url = `${TITILER_POINT}/${lon},${lat}?url=${encodeURIComponent(cogUrl)}`;
  const data = (await fetchJson(url)) as { values?: number[] };
  const v = data.values?.[0];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

interface Scene {
  red: string;
  nir: string;
  date: string;
  cloud: number;
}

/** Find the latest low-cloud Sentinel-2 scene covering the point, or null. */
async function findLatestScene(lat: number, lon: number): Promise<Scene | null> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);
  const search = (await fetchJson(STAC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      collections: ['sentinel-2-l2a'],
      bbox: [lon - 0.02, lat - 0.02, lon + 0.02, lat + 0.02],
      datetime: `${since}T00:00:00Z/..`,
      query: { 'eo:cloud_cover': { lt: 40 } },
      sortby: [{ field: 'properties.eo:cloud_cover', direction: 'asc' }],
      limit: 1,
    }),
  })) as {
    features?: Array<{
      properties: { datetime: string; 'eo:cloud_cover'?: number };
      assets: { red?: { href: string }; nir?: { href: string } };
    }>;
  };

  const item = search.features?.[0];
  const red = item?.assets.red?.href;
  const nir = item?.assets.nir?.href;
  if (!item || !red || !nir) return null;
  return {
    red,
    nir,
    date: item.properties.datetime.slice(0, 10),
    cloud: Math.round(item.properties['eo:cloud_cover'] ?? 0),
  };
}

/** NDVI at one lon/lat from a resolved scene, or null if a band read fails. */
async function pointNdvi(scene: Scene, lat: number, lon: number): Promise<number | null> {
  const [rv, nv] = await Promise.all([
    pointValue(scene.red, lat, lon),
    pointValue(scene.nir, lat, lon),
  ]);
  if (rv == null || nv == null || rv + nv === 0) return null;
  const ndvi = (nv - rv) / (nv + rv);
  return Number.isFinite(ndvi) ? ndvi : null;
}

/** Run `fn` over items with a bounded number in flight (pool of workers). */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Latest low-cloud Sentinel-2 NDVI at a single point. Returns null on any
 * failure (no recent clear scene, service down, missing bands). Kept as the
 * lightweight point primitive; farmer replies use `fetchFieldNdvi`.
 */
export async function fetchNdvi(lat: number, lon: number): Promise<NdviReading | null> {
  try {
    const scene = await findLatestScene(lat, lon);
    if (!scene) return null;
    const ndvi = await pointNdvi(scene, lat, lon);
    if (ndvi == null) return null;
    return { ndvi: Number(ndvi.toFixed(2)), date: scene.date, cloud: scene.cloud };
  } catch (e) {
    log.error('fetchNdvi failed:', (e as Error).message);
    return null;
  }
}

/**
 * Area-mean NDVI over a grid of independent pixels around the pin, from the
 * latest low-cloud scene. Aggregates whatever pixels resolve (resilient to a
 * few failed reads); returns null only if the scene or every pixel fails.
 */
export async function fetchFieldNdvi(lat: number, lon: number): Promise<FieldNdviReading | null> {
  try {
    const scene = await findLatestScene(lat, lon);
    if (!scene) return null;

    const pts = gridPoints(lat, lon, GRID_SPACING_M, GRID_RING);
    const values = await mapWithConcurrency(pts, POINT_CONCURRENCY, (p) =>
      pointNdvi(scene, p[0], p[1])
    );
    const agg = aggregateNdvi(values.filter((x): x is number => x != null));
    if (!agg) return null;

    return {
      ndvi: Number(agg.mean.toFixed(2)),
      std: Number(agg.std.toFixed(3)),
      samples: agg.samples,
      date: scene.date,
      cloud: scene.cloud,
    };
  } catch (e) {
    log.error('fetchFieldNdvi failed:', (e as Error).message);
    return null;
  }
}
