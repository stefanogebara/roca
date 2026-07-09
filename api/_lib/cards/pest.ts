/**
 * Pest-triage card: the photo diagnosis as a visual — what Stevi thinks it is,
 * how sure she is, what she saw, and (grounded in Agrofit) what's registered for
 * it, with the compliance line front and centre: triagem, não prescrição. The
 * product/dose decision always stays with the agrônomo + receituário, so the
 * card never shows a dose — only chemical groups for rotation literacy.
 */

import { C, esc } from './render';

const W = 900;
const H = 560;

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
  <rect width="${W}" height="${H}" fill="${C.cream}"/>
  <rect x="24" y="24" width="${W - 48}" height="${H - 48}" rx="24" fill="${C.card}" stroke="${C.line}" stroke-width="2"/>

  <text x="48" y="86" font-family="DM Sans" font-size="26" font-weight="700" fill="${C.muted}">Stevi · Triagem por foto</text>

  <text x="48" y="170" font-family="Instrument Serif" font-size="64" fill="${C.green}">${esc(data.pest)}</text>

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

  <line x1="48" y1="374" x2="${W - 48}" y2="374" stroke="${C.line}" stroke-width="2"/>
  ${chipsSvg}
  <text x="48" y="${groups.length ? 476 : 410}" font-family="DM Sans" font-size="19" fill="${C.muted}">${esc(agrofitLine)}</text>

  <rect x="24" y="${H - 74}" width="${W - 48}" height="50" rx="0" fill="${C.green}"/>
  <text x="${W / 2}" y="${H - 42}" font-family="DM Sans" font-size="20" font-weight="700" fill="${C.cream}" text-anchor="middle">Produto e dose: só o agrônomo, no receituário · triagem, não prescrição</text>
</svg>`;
}
