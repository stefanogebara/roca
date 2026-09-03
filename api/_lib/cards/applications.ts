/**
 * Caderno de aplicações — the report model, its SVG card, and the gate-safe text
 * replies that carry it.
 *
 * Legal framing (dossier prime directive): this is a RECORD of what the farmer
 * declared they applied — never a prescription. The card echoes the declared
 * dose (it's the farmer's own record, rendered as an image the compliance gate
 * never inspects), but every text reply here is deliberately gate-safe: it names
 * no dose+product combination, so it survives checkOutbound. The card footer
 * states plainly that this is a self-declared record, not a receituário or a
 * technical certification.
 */

import type { ApplicationRow } from '../db';
import { validateApplication, type ApplicationValidation } from '../tools/applicationValidate';
import { C, T, esc, cardShell, wordmark, rotulo, display, body, mono, hairline } from './render';

export interface ReportLine {
  applied_on: string;
  crop: string | null;
  product: string | null; // product_name || active_ingredient
  dose: string | null;
  target: string | null;
  verdict: ApplicationValidation;
}

export interface ApplicationsReport {
  cropLabel: string | null;
  uf: string | null;
  period: { from: string; to: string } | null;
  total: number;
  lines: ReportLine[]; // capped for the card; `total` is the true count
}

/** dd/mm from an ISO date. */
function dm(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

/**
 * Build the report model from a farmer's declared applications. Newest first,
 * capped to `maxLines` for the card; validation is attached per line. Pure.
 */
export function buildApplicationsReport(
  profile: { uf: string | null; crop: string[] | null },
  rows: ApplicationRow[],
  opts: { maxLines?: number } = {}
): ApplicationsReport {
  const max = opts.maxLines ?? 8;
  const sorted = [...rows].sort((a, b) => b.applied_on.localeCompare(a.applied_on));
  const lines: ReportLine[] = sorted.slice(0, max).map((r) => ({
    applied_on: r.applied_on,
    crop: r.crop,
    product: r.product_name || r.active_ingredient,
    dose: r.dose_text,
    target: r.target,
    verdict: validateApplication(r),
  }));
  const dates = rows.map((r) => r.applied_on).sort();
  return {
    cropLabel: profile.crop?.length ? profile.crop.join(', ') : null,
    uf: profile.uf,
    period: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
    total: rows.length,
    lines,
  };
}

const VERDICT_COLOR: Record<ApplicationValidation['level'], string> = {
  registrado: C.go,
  existe_registro: C.tinta2,
  nao_localizado: C.caution,
  sem_dados: C.cinza,
};

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

const W = 900;
const M = T.margin;

/** Build the applications-report card SVG. Height grows with the row count. Pure. */
export function applicationsSvg(report: ApplicationsReport): string {
  const headerH = 216;
  const rowH = 88;
  const footerH = 136;
  const H = headerH + report.lines.length * rowH + footerH;

  const sub = ['declarado pelo produtor', report.cropLabel, report.uf]
    .filter(Boolean)
    .join(' · ');
  const period = report.period
    ? `Período: ${dm(report.period.from)} a ${dm(report.period.to)} · ${report.total} registro${report.total === 1 ? '' : 's'}`
    : `${report.total} registro${report.total === 1 ? '' : 's'}`;

  const rows = report.lines
    .map((l, i) => {
      const y = headerH + i * rowH;
      const color = VERDICT_COLOR[l.verdict.level];
      const l2 = [l.crop, l.target ? `contra ${l.target}` : null].filter(Boolean).join(' · ');
      const dose = l.dose ? clip(l.dose, 18) : '';
      return `
      ${hairline(M, W - M, y)}
      ${mono(M, y + 36, dm(l.applied_on), { size: 18, color: C.tinta })}
      ${body(M + 90, y + 36, clip(l.product ?? '—', 34), { size: 22, color: C.tinta, weight: 600 })}
      ${body(M + 90, y + 62, clip(l2 || '—', 48), { size: T.small, color: C.cinza })}
      ${dose ? mono(W - M, y + 36, dose, { size: 20, color: C.tinta, anchor: 'end' }) : ''}
      ${body(W - M, y + 62, l.verdict.label, { size: 15, color, weight: 600, anchor: 'end' })}`;
    })
    .join('');

  const moreNote =
    report.total > report.lines.length
      ? `+ ${report.total - report.lines.length} registro(s) anteriores`
      : '';
  const footY = headerH + report.lines.length * rowH;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${cardShell(W, H)}

  ${wordmark(M, 78)}
  ${rotulo(M + 92, 77, 'Caderno de Aplicações')}
  ${display(M, 150, 'Caderno de aplicações', 52)}
  ${body(M, 178, sub, { size: 17, color: C.cinza })}
  ${mono(M, 202, period, { size: 14, color: C.cinza })}

  ${rows}

  ${moreNote ? body(M, footY + 34, moreNote, { size: T.small, color: C.cinza }) : ''}
  ${hairline(M, W - M, footY + 54)}
  ${body(M, footY + 84, 'Registro declarado pelo produtor — não é receituário nem certificação técnica.', { size: T.small, color: C.tinta2, weight: 600 })}
  ${body(M, footY + 110, 'A escolha de produto e dose é do agrônomo. "Registro MAPA" é cruzamento informativo com o Agrofit.', { size: 15, color: C.cinza })}
  <desc>${esc(period)}</desc>
</svg>`;
}

// ---- Gate-safe text replies (no dose+product combination → survive checkOutbound) ----

/** The caption that ships with the report card. */
export function applicationsCaption(total: number): string {
  return (
    `📄 Aqui está seu caderno de aplicações — ${total} registro${total === 1 ? '' : 's'}, ` +
    'como você me contou.\n\n' +
    '_É um registro seu, declarado — dá pra levar pro seu agrônomo. A escolha de produto e dose é dele, no receituário._'
  );
}

/** Reply when the farmer asks for the report but nothing has been logged yet. */
export function applicationsEmptyReply(): string {
  return (
    '📒 Ainda não tenho nenhuma aplicação registrada no seu caderno.\n\n' +
    'Quando você aplicar algo, é só me contar — tipo "apliquei tal produto na soja hoje" (pode ser áudio). ' +
    'Eu vou guardando, e depois monto o relatório pra você levar pro agrônomo.'
  );
}

/**
 * Text-only summary — the fallback when the image card can't be signed/rendered.
 * Deliberately aggregate + gate-safe: counts and dates by crop, never a
 * dose+product line.
 */
export function applicationsTextSummary(report: ApplicationsReport): string {
  const lines: string[] = [];
  lines.push(`📄 *Seu caderno de aplicações* — ${report.total} registro${report.total === 1 ? '' : 's'}`);
  if (report.period) lines.push(`Período: ${dm(report.period.from)} a ${dm(report.period.to)}`);
  lines.push('');
  for (const l of report.lines) {
    const bits = [dm(l.applied_on), l.crop, l.target ? `contra ${l.target}` : null, l.verdict.label]
      .filter(Boolean)
      .join(' · ');
    lines.push(`• ${bits}`);
  }
  if (report.total > report.lines.length) {
    lines.push(`• + ${report.total - report.lines.length} registro(s) anteriores`);
  }
  lines.push('');
  lines.push(
    '_Registro declarado por você, pra levar pro agrônomo. A escolha de produto e dose é dele, no receituário._'
  );
  return lines.join('\n');
}
