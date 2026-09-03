/**
 * "Quem responde" card — the /verificar page as a shareable square image.
 *
 * The moment of highest distrust is a producer typing "isso é golpe?" or "vc é
 * robô?" — or forwarding Stevi's message to the group asking the same. The
 * text answer is honest but doesn't travel; a picture does. This card carries
 * the number that wrote, who stands behind it (only when the env has it —
 * NEVER a fabricated name or CREA), the AI disclosure and the line the whole
 * product stands on: triagem, não prescrição.
 *
 * Square (1080×1080) because it's meant to be forwarded and read in a group
 * thumbnail, not opened. Same config source as the page (VerifierConfig), so
 * image and page can't disagree.
 */

import type { VerifierConfig } from '../verifierPage';
import { C, T, esc, cardShell, wordmark, rotulo, display, body, mono, hairline } from './render';

const W = 1080;
const H = 1080;
const M = 72;

/** +19705509125 → "+1 (970) 550-9125" for reading; digits stay for the link. */
export function telBonito(digits: string): string {
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  return `+${digits}`;
}

/** Drawn check mark inside a circle (no emoji font). */
function selo(cx: number, cy: number, r: number, col: string): string {
  const s = `stroke="${C.creme}" stroke-width="${Math.round(r / 4)}" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  const k = r / 22;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}"/><path d="M${cx - 9 * k},${cy} L${cx - 2 * k},${cy + 8 * k} L${cx + 10 * k},${cy - 8 * k}" ${s}/>`;
}

export interface VerifyCardData extends VerifierConfig {
  /** Public host of the verification page, e.g. "roca-black.vercel.app". */
  host: string;
}

/** Build the "quem responde" SVG. Pure. Identity blocks render only when set. */
export function verifySvg(data: VerifyCardData): string {
  const digits = data.waNumber.replace(/\D/g, '');
  const tel = `+${digits}`;

  // Blocos de identidade — só com valor real no env. Nunca fabricados.
  const linhas: Array<{ rot: string; val: string; mono?: boolean }> = [];
  if (data.responsible) linhas.push({ rot: 'Responsável pela Stevi', val: data.responsible });
  if (data.agronomo && data.crea) {
    linhas.push({ rot: 'Agrônomo parceiro', val: `${data.agronomo} · ${data.crea}` });
  }
  if (data.lgpdEmail) linhas.push({ rot: 'Seus dados (LGPD)', val: data.lgpdEmail, mono: true });

  // A coluna de identidade começa depois do número; cada linha ocupa 76px —
  // com as três linhas do env cheio, a divulgação ainda cabe acima da faixa.
  const idTop = 604;
  const idSvg = linhas
    .map((l, i) => {
      const y = idTop + i * 76;
      return `
  ${hairline(M, W - M, y)}
  ${rotulo(M, y + 28, l.rot)}
  ${l.mono ? mono(M, y + 58, l.val, { size: 22, color: C.tinta }) : body(M, y + 58, l.val, { size: 24, color: C.tinta, weight: 600 })}`;
    })
    .join('');
  const idBottom = linhas.length ? idTop + linhas.length * 76 : idTop;

  // Disclosure: sempre. Vai logo abaixo da identidade (ou do número).
  const discY = idBottom + 8;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${cardShell(W, H)}
  ${wordmark(M, 96, 'light', 36)}
  ${rotulo(M + 112, 95, 'Verificação')}

  ${selo(W - M - 34, 86, 34, C.folha)}

  ${display(M, 262, 'Sim, a Stevi', 132)}
  ${display(M, 394, 'é de verdade.', 132)}

  ${rotulo(M, 452, 'O número que te escreveu')}
  ${display(M, 540, telBonito(digits), 84)}
  ${mono(M, 578, tel, { size: 20, color: C.cinza })}

  ${idSvg}

  ${hairline(M, W - M, discY)}
  ${body(M, discY + 40, 'A Stevi é um robô (inteligência artificial), não uma pessoa — e ela avisa isso.', { size: 22, color: C.tinta })}
  ${body(M, discY + 74, 'Ela não receita defensivo: produto e dose é o engenheiro agrônomo, no receituário.', { size: 22, color: C.cinza })}

  <rect x="0" y="${H - 132}" width="${W}" height="132" fill="${C.tinta}"/>
  ${display(M, H - 72, 'Triagem, não prescrição.', 44, C.creme)}
  ${mono(W - M, H - 76, `${data.host}/verificar`, { size: 22, color: C.creme, anchor: 'end' })}
  ${mono(W - M, H - 44, 'confira antes de confiar', { size: 16, color: C.cinzaClaro, anchor: 'end' })}
  <desc>${esc(`Sim, a Stevi é de verdade. ${tel}. Triagem, não prescrição.`)}</desc>
</svg>`;
}
