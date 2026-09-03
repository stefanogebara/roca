/**
 * NDVI field-vigor card: the satellite read as a visual — a big value, a color
 * band along the vigor ramp (bare soil → dense canopy), the plain-language band
 * label, and (when the area grid resolved enough pixels) the uniformity note.
 * When a true-colour thumbnail is available it becomes a mini-map on the right —
 * the field seen from space with a crosshair on the pin — turning "NDVI ~0.62"
 * into something a farmer reads in one glance.
 */

import { C, T, esc, cardShell, brandHeader, hairline, display, body, mono } from './render';
import { NDVI_VIGOR_BREAKS } from '../tools/ndvi';

const W = 900;
const H = 520;
const M = T.margin;

// One colour per vigor band (bare soil → dense canopy), aligned to the shared
// NDVI_VIGOR_BREAKS so the card can't disagree with classifyVigor's label.
const STOPS = [C.soil, '#C9A227', '#7CBF5A', C.folha, '#1F4F2B'];
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
  const leftRight = hasThumb ? 512 : W - M;

  // Ramp legend bar with a marker at the reading, sized to the left column.
  const barX = M;
  const barY = 300;
  const barW = leftRight - barX;
  const segW = barW / STOPS.length;
  const segs = STOPS
    .map((s, i) => `<rect x="${barX + i * segW}" y="${barY}" width="${segW}" height="22" fill="${s}"/>`)
    .join('');
  // Marker position: NDVI 0..NDVI_RAMP_MAX mapped across the bar.
  const t = Math.max(0, Math.min(1, data.ndvi / NDVI_RAMP_MAX));
  const markX = barX + t * barW;

  const uni = data.uniformity
    ? body(M, H - 96, `Uniformidade: ${data.uniformity.label}.`, { size: 20, color: C.tinta })
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
  <rect x="${mx}" y="${my}" width="${ms}" height="${ms}" rx="16" fill="none" stroke="${C.linha}" stroke-width="2"/>
  <circle cx="${cx}" cy="${cy}" r="12" fill="none" stroke="#fff" stroke-width="3"/>
  <line x1="${cx}" y1="${cy - 20}" x2="${cx}" y2="${cy - 14}" stroke="#fff" stroke-width="3"/>
  <line x1="${cx}" y1="${cy + 14}" x2="${cx}" y2="${cy + 20}" stroke="#fff" stroke-width="3"/>
  <line x1="${cx - 20}" y1="${cy}" x2="${cx - 14}" y2="${cy}" stroke="#fff" stroke-width="3"/>
  <line x1="${cx + 14}" y1="${cy}" x2="${cx + 20}" y2="${cy}" stroke="#fff" stroke-width="3"/>
  ${body(cx, my + ms + 28, 'Sua lavoura vista de cima (cor real)', { size: 15, color: C.cinza, anchor: 'middle' })}`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${cardShell(W, H)}
  ${brandHeader(M, 78, 'Vigor da lavoura (satélite)')}
  ${mono(M, 108, `Sentinel-2 · ${br(data.date)} · ${scope}`, { size: 14, color: C.cinza })}

  ${display(M, 224, `NDVI ${data.ndvi.toFixed(2)}`, 96, col)}
  ${body(M, 262, data.vigor.label, { size: 24, color: C.tinta, weight: 600 })}

  ${segs}
  <polygon points="${markX - 10},${barY - 6} ${markX + 10},${barY - 6} ${markX},${barY + 8}" fill="${C.tinta}"/>
  ${mono(barX, barY + 48, 'solo', { size: T.micro, color: C.cinza })}
  ${mono(barX + barW, barY + 48, 'dossel fechado', { size: T.micro, color: C.cinza, anchor: 'end' })}

  ${miniMap}

  ${uni}
  ${hairline(M, leftRight, H - 84)}
  ${body(M, H - 50, 'Leitura aproximada por satélite — combine com o campo e com seu agrônomo.', { size: T.small, color: C.cinza })}
  <desc>${esc(`NDVI ${data.ndvi.toFixed(2)} · ${data.vigor.label}`)}</desc>
</svg>`;
}
