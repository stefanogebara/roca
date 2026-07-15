/**
 * The farm card — the onboarding payback moment (dossier Part 8.2).
 *
 * On a pin drop we derive everything we can in parallel (soil, spray window,
 * state → vazio sanitário) and reflect it back in one WhatsApp-sized message:
 * "caramba, ele conhece minha terra". Every layer degrades gracefully; the
 * card ships with whatever arrived in time.
 */

import { fetchSoil, textureLabel, type SoilReading } from './tools/soil';
import { fetchHourlyWeather } from './tools/weather';
import { sprayWindow } from './tools/deltaT';
import { phraseSpray } from './reason';
import { reverseGeocodeUf } from './tools/geo';
import { fetchFieldNdvi, interpretLand } from './tools/ndvi';
import { vazioStatus } from './tools/calendar';
import {
  setFarmLocation,
  setUserState,
  setCachedSoil,
  getCachedSoil,
  setCachedNdvi,
  setAwaiting,
} from './db';

// A pin that satellite couldn't confirm as vegetated is NOT asserted as a field.
// Honest redirect + hold for a confirm or a corrected location. This is the fix
// for "farmer messages from an apartment in São Paulo and gets their rooftop
// analyzed as sua lavoura" — see interpretLand in tools/ndvi.ts.
// Cap the pin-drop NDVI probe: it runs inline on the onboarding "wow moment"
// card, so a slow/hanging titiler must never delay it beyond this — the gate
// just degrades to 'unknown' → the normal card (fail-open). fetchFieldNdvi has
// its own per-request timeouts, but scene search + a grid of reads can stack.
const PIN_NDVI_TIMEOUT_MS = 7000;

function withCap<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>;
  const cap = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  return Promise.race([p.finally(() => clearTimeout(timer)), cap]);
}

const NO_VEGETATION_REPLY = [
  'Recebi seu pin 📍 — mas dei uma olhada por satélite e não achei vegetação nesse ponto.',
  '',
  'Pode ser que você tenha mandado a localização de onde você está agora (cidade, casa), ou a lavoura esteja em pousio / recém-colhida.',
  '',
  'Se a lavoura é em *outro lugar*, me manda o pin lá na roça (📎 → Localização) ou o nome da cidade/região dela. Se for aí mesmo e só está sem planta agora, é só responder "é aí mesmo" que eu sigo. 🌱',
].join('\n');

// Reply to the "não achei vegetação" question that means "keep this pin, it IS
// my field (just bare right now)". Affirmations + bare-field explanations. A
// negation ("não, é em outro lugar") is NOT a confirm — it falls through so the
// stated-location path can redirect. Order matters: negation is checked first.
const FARM_CONFIRM_NO = /\b(n[ãa]o|errad[oa]|outro\s+lugar)\b/i;
// \b is ASCII-only and doesn't fire before "é" — anchor it only on the ASCII
// single-word alternatives; leave the accented phrases (é aí mesmo…) unanchored.
const FARM_CONFIRM_YES =
  /(é\s+(a[íi]|ali|l[áa]|aqui|isso)\s+mesmo|isso\s+mesmo|é\s+aqui|é\s+l[áa]|\bconfirmo\b|\bcorreto\b|\bexato\b|pode\s+(manter|seguir|ser)|\bsim\b|\bpousio\b|\bentressafra\b|rec[ée]m|\bcolhi|colheita|acabei\s+de\s+(plantar|colher)|plantad|sem\s+planta|sem\s+mato|t[áa]\s+limp[oa]|\barei\b|arad[oa]|\bgrade)/i;

/**
 * Whether a reply to the vegetation-confirmation question affirms the pin
 * (keep it as the field) rather than redirecting elsewhere. Pure; the caller
 * only consults it while awaiting='farm_confirm'.
 */
export function isFarmConfirmYes(text: string): boolean {
  if (FARM_CONFIRM_NO.test(text)) return false;
  return FARM_CONFIRM_YES.test(text);
}

function soilLines(soil: SoilReading): string[] {
  const lines: string[] = [];
  const texture = textureLabel(soil);
  const parts: string[] = [];
  if (texture) parts.push(texture);
  if (soil.ph != null) parts.push(`pH ~${soil.ph}`);
  if (parts.length > 0) lines.push(`🌱 Solo por aqui: ${parts.join(', ')}.`);
  if (soil.ph != null && soil.ph < 5.5) {
    lines.push(
      'Solo ácido — bem típico de Latossolo. O alumínio nessas condições "trava" os nutrientes; por isso calagem é tão comum na sua região. Vale uma análise de solo com seu agrônomo.'
    );
  }
  return lines;
}

/**
 * Build the farm card for a fresh pin. Persists the pin, state, soil + NDVI
 * cache, and the `awaiting` state as side effects. Never throws — worst case is
 * a shorter card.
 *
 * Before asserting the pin is "sua lavoura", it reads the point from space: a
 * dropped WhatsApp pin is *where the phone is*, not necessarily a field. If
 * satellite shows no vegetation (water, rooftop, asphalt — or a genuinely bare
 * field), it holds with an honest question instead of confidently describing a
 * concrete slab's "soil". Fails OPEN: no usable image (clouds / service down) →
 * the normal card, exactly as before.
 *
 * Returns `card: false` on the no-vegetation hold so the caller suppresses the
 * farm image — otherwise the honest "não achei vegetação" text would ship
 * alongside a polished "SUA LAVOURA" card, re-introducing the very bug this
 * guards against.
 */
export async function buildFarmCard(
  userId: string | null,
  lat: number,
  lon: number
): Promise<{ text: string; card: boolean }> {
  const farmId = userId ? await setFarmLocation(userId, lat, lon) : null;

  const [soilR, sprayR, ufR, ndviR] = await Promise.allSettled([
    (async () => {
      if (farmId) {
        const cached = await getCachedSoil<SoilReading>(farmId);
        if (cached) return cached;
      }
      const fresh = await fetchSoil(lat, lon);
      if (fresh && farmId) await setCachedSoil(farmId, fresh);
      return fresh;
    })(),
    (async () => {
      const hours = await fetchHourlyWeather({ lat, lon }, 12);
      return sprayWindow(hours);
    })(),
    (async () => {
      const uf = await reverseGeocodeUf(lat, lon);
      if (uf && userId) await setUserState(userId, uf);
      return uf;
    })(),
    // Vegetation gate, in parallel and time-capped. Cached so a later "como está
    // minha lavoura?" is instant and consistent with what onboarding saw.
    // Fail-soft to null (→ interpretLand 'unknown' → normal card).
    (async () => {
      const reading = await withCap(fetchFieldNdvi(lat, lon), PIN_NDVI_TIMEOUT_MS);
      if (reading && farmId) {
        await setCachedNdvi(farmId, {
          ndvi: reading.ndvi,
          date: reading.date,
          std: reading.std,
          samples: reading.samples,
        });
      }
      return reading;
    })(),
  ]);

  // The pin shows no active vegetation → don't assert it's their field. Ask
  // honestly and hold for a confirm ("é aí mesmo") or a corrected location.
  const ndvi = ndviR.status === 'fulfilled' ? ndviR.value : null;
  if (interpretLand(ndvi) === 'no_vegetation') {
    if (userId) await setAwaiting(userId, 'farm_confirm');
    return { text: NO_VEGETATION_REPLY, card: false };
  }

  const lines: string[] = ['Prontinho, guardei a localização da sua lavoura. 📍'];

  if (soilR.status === 'fulfilled' && soilR.value) {
    lines.push('', ...soilLines(soilR.value));
  }

  if (sprayR.status === 'fulfilled') {
    lines.push('', '💨 Clima de agora pra pulverização:', phraseSpray(sprayR.value));
  }

  if (ufR.status === 'fulfilled' && ufR.value) {
    const vazio = vazioStatus(ufR.value, new Date());
    if (vazio.line) lines.push('', vazio.line);
  }

  lines.push('', 'Me conta: o que você planta aí? Soja, milho, pasto?');
  if (userId) await setAwaiting(userId, 'crop');
  return { text: lines.join('\n'), card: true };
}
