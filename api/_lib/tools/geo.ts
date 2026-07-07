/**
 * Reverse geocoding: pin → Brazilian UF. Uses BigDataCloud's client API
 * (keyless, generous free tier). Fails soft to null — the farm card degrades
 * gracefully without a state.
 */

import { createLogger } from '../logger';

const log = createLogger('geo');

const GEO_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
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
