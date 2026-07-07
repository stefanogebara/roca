/**
 * SoilGrids (ISRIC) soil properties for a point. Free, CC-BY, 250 m grid.
 * ⚠️ The public REST API has known outages — every call here fails soft to null
 * and results are cached permanently per farm (soil doesn't change on our
 * timescale). Never block a reply on this.
 */

import { createLogger } from '../logger';

const log = createLogger('soil');

const SOILGRIDS_URL = 'https://rest.isric.org/soilgrids/v2.0/properties/query';
const TIMEOUT_MS = 6000;

export interface SoilReading {
  /** pH in water, topsoil (0–15 cm blend). */
  ph: number | null;
  /** Clay %, topsoil. */
  clayPct: number | null;
  /** Sand %, topsoil. */
  sandPct: number | null;
}

interface SoilGridsLayer {
  name: string;
  depths: Array<{ label: string; values: { mean: number | null } }>;
}

/** Mean of the first two depth slices (0–5, 5–15 cm), un-scaled. */
function topsoilMean(layer: SoilGridsLayer | undefined, divisor: number): number | null {
  if (!layer) return null;
  const vals = layer.depths
    .slice(0, 2)
    .map((d) => d.values.mean)
    .filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Number((mean / divisor).toFixed(1));
}

/** Fetch topsoil pH/clay/sand for a point. Returns null on any failure. */
export async function fetchSoil(lat: number, lon: number): Promise<SoilReading | null> {
  const params = new URLSearchParams({ lon: String(lon), lat: String(lat), value: 'mean' });
  for (const p of ['phh2o', 'clay', 'sand']) params.append('property', p);
  for (const d of ['0-5cm', '5-15cm']) params.append('depth', d);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${SOILGRIDS_URL}?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      log.error(`SoilGrids returned ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      properties?: { layers?: SoilGridsLayer[] };
    };
    const layers = data.properties?.layers ?? [];
    const find = (name: string) => layers.find((l) => l.name === name);
    // SoilGrids scaling: phh2o ×10; clay/sand in g/kg (÷10 → %).
    const reading: SoilReading = {
      ph: topsoilMean(find('phh2o'), 10),
      clayPct: topsoilMean(find('clay'), 10),
      sandPct: topsoilMean(find('sand'), 10),
    };
    if (reading.ph == null && reading.clayPct == null && reading.sandPct == null) {
      return null;
    }
    return reading;
  } catch (e) {
    log.error('SoilGrids fetch failed:', (e as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Plain-language texture class from clay/sand %, Brazilian field vocabulary. */
export function textureLabel(soil: SoilReading): string | null {
  const { clayPct, sandPct } = soil;
  if (clayPct == null || sandPct == null) return null;
  if (clayPct >= 35) return 'argiloso (terra pesada)';
  if (sandPct >= 70) return 'arenoso (terra leve)';
  return 'textura média';
}
