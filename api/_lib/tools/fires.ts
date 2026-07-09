/**
 * Fire (queimada) detections near a farm — INPE Queimadas open data.
 *
 * Source: the public daily CSV of satellite fire detections for Brazil
 * (dataserver-coids.inpe.br, no auth). The JSON API was decommissioned; the
 * CSV dataserver is the stable public interface. One file per day, one row per
 * detection (lat/lon/satellite/município). We fetch once per monitor run and
 * geofence every farm pin against it.
 */

import type { Coordinates } from './weather';

const BASE = 'https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/diario/Brasil';

export interface FirePoint {
  lat: number;
  lon: number;
  municipio: string;
}

export interface NearbyFire extends FirePoint {
  distanceKm: number;
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two points. */
export function haversineKm(a: Coordinates, b: Coordinates): number {
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(s));
}

/** Parse the INPE daily CSV (id,lat,lon,data_hora_gmt,satelite,municipio,…). */
export function parseFireCsv(csv: string): FirePoint[] {
  const out: FirePoint[] = [];
  const lines = csv.split('\n');
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 6) continue;
    const lat = Number(cols[1]);
    const lon = Number(cols[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({ lat, lon, municipio: cols[5]?.trim() ?? '' });
  }
  return out;
}

/** Fires within `radiusKm` of a point, nearest first. Pure. */
export function firesNear(
  fires: FirePoint[],
  point: Coordinates,
  radiusKm: number
): NearbyFire[] {
  // Cheap bounding-box prefilter before the trig (1° lat ≈ 111km).
  const latPad = radiusKm / 111;
  const lonPad = radiusKm / (111 * Math.max(0.2, Math.cos((point.lat * Math.PI) / 180)));
  const near: NearbyFire[] = [];
  for (const f of fires) {
    if (Math.abs(f.lat - point.lat) > latPad || Math.abs(f.lon - point.lon) > lonPad) continue;
    const distanceKm = haversineKm(f, point);
    if (distanceKm <= radiusKm) near.push({ ...f, distanceKm });
  }
  return near.sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Fetch the day's Brazil fire detections (UTC date). Falls back to the
 * previous day when today's file isn't published yet. Throws when neither
 * exists — callers degrade to "no alert".
 */
export async function fetchDailyFires(now: Date = new Date()): Promise<{
  date: string;
  fires: FirePoint[];
}> {
  for (const daysBack of [0, 1]) {
    const d = new Date(now.getTime() - daysBack * 86_400_000);
    const iso = d.toISOString().slice(0, 10);
    const compact = iso.replace(/-/g, '');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    try {
      const res = await fetch(`${BASE}/focos_diario_br_${compact}.csv`, { signal: ctrl.signal });
      if (res.ok) {
        return { date: iso, fires: parseFireCsv(await res.text()) };
      }
    } catch {
      // network hiccup — try the previous day before giving up
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('INPE Queimadas daily CSV unavailable (today and yesterday)');
}
