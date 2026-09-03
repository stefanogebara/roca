/**
 * Server-side card rendering: hand-authored SVG → PNG, no headless browser.
 *
 * We build small, legible SVG cards (spray window, NDVI, frost…) and rasterize
 * them with @resvg/resvg-js using bundled brand fonts. Fonts are read from disk
 * once and cached; loadSystemFonts is off for determinism (serverless has no
 * reliable system fonts). The TTFs ship with the function via vercel.json
 * includeFiles. Output PNG stays well under WhatsApp's 5 MB image cap.
 *
 * Identidade v2 (set/2026, web/README.md): o card que o produtor encaminha no
 * grupo tem que parecer o site em que ele cai — creme + tinta, cereja uma vez,
 * Big Shoulders Display caixa-alta como voz, Hanken Grotesk no corpo, IBM Plex
 * Mono no dado. As cores de veredito (pode / atenção / não), o marrom do solo e
 * o azul da geada continuam SEMÂNTICAS, de propósito fora da marca.
 */

import { Resvg } from '@resvg/resvg-js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { publicWaNumber } from '../waNumber';

/** Famílias como estão nos TTFs de fonts/ (resvg casa pelo nome interno). */
export const F = {
  display: 'Big Shoulders Display',
  corpo: 'Hanken Grotesk',
  mono: 'IBM Plex Mono',
} as const;

/**
 * Paleta. As chaves antigas (green, leaf, cream…) continuam existindo — mapeadas
 * para os tokens v2 — porque os cards as usam por papel, não por cor.
 */
export const C = {
  // tokens v2
  creme: '#F4F0E4',
  creme2: '#EAE4D2',
  tinta: '#15130F',
  tinta2: '#2A2620',
  cinza: '#6D675C',
  cinzaClaro: '#A9A292',
  linha: '#D9D3C3',
  linhaEscura: '#3D3830',
  cereja: '#D6321B',
  folha: '#2E6E3C',
  // papéis (nomes legados)
  green: '#15130F', // títulos / marca → tinta
  green2: '#2A2620', // texto secundário de marca → tinta-2
  leaf: '#2E6E3C', // acento "vivo" → folha
  cream: '#F4F0E4', // fundo → creme
  card: '#F4F0E4', // não há mais cartão branco: o card É o creme
  ink: '#15130F',
  muted: '#6D675C',
  line: '#D9D3C3',
  // semânticos (fora da marca de propósito)
  go: '#2E6E3C',
  caution: '#B8770F',
  nogo: '#D6321B',
  soil: '#8A6D4B',
  frost: '#2F5F9E',
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
  for (const f of [
    'BigShouldersDisplay-Black.ttf',
    'HankenGrotesk-Medium.ttf',
    'HankenGrotesk-SemiBold.ttf',
    'IBMPlexMono-Medium.ttf',
  ]) {
    const p = fontPath(f);
    if (p) paths.push(p);
  }
  fontFilesCache = paths;
  return paths;
}

/**
 * Escala tipográfica (cinco degraus + display) e grade de 8px. Ícones são
 * caminhos DESENHADOS (nunca glifo de fonte/emoji — os TTFs não têm e o resvg
 * renderiza tofu).
 */
export const T = {
  display: 72, // manchete em Big Shoulders 900 caixa-alta
  h1: 44,
  h2: 26,
  body: 20,
  small: 16,
  micro: 13,
  unit: 8,
  margin: 56,
  // chips de tendência
  pillGo: '#DCEBDD',
  pillNo: '#F7DAD6',
  pillFlat: '#EAE4D2',
  inkSoft: '#2A2620',
};

export type CardTheme = 'light' | 'dark';

/** Cor de texto principal / secundária / fio para o tema. */
export function tone(theme: CardTheme = 'light'): { fg: string; fg2: string; line: string; bg: string } {
  return theme === 'dark'
    ? { fg: C.creme, fg2: C.cinzaClaro, line: C.linhaEscura, bg: C.tinta }
    : { fg: C.tinta, fg2: C.cinza, line: C.linha, bg: C.creme };
}

/**
 * Casca do card: um plano só (creme ou tinta), sem cartão branco, sem sombra —
 * profundidade vem de contraste e escala, como no site. resvg-safe.
 */
export function cardShell(w: number, h: number, theme: CardTheme = 'light'): string {
  const t = tone(theme);
  return `
  <rect width="${w}" height="${h}" fill="${t.bg}"/>`;
}

/**
 * Caixa-alta é visual: o SVG não tem text-transform no resvg, então os glifos
 * saem maiúsculos e o texto original fica num <title> (nome acessível, e o que
 * os testes leem). Só entra quando difere.
 */
function upper(text: string): string {
  const up = text.toUpperCase();
  return up === text ? esc(up) : `${esc(up)}<title>${esc(text)}</title>`;
}

/** Wordmark "STEVI" em display + ponto cereja (o único acento decorativo). */
export function wordmark(x: number, y: number, theme: CardTheme = 'light', size = 30): string {
  const t = tone(theme);
  const dot = size * 0.2;
  // largura aproximada de "STEVI" na Big Shoulders 900: ~0.35em por letra
  const w = size * 0.35 * 5;
  return `
  <text x="${x}" y="${y}" font-family="${F.display}" font-weight="900" font-size="${size}" fill="${t.fg}">${upper('Stevi')}</text>
  <circle cx="${x + w + dot * 0.9}" cy="${y - dot * 0.55}" r="${dot / 2}" fill="${C.cereja}"/>`;
}

/** Rótulo: caixa-alta, espaçado, secundário — o "eyebrow" do site. */
export function rotulo(x: number, y: number, text: string, theme: CardTheme = 'light', anchor: 'start' | 'end' | 'middle' = 'start'): string {
  const t = tone(theme);
  return `<text x="${x}" y="${y}" font-family="${F.corpo}" font-weight="600" font-size="${T.micro}" letter-spacing="1.6" fill="${t.fg2}" text-anchor="${anchor}">${upper(text)}</text>`;
}

/** Manchete em display caixa-alta. */
export function display(x: number, y: number, text: string, size = T.display, color = C.tinta, anchor: 'start' | 'end' | 'middle' = 'start'): string {
  return `<text x="${x}" y="${y}" font-family="${F.display}" font-weight="900" font-size="${size}" letter-spacing="-0.5" fill="${color}" text-anchor="${anchor}">${upper(text)}</text>`;
}

/** Texto de corpo (Hanken). */
export function body(x: number, y: number, text: string, opts: { size?: number; color?: string; weight?: 500 | 600; anchor?: 'start' | 'end' | 'middle' } = {}): string {
  const { size = T.body, color = C.tinta, weight = 500, anchor = 'start' } = opts;
  return `<text x="${x}" y="${y}" font-family="${F.corpo}" font-weight="${weight}" font-size="${size}" fill="${color}" text-anchor="${anchor}">${esc(text)}</text>`;
}

/** Dado em mono (Delta T, pH, °C, R$). */
export function mono(x: number, y: number, text: string, opts: { size?: number; color?: string; anchor?: 'start' | 'end' | 'middle' } = {}): string {
  const { size = T.small, color = C.tinta, anchor = 'start' } = opts;
  return `<text x="${x}" y="${y}" font-family="${F.mono}" font-weight="500" font-size="${size}" fill="${color}" text-anchor="${anchor}">${esc(text)}</text>`;
}

/**
 * Cabeçalho: wordmark + rótulo do card, sempre no mesmo lugar (x, y = linha de
 * base do wordmark). O título vai como rótulo à direita do wordmark.
 */
export function brandHeader(x: number, y: number, title: string, theme: CardTheme = 'light'): string {
  return `
  ${wordmark(x, y, theme)}
  ${rotulo(x + 92, y - 1, title, theme)}`;
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
  const color = flat ? C.cinza : up ? C.go : C.nogo;
  const bg = flat ? T.pillFlat : up ? T.pillGo : T.pillNo;
  const w = 22 + label.length * 9.5 + 18;
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
  <text x="${iconCx + 12}" y="${cy + 5}" font-family="${F.mono}" font-weight="500" font-size="${T.small - 1}" fill="${color}">${esc(label)}</text>`;
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

/** Bold share CTA content for card footers: the typable way back to
 * Stevi that survives a forward (screenshots included). Static per card TYPE —
 * never per user (a per-user link would leak who forwarded it). */
export function waCta(prompt: string): string {
  // O fallback (e o motivo dele) vive em _lib/waNumber.ts: env sem valor não
  // pode APAGAR a volta do card pra Stevi, que é o canal de aquisição.
  const digits = publicWaNumber();
  return `wa.me/${digits} · manda "${prompt}"`;
}

/** "emitido hoje, dd/mm · HH:mm" stamp (BRT). A verdict card lives on in chats
 * and forwards — without a timestamp, "agora" reads as forever. */
export function issuedStamp(now: Date = new Date()): string {
  const s = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);
  return `emitido hoje, ${s.replace(', ', ' · ')}`;
}

/** 1px hairline separator. */
export function hairline(x1: number, x2: number, y: number, theme: CardTheme = 'light'): string {
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${tone(theme).line}" stroke-width="1"/>`;
}

/** Fio forte (na cor do texto) — abre uma seção, como as bordas dos números no site. */
export function rule(x1: number, x2: number, y: number, theme: CardTheme = 'light'): string {
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${tone(theme).fg}" stroke-width="1.5"/>`;
}

/**
 * Rodapé padrão: fio + linha 1 (leitura, cinza) + linha 2 (CTA em mono, forte).
 * `y` é a linha do fio; ocupa 60px abaixo dele.
 */
export function footer(x1: number, x2: number, y: number, line1: string, line2: string | null, theme: CardTheme = 'light'): string {
  const t = tone(theme);
  return `
  ${hairline(x1, x2, y, theme)}
  ${body(x1, y + 30, line1, { size: T.small, color: t.fg2 })}
  ${line2 ? mono(x1, y + 56, line2, { size: T.small, color: t.fg }) : ''}`;
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
      defaultFontFamily: F.corpo,
      loadSystemFonts: false,
    },
    background: C.creme,
  });
  return Buffer.from(resvg.render().asPng());
}
