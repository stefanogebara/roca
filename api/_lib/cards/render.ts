/**
 * Server-side card rendering: hand-authored SVG → PNG, no headless browser.
 *
 * We build small, legible SVG cards (spray window, NDVI) and rasterize them with
 * @resvg/resvg-js using bundled brand fonts (DM Sans + Instrument Serif). Fonts
 * are read from disk once and cached; loadSystemFonts is off for determinism
 * (serverless has no reliable system fonts). The TTFs ship with the function via
 * vercel.json includeFiles. Output PNG stays well under WhatsApp's 5 MB image cap
 * (these are typically <120 KB).
 */

import { Resvg } from '@resvg/resvg-js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Brand palette (matches the landing page / ops console). */
// "Campo Editorial" (just-br-derived) — matches web/styles.css so the cards a
// farmer forwards look like the site they land on. Verdict colours (go/caution/
// nogo), soil brown and the frost blue stay SEMANTIC, deliberately off-brand.
export const C = {
  green: '#303b0c', // olive-dark — headings/brand
  green2: '#4c5e03', // deep olive — secondary brand text (7:1 on white)
  leaf: '#748145', // mid olive — accents/ramp fills
  cream: '#f7fbeb', // olive wash — outer bg (paper would erase the card frame)
  card: '#ffffff',
  ink: '#0c0c0c',
  muted: '#7a7568',
  line: '#e3e0dc',
  go: '#2e9e63',
  caution: '#c98a1a',
  nogo: '#c0392b',
  soil: '#8a6d4b',
};

/** Resolve a bundled font path across local + Vercel-bundled layouts. */
function fontPath(file: string): string | null {
  for (const p of [
    join(process.cwd(), 'api/_lib/cards/fonts', file),
    join(__dirname, 'fonts', file),
    join(__dirname, '../cards/fonts', file),
  ]) {
    if (existsSync(p)) return p;
  }
  return null;
}

let fontFilesCache: string[] | null = null;
function loadFontFiles(): string[] {
  if (fontFilesCache) return fontFilesCache;
  const paths: string[] = [];
  for (const f of ['DMSans.ttf', 'InstrumentSerif.ttf']) {
    const p = fontPath(f);
    if (p) paths.push(p);
  }
  fontFilesCache = paths;
  return paths;
}

/**
 * Design tokens v2 (plan 2026-07-16-card-design-system). Additive — the legacy
 * `C` palette above stays for cards not yet migrated. Hard rules: five type
 * steps only; 8px grid; icons are DRAWN paths (never font glyphs/emoji — the
 * bundled fonts lack them and resvg renders tofu).
 */
export const T = {
  display: 44,
  h1: 30,
  h2: 22,
  body: 18,
  small: 15,
  micro: 12.5,
  unit: 8,
  margin: 56,
  atmoTop: '#dfe8d3',
  pillGo: '#e3f2e7',
  pillNo: '#f7e3df',
  pillFlat: '#eceae2',
  inkSoft: '#4b564f',
};

/**
 * Card shell: cream ground, soft green atmosphere wash fading into the cream,
 * faint offset shadow, white card. resvg-safe (plain gradient + rects, no
 * filters). Prepend to the card body inside the root <svg>.
 */
export function cardShell(w: number, h: number): string {
  return `
  <defs>
    <linearGradient id="atmo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${T.atmoTop}"/>
      <stop offset="1" stop-color="${C.cream}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="${C.cream}"/>
  <rect width="${w}" height="${Math.round(h * 0.55)}" fill="url(#atmo)"/>
  <rect x="24" y="30" width="${w - 48}" height="${h - 52}" rx="26" fill="${C.ink}" opacity="0.07"/>
  <rect x="24" y="24" width="${w - 48}" height="${h - 52}" rx="26" fill="${C.card}" stroke="${C.line}" stroke-width="1"/>`;
}

/** Brand anchor: "Stevi" serif logotype + middot + card title. Same spot always. */
export function brandHeader(x: number, y: number, title: string): string {
  return `
  <text x="${x}" y="${y}" font-family="Instrument Serif" font-size="34" fill="${C.green}">Stevi</text>
  <text x="${x + 92}" y="${y}" font-family="DM Sans" font-size="${T.h2}" fill="${C.muted}">·  ${esc(title)}</text>`;
}

/**
 * Trend chip: tinted pill + DRAWN triangle (or flat bar) + percent text.
 * Tofu-proof by construction. `anchorX` is the pill's RIGHT edge.
 */
export function trendChip(anchorX: number, cy: number, weekChangePct: number | null): string {
  const flat = weekChangePct == null || Math.abs(weekChangePct) <= 0.05;
  const up = !flat && (weekChangePct as number) > 0;
  const label = flat
    ? 'estável'
    : `${up ? '+' : '−'}${Math.abs(weekChangePct as number).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  const color = flat ? C.muted : up ? C.go : C.nogo;
  const bg = flat ? T.pillFlat : up ? T.pillGo : T.pillNo;
  const w = 22 + label.length * 9 + 18;
  const x = anchorX - w;
  const iconCx = x + 16;
  const icon = flat
    ? `<rect x="${iconCx - 6}" y="${cy - 1.5}" width="12" height="3" rx="1.5" fill="${color}"/>`
    : up
      ? `<path d="M ${iconCx - 6} ${cy + 4} L ${iconCx} ${cy - 5} L ${iconCx + 6} ${cy + 4} Z" fill="${color}"/>`
      : `<path d="M ${iconCx - 6} ${cy - 4} L ${iconCx} ${cy + 5} L ${iconCx + 6} ${cy - 4} Z" fill="${color}"/>`;
  return `
  <rect x="${x}" y="${cy - 14}" width="${w}" height="28" rx="14" fill="${bg}"/>
  ${icon}
  <text x="${iconCx + 12}" y="${cy + 5}" font-family="DM Sans" font-size="${T.small}" font-weight="700" fill="${color}">${esc(label)}</text>`;
}

/**
 * Sparkline from a true series (render only with ≥3 points — never fabricate).
 * Normalized to the box; endpoint dot; subtle area fill.
 */
export function sparkline(
  x: number,
  y: number,
  w: number,
  h: number,
  series: number[],
  color: string
): string {
  if (series.length < 3) return '';
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const pts = series.map((v, i) => {
    const px = x + (i / (series.length - 1)) * w;
    const py = y + h - ((v - min) / span) * h;
    return [px, py] as const;
  });
  const line = pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
  const area = `${x},${y + h} ${line} ${x + w},${y + h}`;
  const [ex, ey] = pts[pts.length - 1];
  return `
  <polygon points="${area}" fill="${color}" opacity="0.10"/>
  <polyline points="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="3.5" fill="${color}"/>`;
}

/** 1px hairline separator. */
export function hairline(x1: number, x2: number, y: number): string {
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${C.line}" stroke-width="1"/>`;
}

/** XML-escape text for safe interpolation into SVG. */
export function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Rasterize an SVG string to a PNG buffer at the given width. */
export function svgToPng(svg: string, width = 900): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: {
      fontFiles: loadFontFiles(),
      defaultFontFamily: 'DM Sans',
      loadSystemFonts: false,
    },
    background: C.cream,
  });
  return Buffer.from(resvg.render().asPng());
}
