/**
 * NDVI field-vigor card: the satellite read as a visual — a big value, a color
 * band along the vigor ramp (bare soil → dense canopy), the plain-language band
 * label, and (when the area grid resolved enough pixels) the uniformity note.
 * When a true-colour thumbnail is available it becomes a mini-map on the right —
 * the field seen from space with a crosshair on the pin — turning "NDVI ~0.62"
 * into something a farmer reads in one glance.
 */

import { C, T, esc, cardShell, brandHeader, hairline } from './render';
import { NDVI_VIGOR_BREAKS } from '../tools/ndvi';

const W = 900;
const H = 520;
const M = T.margin;

// One colour per vigor band (bare soil → dense canopy), aligned to the shared
// NDVI_VIGOR_BREAKS so the card can't disagree with classifyVigor's label.
const STOPS = [C.soil, '#c9a227', '#7cbf5a', C.leaf, C.green2];
// NDVI value the legend bar's right edge represents (ramp domain, card-local).
const NDVI_RAMP_MAX = 0.85;

/** Which of the 5 vigor bands an NDVI falls in (0..4), by the shared breaks. */
function bandIndex(ndvi: number): number {
  return NDVI_VIGOR_BREAKS.filter((b) => ndvi >= b).length;
}

export interface NdviCardData {
  ndvi: number;
  date: string; // YYYY-MM-DD
  samples?: number;
  vigor: { label: string; note: string };
  uniformity?: { label: string; note: string } | null;
  /** Optional true-colour mini-map as a PNG data URI (from fetchSceneThumb). */
  thumb?: string | null;
}

/** Color along the NDVI vigor ramp (same bands as classifyVigor). */
function ramp(ndvi: number): string {
  return STOPS[bandIndex(ndvi)];
}

/** "2026-06-29" → "29/06/2026". */
function br(date: string): string {
  const [y, m, d] = date.split('-');
  return y && m && d ? `${d}/${m}/${y}` : date;
}

export function ndviSvg(data: NdviCardData): string {
  const col = ramp(data.ndvi);
  const scope =
    data.samples && data.samples > 1
      ? `média de ${data.samples} pontos da lavoura`
      : 'leitura de um ponto';

  const hasThumb = !!data.thumb;
  // Left column narrows when the mini-map occupies the right side.
  const leftRight = hasThumb ? 512 : W - 48;

  // Ramp legend bar with a marker at the reading, sized to the left column.
  const barX = 48;
  const barY = 300;
  const barW = leftRight - barX - 8;
  const segW = barW / STOPS.length;
  const segs = STOPS
    .map((s, i) => `<rect x="${barX + i * segW}" y="${barY}" width="${segW}" height="26" fill="${s}"/>`)
    .join('');
  // Marker position: NDVI 0..NDVI_RAMP_MAX mapped across the bar.
  const t = Math.max(0, Math.min(1, data.ndvi / NDVI_RAMP_MAX));
  const markX = barX + t * barW;

  const uni = data.uniformity
    ? `<text x="48" y="${H - 96}" font-family="DM Sans" font-size="22" fill="${C.ink}">Uniformidade: ${esc(data.uniformity.label)}.</text>`
    : '';

  // Mini-map: framed thumbnail on the right with a crosshair on the pin (center).
  let miniMap = '';
  if (hasThumb) {
    const mx = 548;
    const my = 96;
    const ms = 304;
    const cx = mx + ms / 2;
    const cy = my + ms / 2;
    miniMap = `
  <clipPath id="mm"><rect x="${mx}" y="${my}" width="${ms}" height="${ms}" rx="16"/></clipPath>
  <image href="${data.thumb}" x="${mx}" y="${my}" width="${ms}" height="${ms}" preserveAspectRatio="xMidYMid slice" clip-path="url(#mm)"/>
  <rect x="${mx}" y="${my}" width="${ms}" height="${ms}" rx="16" fill="none" stroke="${C.line}" stroke-width="2"/>
  <circle cx="${cx}" cy="${cy}" r="12" fill="none" stroke="#fff" stroke-width="3"/>
  <line x1="${cx}" y1="${cy - 20}" x2="${cx}" y2="${cy - 14}" stroke="#fff" stroke-width="3"/>
  <line x1="${cx}" y1="${cy + 14}" x2="${cx}" y2="${cy + 20}" stroke="#fff" stroke-width="3"/>
  <line x1="${cx - 20}" y1="${cy}" x2="${cx - 14}" y2="${cy}" stroke="#fff" stroke-width="3"/>
  <line x1="${cx + 14}" y1="${cy}" x2="${cx + 20}" y2="${cy}" stroke="#fff" stroke-width="3"/>
  <text x="${cx}" y="${my + ms + 28}" font-family="DM Sans" font-size="17" fill="${C.muted}" text-anchor="middle">Sua lavoura vista de cima (cor real)</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${cardShell(W, H)}
  ${brandHeader(M, 90, 'Vigor da lavoura (satélite)')}
  <text x="${M}" y="120" font-family="DM Sans" font-size="${T.small}" fill="${C.muted}">Sentinel-2 · ${esc(br(data.date))} · ${esc(scope)}</text>

  <text x="${M}" y="222" font-family="Instrument Serif" font-size="84" fill="${col}">NDVI ${data.ndvi.toFixed(2)}</text>
  <text x="${M}" y="264" font-family="DM Sans" font-size="26" font-weight="700" fill="${C.green}">${esc(data.vigor.label)}</text>

  ${segs}
  <polygon points="${markX - 10},${barY - 6} ${markX + 10},${barY - 6} ${markX},${barY + 8}" fill="${C.ink}"/>
  <text x="${barX}" y="${barY + 52}" font-family="DM Sans" font-size="${T.micro}" fill="${C.muted}">solo</text>
  <text x="${barX + barW}" y="${barY + 52}" font-family="DM Sans" font-size="${T.micro}" fill="${C.muted}" text-anchor="end">dossel fechado</text>

  ${miniMap}

  ${uni}
  ${hairline(M, leftRight, H - 84)}
  <text x="${M}" y="${H - 50}" font-family="DM Sans" font-size="${T.small}" fill="${C.muted}">Leitura aproximada por satélite — combine com o campo e com seu agrônomo.</text>
</svg>`;
}
