/**
 * Frost card: the geada alert as a shareable image. In July, MG coffee
 * country forwards frost warnings farm to farm — this card carries the
 * warning (and Stevi's name) at arm's-length readability: one big worst-night
 * number, a strip of the risky days, protection guidance with no products.
 */

import type { FrostDay } from '../tools/frost';
import { C, T, esc, cardShell, brandHeader, hairline } from './render';

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

const RISK = {
  geada: { color: '#3b6fb2', label: 'GEADA PROVÁVEL', note: 'temperatura de formação de geada' },
  risco: { color: C.caution, label: 'RISCO DE GEADA', note: 'perto do ponto de geada' },
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

  const stripY = 300;
  const cellW = (W - M * 2) / shown.length;
  const strip = shown
    .map((d, i) => {
      const x = M + i * cellW;
      const col = RISK[d.risk].color;
      return `
      <rect x="${x + 4}" y="${stripY}" width="${cellW - 8}" height="88" rx="12" fill="${col}" opacity="0.14"/>
      <rect x="${x + 4}" y="${stripY}" width="${cellW - 8}" height="6" rx="3" fill="${col}"/>
      <text x="${x + cellW / 2}" y="${stripY + 40}" font-family="DM Sans" font-size="22" font-weight="700" fill="${C.ink}" text-anchor="middle">${dm(d.date)}</text>
      <text x="${x + cellW / 2}" y="${stripY + 72}" font-family="DM Sans" font-size="24" fill="${col}" text-anchor="middle">${celsius(d.minC)} °C</text>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${cardShell(W, H)}
  ${brandHeader(M, 92, 'Alerta de geada')}

  ${snowflake(M + 15, 162, r.color)}
  <text x="${M + 44}" y="178" font-family="Instrument Serif" font-size="${T.display}" fill="${r.color}">${esc(r.label)}</text>
  <text x="${M}" y="232" font-family="DM Sans" font-size="${T.body}" fill="${C.ink}">Mínima de ${celsius(worst.minC)} °C na madrugada de ${dm(worst.date)} — ${esc(r.note)}.</text>

  ${strip}

  ${hairline(M, W - M, H - 104)}
  <text x="${M}" y="${H - 68}" font-family="DM Sans" font-size="${T.small}" fill="${C.green2}">Vale proteger mudas e talhões baixos, e conversar com seu técnico sobre irrigação na véspera.</text>
  <text x="${M}" y="${H - 42}" font-family="DM Sans" font-size="${T.small}" fill="${C.muted}">Previsão pra localização da SUA lavoura — manda um "oi" pra Stevi no WhatsApp pra receber o aviso.</text>
</svg>`;
}
