/**
 * Open-Meteo weather fetch (free, no API key).
 * Powers the Delta T spray-window. Kept separate from deltaT.ts so the logic
 * stays pure and testable.
 */

import type { HourWeather } from './deltaT';

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';
// Hard deadline — this is the hottest external call in the pipeline (spray
// verdict + farm card); a hung Open-Meteo response must degrade, not ride the
// webhook's whole 60s budget. Same pattern as soil.ts/geo.ts.
const TIMEOUT_MS = 6000;

export interface Coordinates {
  lat: number;
  lon: number;
}

interface OpenMeteoHourly {
  time: string[];
  temperature_2m: number[];
  relative_humidity_2m: number[];
  wind_speed_10m: number[];
  precipitation_probability: number[];
}

/**
 * Fetch hourly weather starting at the current hour for the given point.
 * Returns up to `hoursAhead` hours (default 12), `hours[0]` being "now".
 * Throws on network/HTTP failure so the caller can degrade gracefully.
 */
export async function fetchHourlyWeather(
  coords: Coordinates,
  hoursAhead = 12
): Promise<HourWeather[]> {
  const params = new URLSearchParams({
    latitude: String(coords.lat),
    longitude: String(coords.lon),
    hourly:
      'temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation_probability',
    wind_speed_unit: 'kmh',
    timezone: 'auto',
    forecast_days: '2',
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${OPEN_METEO}?${params.toString()}`, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new Error(`Open-Meteo returned ${res.status}`);
  }

  const data = (await res.json()) as { hourly?: OpenMeteoHourly };
  const h = data.hourly;
  if (!h || !Array.isArray(h.time) || h.time.length === 0) {
    throw new Error('Open-Meteo response missing hourly data');
  }

  const nowMs = Date.now();
  const rows: HourWeather[] = h.time.map((time, i) => ({
    time,
    tempC: h.temperature_2m[i],
    humidity: h.relative_humidity_2m[i],
    windKmh: h.wind_speed_10m[i],
    precipProb: h.precipitation_probability?.[i],
  }));

  // Open-Meteo returns whole days from midnight. Trim to the current hour onward.
  const startIdx = Math.max(
    0,
    rows.findIndex((r) => new Date(r.time).getTime() >= nowMs - 60 * 60 * 1000)
  );
  return rows.slice(startIdx, startIdx + hoursAhead);
}
