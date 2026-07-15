/**
 * Stated location — the farmer telling us *where the field is* in words, as
 * opposed to standing on it and dropping a pin. Decouples "onde você está" from
 * "onde é a lavoura": a farmer messaging from town, or a técnico asking about a
 * client's farm, can set a location by name. It geocodes to a coarse municipal
 * centroid ('city' precision) — good enough for weather/vazio, too coarse for
 * satellite NDVI — so the reply confirms and invites the pin to refine.
 */

import { chat } from './llm';
import { MODELS } from './env';
import { geocodeCityBR } from './tools/geo';
import { createLogger } from './logger';

const log = createLogger('location');

// A farm-location noun, so we can tell "minha lavoura fica em X" (setting a
// location) from "posso pulverizar em X?" (a spray question naming a city).
const FARM_NOUN =
  '(lavoura|fazenda|ro[çc]a|s[íi]tio|terra|propriedade|planta[çc][ãa]o|talh[ãa]o|ch[áa]cara)';
// Explicit "here's where my field is". The verb→preposition pair (fica/é/tá +
// em/na/no) is what separates a location statement from "minha lavoura tá com
// ferrugem". \b is ASCII-only and won't fire before "é", so the verb group is
// anchored on a preceding space, not \b.
const LOCATION_SETTING_RE = new RegExp(
  `(minha|meu|nossa|nosso)\\s+${FARM_NOUN}[^?!]{0,40}\\s(fica|é|est[áa]|t[áa])\\s+(em|na|no|pr[óo]xim|perto)` +
    `|\\b(sou|somos)\\s+d[eo]\\s`,
  'i'
);

/**
 * Whether a message is explicitly stating where the farm is (vs. a question
 * that happens to name a place). Pure; deliberately conservative — a miss just
 * means the farmer sends a pin, an over-match would hijack a real question.
 */
export function isLocationSettingRequest(text: string): boolean {
  return LOCATION_SETTING_RE.test(text);
}

const UF_SET = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

/**
 * Cheap-tier extraction of a Brazilian {city, uf} from a free-text location
 * statement. Returns null when there's no place to extract. An invalid/absent
 * UF becomes null (rather than garbage) so the geocoder's homonym guard falls
 * back to its unambiguous-only rule instead of rejecting on a bad state.
 */
export async function extractStatedPlace(
  text: string
): Promise<{ city: string; uf: string | null } | null> {
  try {
    const raw = await chat({
      model: MODELS.router(),
      maxTokens: 40,
      system:
        'Extraia a cidade e a UF (sigla de 2 letras) que o produtor menciona como local da lavoura. ' +
        'Responda SÓ um JSON: {"city":"nome da cidade ou vazio","uf":"UF ou vazio"}. Sem texto extra.',
      user: text,
    });
    const m = raw.match(/\{[^}]*\}/);
    if (!m) return null;
    const p = JSON.parse(m[0]) as { city?: string; uf?: string };
    const city = p.city?.trim();
    if (!city) return null;
    const uf = p.uf?.trim().toUpperCase();
    return { city, uf: uf && UF_SET.has(uf) ? uf : null };
  } catch (e) {
    log.error('stated place extraction failed:', (e as Error).message);
    return null;
  }
}

export interface ResolvedLocation {
  lat: number;
  lon: number;
  city: string;
  uf: string | null;
}

/**
 * Outcome of resolving a stated location. The three cases drive different
 * replies, and the distinction is what stops false "não achei essa cidade" on
 * messages that never named a place:
 *  - 'resolved'      → store the centroid, ask for the pin to refine.
 *  - 'ungeocodable'  → the farmer named a place we couldn't locate → ask for
 *                      city+UF or the pin.
 *  - 'no_place'      → no place mentioned at all ("sou do João", "minha roça tá
 *                      na seca") → the caller falls through to normal handling.
 */
export type LocationResolution =
  | ({ kind: 'resolved' } & ResolvedLocation)
  | { kind: 'ungeocodable'; city: string }
  | { kind: 'no_place' };

/**
 * Resolve a stated location. No coordinates beats wrong ones — the same
 * discipline the geocoder applies to homonyms. The 'no_place' vs 'ungeocodable'
 * split matters: only a message that actually named a place earns the "couldn't
 * find that city" reply; everything else falls through untouched.
 */
export async function resolveStatedLocation(text: string): Promise<LocationResolution> {
  const place = await extractStatedPlace(text);
  if (!place) return { kind: 'no_place' };
  const coords = await geocodeCityBR(place.city, place.uf);
  if (!coords) return { kind: 'ungeocodable', city: place.city };
  return { kind: 'resolved', lat: coords.lat, lon: coords.lon, city: place.city, uf: place.uf };
}

/** The confirm-and-refine reply: names the place, flags that a city centroid is
 * approximate, and invites the exact pin. Pure; exported for tests. */
export function confirmLocationReply(loc: ResolvedLocation): string {
  const place = loc.uf ? `${loc.city}-${loc.uf}` : loc.city;
  return [
    `Achei ${place} 📍 — anotei como referência da sua lavoura.`,
    '',
    'Como é a área da cidade toda, minha leitura por satélite fica só aproximada. Quando puder, manda o *pin da porteira* (clipe 📎 → Localização) que eu acerto no seu talhão. 🎯',
    '',
    'Por enquanto, me conta: o que você planta aí?',
  ].join('\n');
}
