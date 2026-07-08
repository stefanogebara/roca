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
 * NIR (B08) COGs at the exact lon/lat, handling the UTM reprojection for us.
 * Everything fails soft to null (like soil) — a satellite hiccup never blocks a
 * reply. ⚠️ Production should self-host titiler or move to GEE (Startups program)
 * rather than lean on the public demo instance.
 */

import { createLogger } from '../logger';

const log = createLogger('ndvi');

const STAC_URL = 'https://earth-search.aws.element84.com/v1/search';
const TITILER_POINT = 'https://titiler.xyz/cog/point';
const TIMEOUT_MS = 9000;
const LOOKBACK_DAYS = 75;

export interface NdviReading {
  ndvi: number;
  /** Scene date, YYYY-MM-DD. */
  date: string;
  /** Scene cloud cover %, rounded. */
  cloud: number;
}

export interface VigorClass {
  label: string;
  emoji: string;
  note: string;
}

/**
 * Plain-language vigor bands. Crop-agnostic and deliberately hedged — a single
 * 10 m pixel is indicative, not a verdict.
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

/**
 * Latest low-cloud Sentinel-2 NDVI at a point. Returns null on any failure
 * (no recent clear scene, service down, missing bands).
 */
export async function fetchNdvi(lat: number, lon: number): Promise<NdviReading | null> {
  try {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000)
      .toISOString()
      .slice(0, 10);
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

    const [rv, nv] = await Promise.all([
      pointValue(red, lat, lon),
      pointValue(nir, lat, lon),
    ]);
    if (rv == null || nv == null || rv + nv === 0) return null;

    const ndvi = (nv - rv) / (nv + rv);
    if (!Number.isFinite(ndvi)) return null;

    return {
      ndvi: Number(ndvi.toFixed(2)),
      date: item.properties.datetime.slice(0, 10),
      cloud: Math.round(item.properties['eo:cloud_cover'] ?? 0),
    };
  } catch (e) {
    log.error('fetchNdvi failed:', (e as Error).message);
    return null;
  }
}
