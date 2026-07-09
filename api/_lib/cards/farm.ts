/**
 * Farm card: the pin-drop payback moment as a visual — "ele conhece minha
 * terra". One glance shows where the farm is (UF), the soil under it, the spray
 * window right now, and whether the state is in vazio sanitário. Mirrors the
 * text farm card (farmcard.ts) so the image and the reply always agree; both are
 * built from the same tool primitives (soil, deltaT, vazio), so the card can't
 * drift from the words.
 */

import type { SprayVerdict } from '../tools/deltaT';
import { C, esc } from './render';

const W = 900;
const H = 600;

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
  return `<path d="M${cx},${cy - 16} C${cx - 11},${cy - 16} ${cx - 11},${cy - 2} ${cx},${cy + 10} C${cx + 11},${cy - 2} ${cx + 11},${cy - 16} ${cx},${cy - 16} Z" fill="${col}"/><circle cx="${cx}" cy="${cy - 9}" r="4.2" fill="#fff"/>`;
}

/** One labelled row block: dot + heading + value line. Returns SVG. */
function row(y: number, dotCol: string, dotInner: string, heading: string, value: string): string {
  const x = 56;
  return `
    <circle cx="${x + 18}" cy="${y}" r="20" fill="${dotCol}"/>
    ${dotInner ? dotInner.replace('__CX__', String(x + 18)).replace('__CY__', String(y)) : ''}
    <text x="${x + 56}" y="${y - 6}" font-family="DM Sans" font-size="20" font-weight="700" fill="${C.muted}">${esc(heading)}</text>
    <text x="${x + 56}" y="${y + 24}" font-family="DM Sans" font-size="26" fill="${C.ink}">${esc(value)}</text>`;
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
  let sprayDot = C.muted;
  let sprayInner = '';
  let sprayText = 'Sem dados de clima agora.';
  if (data.spray) {
    const v = VERDICT[data.spray.verdict];
    sprayDot = v.color;
    sprayInner = markToken(data.spray.verdict);
    sprayText = `${v.label} · Delta T ${data.spray.deltaT} °C · vento ${Math.round(data.spray.windKmh)} km/h`;
  }

  // Vazio row.
  const vazioDot = data.vazio?.active ? C.nogo : C.leaf;
  const vazioText = !data.vazio
    ? 'Sem janela de vazio sanitário mapeada aqui.'
    : data.vazio.active
      ? 'Vazio sanitário da soja ATIVO — nenhuma soja viva no campo.'
      : 'Fora do vazio sanitário da soja no momento.';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.cream}"/>
  <rect x="24" y="24" width="${W - 48}" height="${H - 48}" rx="24" fill="${C.card}" stroke="${C.line}" stroke-width="2"/>

  ${pin(74, 92, C.leaf)}
  <text x="104" y="90" font-family="Instrument Serif" font-size="46" fill="${C.green}">Sua lavoura</text>
  <text x="104" y="122" font-family="DM Sans" font-size="20" fill="${C.muted}">Stevi · ${esc(where)}</text>

  <line x1="56" y1="156" x2="${W - 56}" y2="156" stroke="${C.line}" stroke-width="2"/>

  ${row(220, C.soil, '<circle cx="__CX__" cy="__CY__" r="7" fill="#fff"/>', 'SOLO', soilText)}
  ${row(330, sprayDot, sprayInner, 'PULVERIZAÇÃO AGORA', sprayText)}
  ${row(440, vazioDot, '', 'CALENDÁRIO SANITÁRIO', vazioText)}

  <line x1="56" y1="496" x2="${W - 56}" y2="496" stroke="${C.line}" stroke-width="2"/>
  <text x="56" y="540" font-family="DM Sans" font-size="19" fill="${C.muted}">Leituras aproximadas (solo, clima, satélite) pra orientar — não substituem o agrônomo.</text>
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
