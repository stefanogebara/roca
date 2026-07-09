/**
 * Spray-window card: an hour-by-hour timeline of go / caution / no-go for
 * "posso pulverizar hoje?", rendered as SVG (→ PNG). Green/amber/red bands make
 * the window readable at a glance — faster than parsing a text verdict, which
 * matters for low-literacy users in the field.
 */

import type { HourAssessment } from '../tools/deltaT';
import { C, esc } from './render';

const W = 900;
const H = 520;

const VERDICT = {
  go: { color: C.go, label: 'Pode pulverizar' },
  caution: { color: C.caution, label: 'Atenção' },
  'no-go': { color: C.nogo, label: 'Melhor não' },
} as const;

/** White verdict mark drawn as SVG (no emoji font needed): ✓ / ! / ✕. */
function verdictMark(verdict: HourAssessment['verdict'], cx: number, cy: number): string {
  const s = 'stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"';
  if (verdict === 'go') return `<path d="M${cx - 9},${cy} L${cx - 2},${cy + 8} L${cx + 10},${cy - 8}" ${s}/>`;
  if (verdict === 'no-go')
    return `<path d="M${cx - 8},${cy - 8} L${cx + 8},${cy + 8} M${cx + 8},${cy - 8} L${cx - 8},${cy + 8}" ${s}/>`;
  // caution: exclamation
  return `<path d="M${cx},${cy - 9} L${cx},${cy + 3}" ${s}/><circle cx="${cx}" cy="${cy + 9}" r="2.6" fill="#fff"/>`;
}

/** hour "2026-07-09T14:00" → "14h". */
function hourLabel(iso: string): string {
  const m = iso.match(/T(\d{2})/);
  return m ? `${m[1]}h` : '';
}

/**
 * Build the spray-window SVG. `hours[0]` is "now"; up to 12 hours are drawn as a
 * timeline. `bestUpcoming` (if the current hour isn't 'go') is highlighted.
 */
export function spraySvg(hours: HourAssessment[], bestUpcoming: HourAssessment | null): string {
  const now = hours[0];
  const v = VERDICT[now.verdict];
  const cells = hours.slice(0, 12);
  const n = cells.length;

  const padX = 48;
  const trackY = 300;
  const trackW = W - padX * 2;
  const cellW = trackW / n;

  const bars = cells
    .map((h, i) => {
      const x = padX + i * cellW;
      const col = VERDICT[h.verdict].color;
      const isNow = i === 0;
      const isBest = bestUpcoming && h.time === bestUpcoming.time;
      const barH = 64;
      return `
        <rect x="${x + 3}" y="${trackY}" width="${cellW - 6}" height="${barH}" rx="7" fill="${col}"/>
        <text x="${x + cellW / 2}" y="${trackY + barH + 26}" font-family="DM Sans" font-size="20" fill="${C.ink}" text-anchor="middle">${hourLabel(h.time)}</text>
        ${isNow ? `<text x="${x + cellW / 2}" y="${trackY - 12}" font-family="DM Sans" font-size="17" font-weight="700" fill="${C.green}" text-anchor="middle">agora</text>` : ''}
        ${isBest ? `<text x="${x + cellW / 2}" y="${trackY - 12}" font-family="DM Sans" font-size="17" font-weight="700" fill="${C.leaf}" text-anchor="middle">melhor</text>` : ''}
      `;
    })
    .join('');

  const best =
    bestUpcoming != null
      ? `Janela melhor hoje: por volta das ${hourLabel(bestUpcoming.time)} (Delta T ${bestUpcoming.deltaT} °C).`
      : now.verdict === 'go'
        ? 'A janela agora está boa.'
        : 'Sem janela boa clara nas próximas horas.';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.cream}"/>
  <rect x="24" y="24" width="${W - 48}" height="${H - 48}" rx="24" fill="${C.card}" stroke="${C.line}" stroke-width="2"/>

  <text x="${padX}" y="92" font-family="DM Sans" font-size="26" font-weight="700" fill="${C.muted}">Stevi · Janela de pulverização</text>

  <circle cx="${padX + 22}" cy="150" r="22" fill="${v.color}"/>
  ${verdictMark(now.verdict, padX + 22, 150)}
  <text x="${padX + 62}" y="162" font-family="Instrument Serif" font-size="52" fill="${C.green}">${esc(v.label)} agora</text>

  <text x="${padX}" y="220" font-family="DM Sans" font-size="26" fill="${C.ink}">Delta T ${now.deltaT} °C · vento ${Math.round(now.windKmh)} km/h${now.precipProb != null ? ` · chuva ${now.precipProb}%` : ''}</text>

  ${bars}

  <text x="${padX}" y="${H - 70}" font-family="DM Sans" font-size="23" fill="${C.green2}">${esc(best)}</text>
  <text x="${padX}" y="${H - 38}" font-family="DM Sans" font-size="18" fill="${C.muted}">Faixa boa: Delta T 2–8 °C, vento fraco, sem chuva. Combine com o que você vê no campo.</text>
</svg>`;
}
