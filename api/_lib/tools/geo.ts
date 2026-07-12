/**
 * Geocoding, both directions, always fail-soft to null:
 *  - reverse (pin → Brazilian UF) via BigDataCloud's client API (keyless) —
 *    the farm card degrades gracefully without a state.
 *  - forward (city name → coordinates) via Open-Meteo's geocoding API
 *    (keyless, same provider family as weather/frost) — used when promoting
 *    a prospect to partner: the lead matcher is geographic (haversine on the
 *    coverage centroid), so the partner's city needs coordinates.
 */

import { createLogger } from '../logger';

const log = createLogger('geo');

const GEO_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const TIMEOUT_MS = 5000;

/** ISO 3166-2:BR principal subdivision → UF, e.g. "BR-MT" → "MT". */
export async function reverseGeocodeUf(lat: number, lon: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      localityLanguage: 'pt',
    });
    const res = await fetch(`${GEO_URL}?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      log.error(`reverse geocode returned ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      countryCode?: string;
      principalSubdivisionCode?: string;
    };
    if (data.countryCode !== 'BR') return null;
    const code = data.principalSubdivisionCode; // "BR-MT"
    const uf = code?.split('-')[1];
    return uf && uf.length === 2 ? uf : null;
  } catch (e) {
    log.error('reverse geocode failed:', (e as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Forward geocoding (city → coordinates) ───────────────────────────────────

export interface GeocodeHit {
  name: string;
  latitude: number;
  longitude: number;
  country_code?: string;
  admin1?: string; // full state name ("Minas Gerais")
}

// UF → state name, to disambiguate homonyms ("Bom Jesus" exists in several states).
const UF_NAMES: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará',
  DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão',
  MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará',
  PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
  SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};

const norm = (s?: string): string =>
  (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Pick the geocode hit for a Brazilian city. Guards against the API's fuzzy /
 * alternate-name matching (querying "Bom Jesus" can rank a town that merely
 * HAS it as an alternate name above the real ones): only hits whose own name
 * matches the queried city are eligible — exact first, then prefix ("Bom
 * Jesus de Goiás" for "Bom Jesus"). With a known UF, only that state's hit is
 * accepted; an unknown/missing UF accepts the pool only when it's unambiguous
 * (every candidate in one state). No coordinates beats wrong coordinates —
 * a bad centroid silently mis-routes farmer leads. Pure; exported for tests.
 */
export function pickBrazilHit(
  hits: GeocodeHit[],
  city: string,
  uf: string | null
): GeocodeHit | null {
  const brazil = hits.filter((h) => (h.country_code ?? '').toUpperCase() === 'BR');
  const exact = brazil.filter((h) => norm(h.name) === norm(city));
  const pool = exact.length ? exact : brazil.filter((h) => norm(h.name).startsWith(norm(city)));
  if (!pool.length) return null;
  // A free-text UF that isn't a real UF code ("MINAS GERAIS") degrades to the
  // no-UF rule rather than rejecting everything forever.
  const stateName = uf ? UF_NAMES[uf.toUpperCase()] : undefined;
  if (stateName) {
    return pool.find((h) => norm(h.admin1) === norm(stateName)) ?? null;
  }
  const states = new Set(pool.map((h) => norm(h.admin1)));
  return states.size === 1 ? pool[0] : null;
}

/** City name → coordinates (fail-soft null; Open-Meteo geocoding, keyless). */
export async function geocodeCityBR(
  city: string,
  uf: string | null
): Promise<{ lat: number; lon: number } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const params = new URLSearchParams({ name: city, count: '10', language: 'pt', format: 'json' });
    const res = await fetch(`${GEOCODE_URL}?${params.toString()}`, { signal: controller.signal });
    if (!res.ok) {
      log.error(`geocode returned ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { results?: GeocodeHit[] };
    const best = pickBrazilHit(data.results ?? [], city, uf);
    return best ? { lat: best.latitude, lon: best.longitude } : null;
  } catch (e) {
    log.error('geocode failed:', (e as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
