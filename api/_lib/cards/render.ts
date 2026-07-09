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
export const C = {
  green: '#14432f',
  green2: '#1f6b47',
  leaf: '#2e9e63',
  cream: '#f4efe4',
  card: '#ffffff',
  ink: '#1a2420',
  muted: '#6b7a72',
  line: '#e3dccb',
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
