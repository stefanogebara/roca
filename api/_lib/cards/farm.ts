/**
 * Farm card: the pin-drop payback moment as a visual — "ele conhece minha
 * terra". One glance shows where the farm is (UF), the soil under it, the spray
 * window right now, and whether the state is in vazio sanitário. Mirrors the
 * text farm card (farmcard.ts) so the image and the reply always agree; both are
 * built from the same tool primitives (soil, deltaT, vazio), so the card can't
 * drift from the words.
 */

import type { SprayVerdict } from '../tools/deltaT';
import { C, T, esc, cardShell, brandHeader, hairline, issuedStamp, display, body, mono, rotulo } from './render';

const W = 900;
const H = 600;
const M = T.margin;

const VERDICT: Record<SprayVerdict, { color: string; label: string }> = {
  go: { color: C.go, label: 'Pode pulverizar' },
  caution: { color: C.caution, label: 'Atenção' },
  'no-go': { color: C.nogo, label: 'Melhor não agora' },
};

export interface FarmCardData {
  /** State abbreviation (e.g. "MT"), or null if reverse-geocode failed. */
  uf: string | null;
  soil: { texture: string | null; ph: number | null; acid: boolean } | null;
  spray: { verdict: SprayVerdict; deltaT: number; windKmh: number } | null;
  /** Vazio sanitário: present only when the UF is in the grounded table. */
  vazio: { active: boolean } | null;
}

/** A pin glyph drawn as an SVG path (no emoji font). */
function pin(cx: number, cy: number, col: string): string {
  return `<path d="M${cx},${cy - 16} C${cx - 11},${cy - 16} ${cx - 11},${cy - 2} ${cx},${cy + 10} C${cx + 11},${cy - 2} ${cx + 11},${cy - 16} ${cx},${cy - 16} Z" fill="${col}"/><circle cx="${cx}" cy="${cy - 9}" r="4.2" fill="${C.creme}"/>`;
}

/** One labelled row block: dot + heading + value line. Returns SVG. */
function row(y: number, dotCol: string, dotInner: string, heading: string, value: string): string {
  const x = M;
  return `
    <circle cx="${x + 18}" cy="${y}" r="20" fill="${dotCol}"/>
    ${dotInner ? dotInner.replace('__CX__', String(x + 18)).replace('__CY__', String(y)) : ''}
    ${rotulo(x + 56, y - 8, heading)}
    ${body(x + 56, y + 22, value, { size: 23, color: C.tinta })}`;
}

export function farmSvg(data: FarmCardData): string {
  const where = data.uf ? `Estado: ${data.uf}` : 'Localização registrada';

  // Soil line.
  let soilText = 'Não consegui ler o solo agora.';
  if (data.soil) {
    const parts: string[] = [];
    if (data.soil.texture) parts.push(data.soil.texture);
    if (data.soil.ph != null) parts.push(`pH ~${data.soil.ph}`);
    if (parts.length) soilText = parts.join(' · ');
    if (data.soil.acid) soilText += ' · ácido, calagem comum';
  }

  // Spray row (with verdict color + mark inside the dot).
  let sprayDot = C.cinzaClaro;
  let sprayInner = '';
  let sprayText = 'Sem dados de clima agora.';
  if (data.spray) {
    const v = VERDICT[data.spray.verdict];
    sprayDot = v.color;
    sprayInner = markToken(data.spray.verdict);
    sprayText = `${v.label} · Delta T ${data.spray.deltaT} °C · vento ${Math.round(data.spray.windKmh)} km/h`;
  }

  // Vazio row.
  const vazioDot = data.vazio?.active ? C.nogo : C.folha;
  const vazioText = !data.vazio
    ? 'Sem janela de vazio sanitário mapeada aqui.'
    : data.vazio.active
      ? 'Vazio sanitário da soja ATIVO — nenhuma soja viva no campo.'
      : 'Fora do vazio sanitário da soja no momento.';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${cardShell(W, H)}
  ${brandHeader(M, 78, 'Cartão da lavoura')}
  ${mono(W - M, 78, issuedStamp(), { size: T.micro, color: C.cinza, anchor: 'end' })}

  ${pin(M + 14, 168, C.cereja)}
  ${display(M + 40, 190, 'Sua lavoura', 60)}
  ${mono(M, 226, where, { size: 17, color: C.cinza })}

  ${hairline(M, W - M, 254)}

  ${row(310, C.soil, `<circle cx="__CX__" cy="__CY__" r="7" fill="${C.creme}"/>`, 'Solo', soilText)}
  ${row(410, sprayDot, sprayInner, 'Pulverização agora', sprayText)}
  ${row(510, vazioDot, '', 'Calendário sanitário', vazioText)}

  ${hairline(M, W - M, 556)}
  ${body(M, 582, 'Leituras aproximadas (solo, clima, satélite) pra orientar — não substituem o agrônomo.', { size: T.small, color: C.cinza })}
  <desc>${esc(where)}</desc>
</svg>`;
}

/** Verdict mark using row()'s __CX__/__CY__ placeholder tokens. */
function markToken(verdict: SprayVerdict): string {
  const s = 'stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"';
  if (verdict === 'go')
    return `<path d="M-9,0 L-2,8 L10,-8" transform="translate(__CX__,__CY__)" ${s}/>`;
  if (verdict === 'no-go')
    return `<path d="M-8,-8 L8,8 M8,-8 L-8,8" transform="translate(__CX__,__CY__)" ${s}/>`;
  return `<path d="M0,-9 L0,3" transform="translate(__CX__,__CY__)" ${s}/><circle cx="__CX__" cy="__CY__" r="2.6" fill="#fff" transform="translate(0,9)"/>`;
}
