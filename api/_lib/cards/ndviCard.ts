/**
 * NDVI field-vigor card: the satellite read as a visual — a big value, a color
 * band along the vigor ramp (bare soil → dense canopy), the plain-language band
 * label, and (when the area grid resolved enough pixels) the uniformity note.
 * When a true-colour thumbnail is available it becomes a mini-map on the right —
 * the field seen from space with a crosshair on the pin — turning "NDVI ~0.62"
 * into something a farmer reads in one glance.
 */

import { C, esc } from './render';

const W = 900;
const H = 520;

export interface NdviCardData {
  ndvi: number;
  date: string; // YYYY-MM-DD
  samples?: number;
  vigor: { label: string; note: string };
  uniformity?: { label: string; note: string } | null;
  /** Optional true-colour mini-map as a PNG data URI (from fetchSceneThumb). */
  thumb?: string | null;
}

/** Color along the NDVI vigor ramp. */
function ramp(ndvi: number): string {
  if (ndvi < 0.15) return C.soil;
  if (ndvi < 0.3) return '#c9a227';
  if (ndvi < 0.5) return '#7cbf5a';
  if (ndvi < 0.7) return C.leaf;
  return C.green2;
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
  const stops = [C.soil, '#c9a227', '#7cbf5a', C.leaf, C.green2];
  const segW = barW / stops.length;
  const segs = stops
    .map((s, i) => `<rect x="${barX + i * segW}" y="${barY}" width="${segW}" height="26" fill="${s}"/>`)
    .join('');
  // Marker position: NDVI 0..0.85 mapped across the bar.
  const t = Math.max(0, Math.min(1, data.ndvi / 0.85));
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
  <rect width="${W}" height="${H}" fill="${C.cream}"/>
  <rect x="24" y="24" width="${W - 48}" height="${H - 48}" rx="24" fill="${C.card}" stroke="${C.line}" stroke-width="2"/>

  <text x="48" y="84" font-family="DM Sans" font-size="26" font-weight="700" fill="${C.muted}">Stevi · Vigor da lavoura (satélite)</text>
  <text x="48" y="116" font-family="DM Sans" font-size="20" fill="${C.muted}">Sentinel-2 · ${esc(br(data.date))}</text>
  <text x="48" y="142" font-family="DM Sans" font-size="20" fill="${C.muted}">${esc(scope)}</text>

  <text x="48" y="215" font-family="Instrument Serif" font-size="88" fill="${col}">NDVI ${data.ndvi.toFixed(2)}</text>
  <text x="48" y="258" font-family="DM Sans" font-size="30" font-weight="700" fill="${C.green}">${esc(data.vigor.label)}</text>

  ${segs}
  <polygon points="${markX - 10},${barY - 6} ${markX + 10},${barY - 6} ${markX},${barY + 8}" fill="${C.ink}"/>
  <text x="${barX}" y="${barY + 52}" font-family="DM Sans" font-size="17" fill="${C.muted}">solo</text>
  <text x="${barX + barW}" y="${barY + 52}" font-family="DM Sans" font-size="17" fill="${C.muted}" text-anchor="end">dossel fechado</text>

  ${miniMap}

  ${uni}
  <text x="48" y="${H - 54}" font-family="DM Sans" font-size="18" fill="${C.muted}">Leitura aproximada por satélite — combine com o campo e com seu agrônomo.</text>
</svg>`;
}
