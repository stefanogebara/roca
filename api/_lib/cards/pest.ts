/**
 * Pest-triage card: the photo diagnosis as a visual — what Stevi thinks it is,
 * how sure she is, what she saw, and (grounded in Agrofit) what's registered for
 * it, with the compliance line front and centre: triagem, não prescrição. The
 * product/dose decision always stays with the agrônomo + receituário, so the
 * card never shows a dose — only chemical groups for rotation literacy.
 */

import { C, T, esc, cardShell, brandHeader } from './render';

const W = 900;
const H = 560;
const M = T.margin;

/** Confidence → colour + PT-BR label. */
const CONF: Record<string, { color: string; label: string }> = {
  alta: { color: C.leaf, label: 'confiança alta' },
  media: { color: C.caution, label: 'confiança média' },
  baixa: { color: C.muted, label: 'confiança baixa' },
};

export interface PestCardData {
  /** Identified pest/disease common name. */
  pest: string;
  crop?: string | null;
  confidence: 'alta' | 'media' | 'baixa';
  /** One-line "what I see" from the vision pass. */
  evidence?: string | null;
  /** Agrofit: number of registered products (informational, not a recommendation). */
  products?: number | null;
  /** FRAC/IRAC chemical groups present (rotation literacy) — never a dose. */
  groups?: string[];
}

/** Wrap text into lines of at most `max` chars (word-boundary), capped at `maxLines`. */
function wrap(text: string, max: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length === maxLines - 1) break;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  const joined = lines.join(' ');
  if (joined.length < text.length && lines.length) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/[.,;]?$/, '…');
  }
  return lines;
}

/** Rounded chip with text; returns SVG and the width consumed. */
function chip(x: number, y: number, label: string): { svg: string; w: number } {
  const w = 22 + label.length * 10.5;
  const svg = `<rect x="${x}" y="${y}" width="${w}" height="38" rx="19" fill="${C.cream}" stroke="${C.line}" stroke-width="1.5"/><text x="${x + w / 2}" y="${y + 25}" font-family="DM Sans" font-size="19" fill="${C.green2}" text-anchor="middle">${esc(label)}</text>`;
  return { svg, w };
}

export function pestSvg(data: PestCardData): string {
  const conf = CONF[data.confidence] ?? CONF.media;
  const evidenceLines = data.evidence ? wrap(data.evidence, 62, 2) : [];

  // Agrofit strip + group chips.
  const groups = (data.groups ?? []).slice(0, 4);
  let chipsSvg = '';
  let cx = 48;
  const chipY = 402;
  for (const g of groups) {
    const c = chip(cx, chipY, g);
    chipsSvg += c.svg;
    cx += c.w + 12;
    if (cx > W - 120) break;
  }

  const agrofitLine =
    data.products != null
      ? `Agrofit (MAPA): ${data.products} produtos registrados${data.crop ? ` pra ${esc(data.crop)}` : ''}.`
      : 'Sem registro localizado no Agrofit pra esse alvo.';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${cardShell(W, H)}
  ${brandHeader(M, 90, 'Triagem por foto')}

  <text x="48" y="176" font-family="Instrument Serif" font-size="60" fill="${C.green}">${esc(data.pest)}</text>

  <rect x="48" y="196" width="${22 + conf.label.length * 11}" height="40" rx="20" fill="${conf.color}"/>
  <text x="${48 + (22 + conf.label.length * 11) / 2}" y="223" font-family="DM Sans" font-size="20" font-weight="700" fill="#fff" text-anchor="middle">${esc(conf.label)}</text>
  ${data.crop ? `<text x="${48 + (22 + conf.label.length * 11) + 20}" y="223" font-family="DM Sans" font-size="22" fill="${C.ink}">cultura: ${esc(data.crop)}</text>` : ''}

  ${
    evidenceLines.length
      ? `<text x="48" y="292" font-family="DM Sans" font-size="21" font-weight="700" fill="${C.muted}">O que se vê</text>` +
        evidenceLines
          .map(
            (l, i) =>
              `<text x="48" y="${324 + i * 30}" font-family="DM Sans" font-size="22" fill="${C.ink}">${esc(l)}</text>`
          )
          .join('')
      : ''
  }

  <line x1="48" y1="374" x2="${W - 48}" y2="374" stroke="${C.line}" stroke-width="1"/>
  ${chipsSvg}
  <text x="48" y="${groups.length ? 462 : 410}" font-family="DM Sans" font-size="${T.small}" fill="${C.muted}">${esc(agrofitLine)}</text>

  <rect x="${M - 8}" y="${H - 80}" width="${W - (M - 8) * 2}" height="48" rx="16" fill="${C.green}"/>
  <text x="${W / 2}" y="${H - 50}" font-family="DM Sans" font-size="${T.small}" font-weight="700" fill="${C.cream}" text-anchor="middle">Produto e dose: só o agrônomo, no receituário · triagem, não prescrição</text>
</svg>`;
}
