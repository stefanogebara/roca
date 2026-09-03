/**
 * Frost card: the geada alert as a shareable image. In July, MG coffee
 * country forwards frost warnings farm to farm — this card carries the
 * warning (and Stevi's name) at arm's-length readability: one big worst-night
 * number, a strip of the risky days, protection guidance with no products.
 *
 * É o único card ESCURO: a geada chega de noite e o alerta tem que saltar no
 * grupo — no site, as seções escuras são o desenho, não um tema.
 */

import type { FrostDay } from '../tools/frost';
import { C, T, esc, cardShell, brandHeader, hairline, waCta, display, body, mono } from './render';

const W = 900;
const H = 520;
const M = T.margin;

/** A 6-spoke snowflake drawn as SVG lines (no emoji font — tofu-proof). */
function snowflake(cx: number, cy: number, col: string, r = 15): string {
  return [0, 60, 120]
    .map((deg) => {
      const t = (deg * Math.PI) / 180;
      const dx = Math.cos(t) * r;
      const dy = Math.sin(t) * r;
      return `<line x1="${(cx - dx).toFixed(1)}" y1="${(cy - dy).toFixed(1)}" x2="${(cx + dx).toFixed(1)}" y2="${(cy + dy).toFixed(1)}" stroke="${col}" stroke-width="3" stroke-linecap="round"/>`;
    })
    .join('');
}

// Cores sobre a tinta: azul gelo para geada provável, âmbar claro para risco.
const RISK = {
  geada: { color: '#8FB4E8', label: 'Geada provável', note: 'temperatura de formação de geada' },
  risco: { color: '#E0A93A', label: 'Risco de geada', note: 'perto do ponto de geada' },
} as const;

function dm(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}

function celsius(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

/** Build the frost-alert SVG. Pure. Days must be pre-filtered to risky ones. */
export function frostSvg(days: FrostDay[]): string {
  const shown = days.slice(0, 4);
  const worst = shown.reduce((a, b) => (b.minC < a.minC ? b : a), shown[0]);
  const r = RISK[worst.risk];

  const stripY = 296;
  const cellW = (W - M * 2) / shown.length;
  const strip = shown
    .map((d, i) => {
      const x = M + i * cellW;
      const col = RISK[d.risk].color;
      return `
      <rect x="${x + 4}" y="${stripY}" width="${cellW - 8}" height="96" rx="10" fill="${col}" opacity="0.14"/>
      <rect x="${x + 4}" y="${stripY}" width="${cellW - 8}" height="5" rx="2.5" fill="${col}"/>
      ${mono(x + cellW / 2, stripY + 40, dm(d.date), { size: 18, color: C.creme, anchor: 'middle' })}
      ${display(x + cellW / 2, stripY + 82, `${celsius(d.minC)} °C`, 36, col, 'middle')}`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${cardShell(W, H, 'dark')}
  ${brandHeader(M, 78, 'Alerta de geada', 'dark')}

  ${snowflake(M + 15, 172, r.color)}
  ${display(M + 44, 194, r.label, 64, C.creme)}
  ${body(M, 240, `Mínima de ${celsius(worst.minC)} °C na madrugada de ${dm(worst.date)} — ${r.note}.`, { size: 19, color: C.cinzaClaro })}

  ${strip}

  ${hairline(M, W - M, H - 104, 'dark')}
  ${body(M, H - 70, 'Vale proteger mudas e talhões baixos, e conversar com seu técnico sobre irrigação na véspera.', { size: T.small, color: C.cinzaClaro })}
  ${mono(M, H - 44, `${waCta('geada')} — aviso pra SUA lavoura`, { size: T.small, color: C.creme })}
  <desc>${esc(r.label)}</desc>
</svg>`;
}
