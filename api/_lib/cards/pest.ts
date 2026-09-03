/**
 * Pest-triage card: the photo diagnosis as a visual — what Stevi thinks it is,
 * how sure she is, what she saw, and (grounded in Agrofit) what's registered for
 * it, with the compliance line front and centre: triagem, não prescrição. The
 * product/dose decision always stays with the agrônomo + receituário, so the
 * card never shows a dose — only chemical groups for rotation literacy.
 */

import { C, T, F, esc, cardShell, brandHeader, hairline, display, body, mono, rotulo } from './render';

const W = 900;
const H = 560;
const M = T.margin;

/** Confidence → colour + PT-BR label. */
const CONF: Record<string, { color: string; label: string }> = {
  alta: { color: C.folha, label: 'confiança alta' },
  media: { color: C.caution, label: 'confiança média' },
  baixa: { color: C.cinza, label: 'confiança baixa' },
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

/** Chip de grupo químico (mono sobre creme-2); returns SVG and the width consumed. */
function chip(x: number, y: number, label: string): { svg: string; w: number } {
  const w = 24 + label.length * 9.6;
  const svg = `<rect x="${x}" y="${y}" width="${w}" height="36" rx="18" fill="${C.creme2}"/>${mono(x + w / 2, y + 24, label, { size: 16, color: C.tinta, anchor: 'middle' })}`;
  return { svg, w };
}

export function pestSvg(data: PestCardData): string {
  const conf = CONF[data.confidence] ?? CONF.media;
  const evidenceLines = data.evidence ? wrap(data.evidence, 62, 2) : [];

  // Agrofit strip + group chips.
  const groups = (data.groups ?? []).slice(0, 4);
  let chipsSvg = '';
  let cx = M;
  const chipY = 400;
  for (const g of groups) {
    const c = chip(cx, chipY, g);
    chipsSvg += c.svg;
    cx += c.w + 10;
    if (cx > W - 120) break;
  }

  const agrofitLine =
    data.products != null
      ? `Agrofit (MAPA): ${data.products} produtos registrados${data.crop ? ` pra ${data.crop}` : ''}.`
      : 'Sem registro localizado no Agrofit pra esse alvo.';

  // Nome longo (ex.: "Lagarta-do-cartucho") cabe em 64px; acima disso, reduz.
  const nameSize = data.pest.length > 22 ? 48 : 64;
  const confW = 24 + conf.label.length * 9.4;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${cardShell(W, H)}
  ${brandHeader(M, 78, 'Triagem por foto')}

  ${display(M, 176, data.pest, nameSize)}

  <rect x="${M}" y="200" width="${confW}" height="34" rx="17" fill="${conf.color}"/>
  <text x="${M + confW / 2}" y="223" font-family="${F.corpo}" font-weight="600" font-size="15" fill="#fff" text-anchor="middle">${esc(conf.label)}</text>
  ${data.crop ? body(M + confW + 18, 224, `cultura: ${data.crop}`, { size: 18, color: C.cinza }) : ''}

  ${
    evidenceLines.length
      ? rotulo(M, 292, 'O que se vê') +
        evidenceLines
          .map((l, i) => body(M, 324 + i * 30, l, { size: 21, color: C.tinta }))
          .join('')
      : ''
  }

  ${hairline(M, W - M, 374)}
  ${chipsSvg}
  ${body(M, groups.length ? 462 : 410, agrofitLine, { size: T.small, color: C.cinza })}

  <rect x="0" y="${H - 64}" width="${W}" height="64" fill="${C.tinta}"/>
  ${mono(W / 2, H - 26, 'Produto e dose: só o agrônomo, no receituário · triagem, não prescrição', { size: 15, color: C.creme, anchor: 'middle' })}
</svg>`;
}
