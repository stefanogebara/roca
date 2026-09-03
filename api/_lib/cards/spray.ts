/**
 * Spray-window card: an hour-by-hour timeline of go / caution / no-go for
 * "posso pulverizar hoje?", rendered as SVG (→ PNG). Green/amber/red bands make
 * the window readable at a glance — faster than parsing a text verdict, which
 * matters for low-literacy users in the field.
 */

import { type HourAssessment, DELTA_T_MIN, DELTA_T_MAX } from '../tools/deltaT';
import { C, T, F, esc, cardShell, brandHeader, hairline, issuedStamp, display, body, mono } from './render';

const W = 900;
const H = 520;
const M = T.margin;

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

  const padX = M;
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
        <rect x="${x + 3}" y="${trackY}" width="${cellW - 6}" height="${barH}" rx="6" fill="${col}"/>
        ${mono(x + cellW / 2, trackY + barH + 26, hourLabel(h.time), { size: 17, color: C.tinta, anchor: 'middle' })}
        ${isNow ? `<text x="${x + cellW / 2}" y="${trackY - 12}" font-family="${F.corpo}" font-weight="600" font-size="${T.micro}" letter-spacing="1.2" fill="${C.tinta}" text-anchor="middle">AGORA<title>agora</title></text>` : ''}
        ${isBest ? `<text x="${x + cellW / 2}" y="${trackY - 12}" font-family="${F.corpo}" font-weight="600" font-size="${T.micro}" letter-spacing="1.2" fill="${C.folha}" text-anchor="middle">MELHOR<title>melhor</title></text>` : ''}
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
  ${cardShell(W, H)}
  ${brandHeader(padX, 78, 'Janela de pulverização')}
  ${mono(W - padX, 78, issuedStamp(), { size: T.micro, color: C.cinza, anchor: 'end' })}

  <circle cx="${padX + 22}" cy="${176}" r="22" fill="${v.color}"/>
  ${verdictMark(now.verdict, padX + 22, 176)}
  ${display(padX + 62, 198, `${v.label} agora`, 60)}

  ${mono(padX, 244, `Delta T ${now.deltaT} °C · vento ${Math.round(now.windKmh)} km/h${now.precipProb != null ? ` · chuva ${now.precipProb}%` : ''}`, { size: 18, color: C.cinza })}

  ${bars}

  ${hairline(padX, W - padX, H - 104)}
  ${body(padX, H - 70, best, { size: T.small, color: C.tinta, weight: 600 })}
  ${body(padX, H - 44, `Faixa boa: Delta T ${DELTA_T_MIN}–${DELTA_T_MAX} °C, vento fraco, sem chuva. Combine com o que você vê no campo.`, { size: T.small, color: C.cinza })}
  <desc>${esc(v.label)} agora</desc>
</svg>`;
}
