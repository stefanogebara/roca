/**
 * Frost (geada) forecast — daily minimum temperature at a point, next 3 days,
 * via Open-Meteo. Geada is the existential winter risk for MG coffee (and hits
 * milho safrinha and pasture); July–August is peak season. Thresholds follow
 * the common agro-meteorological convention: shelter-height (2m) minima of
 * ~3°C already imply possible ground-level frost, ≤1°C makes it likely.
 */

import type { Coordinates } from './weather';

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';

export type FrostRisk = 'geada' | 'risco';

export interface DayMin {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  minC: number;
}

export interface FrostDay extends DayMin {
  risk: FrostRisk;
}

/** ≤1°C at 2m → frost likely; ≤3°C → frost possible; above → no flag. */
export function classifyFrostRisk(minC: number): FrostRisk | null {
  if (minC <= 1) return 'geada';
  if (minC <= 3) return 'risco';
  return null;
}

/** The coldest flagged day in the window, or null when nothing is flagged. */
export function pickWorstFrostDay(days: DayMin[]): FrostDay | null {
  let worst: FrostDay | null = null;
  for (const d of days) {
    const risk = classifyFrostRisk(d.minC);
    if (!risk) continue;
    if (!worst || d.minC < worst.minC) worst = { ...d, risk };
  }
  return worst;
}

/**
 * Fetch daily minimum temperatures for the next `days` days at a point.
 * Throws on failure — callers degrade gracefully (no alert beats a wrong one).
 */
export async function fetchDailyMinTemps(coords: Coordinates, days = 3): Promise<DayMin[]> {
  const params = new URLSearchParams({
    latitude: String(coords.lat),
    longitude: String(coords.lon),
    daily: 'temperature_2m_min',
    timezone: 'auto',
    forecast_days: String(days),
  });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${OPEN_METEO}?${params.toString()}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Open-Meteo returned ${res.status}`);
    const data = (await res.json()) as {
      daily?: { time: string[]; temperature_2m_min: number[] };
    };
    const d = data.daily;
    if (!d || !Array.isArray(d.time) || d.time.length === 0) {
      throw new Error('Open-Meteo response missing daily data');
    }
    return d.time.map((date, i) => ({ date, minC: d.temperature_2m_min[i] }));
  } finally {
    clearTimeout(timer);
  }
}
