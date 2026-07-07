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
import { vazioStatus } from './tools/calendar';
import {
  setFarmLocation,
  setUserState,
  setCachedSoil,
  getCachedSoil,
} from './db';

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
 * Build the farm card for a fresh pin. Persists the pin, state, and soil cache
 * as side effects. Never throws — worst case is a shorter card.
 */
export async function buildFarmCard(
  userId: string | null,
  lat: number,
  lon: number
): Promise<string> {
  const farmId = userId ? await setFarmLocation(userId, lat, lon) : null;

  const [soilR, sprayR, ufR] = await Promise.allSettled([
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
  ]);

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
  return lines.join('\n');
}
