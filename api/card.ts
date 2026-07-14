/**
 * Public card image endpoint: renders a PNG card that WhatsApp fetches by URL
 * (Twilio media_url / Cloud image link). Unauthenticated by necessity — the
 * data it renders is the farmer's own low-sensitivity weather/vigor, encoded in
 * the query string. No secrets, no PII.
 *
 *   /api/card?type=spray&lat=-12.5&lon=-55.7
 *   /api/card?type=ndvi&ndvi=0.62&std=0.08&samples=9&date=2026-06-29
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { svgToPng } from './_lib/cards/render';
import { spraySvg } from './_lib/cards/spray';
import { ndviSvg } from './_lib/cards/ndviCard';
import { farmSvg } from './_lib/cards/farm';
import { pestSvg } from './_lib/cards/pest';
import { pricesSvg } from './_lib/cards/prices';
import type { CommodityQuote } from './_lib/tools/prices';
import { fetchHourlyWeather } from './_lib/tools/weather';
import { assessHour, sprayWindow } from './_lib/tools/deltaT';
import {
  classifyVigor,
  classifyUniformity,
  fetchSceneThumb,
  UNIFORMITY_MIN_SAMPLES,
} from './_lib/tools/ndvi';
import { fetchSoil, textureLabel } from './_lib/tools/soil';
import { reverseGeocodeUf } from './_lib/tools/geo';
import { vazioStatus } from './_lib/tools/calendar';
import { createLogger } from './_lib/logger';

const log = createLogger('card');

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const type = String(req.query.type ?? '');
  try {
    let svg: string;
    let maxAge = 600;

    if (type === 'spray') {
      const lat = num(req.query.lat);
      const lon = num(req.query.lon);
      if (lat == null || lon == null) {
        res.status(400).send('lat/lon required');
        return;
      }
      const hours = await fetchHourlyWeather({ lat, lon }, 12);
      const assessed = hours.map(assessHour);
      const { bestUpcoming } = sprayWindow(hours);
      svg = spraySvg(assessed, bestUpcoming);
      maxAge = 900; // weather shifts hourly
    } else if (type === 'prices') {
      // Quotes arrive packed in the query (key:saca:weekPct|...) — the reply
      // already fetched them; the card never re-hits Yahoo.
      const KEYS = new Set(['cafe', 'soja', 'milho']);
      const quotes: CommodityQuote[] = String(req.query.q ?? '')
        .split('|')
        .map((part) => {
          const [key, saca, pct] = part.split(':');
          if (!KEYS.has(key) || !Number.isFinite(Number(saca))) return null;
          const LABELS: Record<string, string> = {
            cafe: 'Café arábica (NY)',
            soja: 'Soja (Chicago)',
            milho: 'Milho (Chicago)',
          };
          return {
            key: key as CommodityQuote['key'],
            label: LABELS[key],
            sacaBrl: Number(saca),
            weekChangePct: pct && Number.isFinite(Number(pct)) ? Number(pct) : null,
          };
        })
        .filter((q): q is CommodityQuote => q != null)
        .slice(0, 3);
      if (!quotes.length) {
        res.status(400).send('q required');
        return;
      }
      const usd = num(req.query.usd);
      const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      svg = pricesSvg(quotes, usd, today);
      maxAge = 900;
    } else if (type === 'ndvi') {
      const ndvi = num(req.query.ndvi);
      const date = String(req.query.date ?? '');
      if (ndvi == null || !date) {
        res.status(400).send('ndvi/date required');
        return;
      }
      const std = num(req.query.std);
      const samples = num(req.query.samples) ?? undefined;
      const vigor = classifyVigor(ndvi);
      const uniformity =
        std != null && samples != null && samples >= UNIFORMITY_MIN_SAMPLES
          ? classifyUniformity(std)
          : null;
      // Optional true-colour mini-map when we have the pin. Fail-soft: no coords
      // or titiler down → card renders without the image.
      const lat = num(req.query.lat);
      const lon = num(req.query.lon);
      const thumb =
        lat != null && lon != null ? (await fetchSceneThumb(lat, lon))?.dataUri ?? null : null;
      svg = ndviSvg({
        ndvi,
        date,
        samples,
        vigor: { label: vigor.label, note: vigor.note },
        uniformity,
        thumb,
      });
      maxAge = 86_400; // a given scene's read is stable
    } else if (type === 'farm') {
      const lat = num(req.query.lat);
      const lon = num(req.query.lon);
      if (lat == null || lon == null) {
        res.status(400).send('lat/lon required');
        return;
      }
      // Recompute the same primitives the text farm card uses, in parallel and
      // fail-soft — a slow/down layer just drops from the card, never blocks it.
      const [soilR, sprayR, ufR] = await Promise.allSettled([
        fetchSoil(lat, lon),
        (async () => sprayWindow(await fetchHourlyWeather({ lat, lon }, 12)))(),
        reverseGeocodeUf(lat, lon),
      ]);
      const soil = soilR.status === 'fulfilled' ? soilR.value : null;
      const now = sprayR.status === 'fulfilled' ? sprayR.value.now : null;
      const uf = ufR.status === 'fulfilled' ? ufR.value : null;
      const vazio = uf ? vazioStatus(uf, new Date()) : null;
      svg = farmSvg({
        uf,
        soil: soil
          ? {
              texture: textureLabel(soil),
              ph: soil.ph,
              acid: soil.ph != null && soil.ph < 5.5,
            }
          : null,
        spray: now
          ? { verdict: now.verdict, deltaT: now.deltaT, windKmh: now.windKmh }
          : null,
        vazio: vazio && vazio.known ? { active: vazio.active } : null,
      });
      maxAge = 900; // weather shifts hourly
    } else if (type === 'pest') {
      const pest = String(req.query.pest ?? '').trim();
      if (!pest) {
        res.status(400).send('pest required');
        return;
      }
      const confRaw = String(req.query.confidence ?? 'media');
      const confidence =
        confRaw === 'alta' || confRaw === 'baixa' ? confRaw : ('media' as const);
      const products = num(req.query.products);
      const groups = String(req.query.groups ?? '')
        .split('|')
        .map((g) => g.trim())
        .filter(Boolean);
      svg = pestSvg({
        pest,
        crop: req.query.crop ? String(req.query.crop) : null,
        confidence,
        evidence: req.query.evidence ? String(req.query.evidence) : null,
        products: products ?? null,
        groups,
      });
      maxAge = 3600; // a given triage result is stable
    } else {
      res.status(400).send('unknown card type');
      return;
    }

    const png = svgToPng(svg);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', `public, max-age=${maxAge}, s-maxage=${maxAge}`);
    res.status(200).send(png);
  } catch (e) {
    log.error(`card render failed (${type}):`, (e as Error).message);
    res.status(500).send('card render failed');
  }
}
