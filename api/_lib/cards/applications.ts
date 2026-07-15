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
import { C, esc } from './render';

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
  existe_registro: C.green2,
  nao_localizado: C.caution,
  sem_dados: C.muted,
};

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

const W = 900;

/** Build the applications-report card SVG. Height grows with the row count. Pure. */
export function applicationsSvg(report: ApplicationsReport): string {
  const headerH = 190;
  const rowH = 88;
  const footerH = 132;
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
      const dose = l.dose ? esc(clip(l.dose, 18)) : '';
      return `
      <line x1="48" y1="${y}" x2="${W - 48}" y2="${y}" stroke="${C.line}" stroke-width="1"/>
      <text x="48" y="${y + 34}" font-family="DM Sans" font-size="24" font-weight="700" fill="${C.ink}">${esc(dm(l.applied_on))}</text>
      <text x="140" y="${y + 34}" font-family="DM Sans" font-size="24" font-weight="700" fill="${C.ink}">${esc(clip(l.product ?? '—', 34))}</text>
      <text x="140" y="${y + 62}" font-family="DM Sans" font-size="18" fill="${C.muted}">${esc(clip(l2 || '—', 48))}</text>
      <text x="${W - 48}" y="${y + 34}" font-family="Instrument Serif" font-size="26" fill="${C.green}" text-anchor="end">${dose}</text>
      <text x="${W - 48}" y="${y + 62}" font-family="DM Sans" font-size="17" font-weight="700" fill="${color}" text-anchor="end">${esc(l.verdict.label)}</text>`;
    })
    .join('');

  const moreNote =
    report.total > report.lines.length
      ? `+ ${report.total - report.lines.length} registro(s) anteriores`
      : '';
  const footY = headerH + report.lines.length * rowH;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.cream}"/>
  <rect x="24" y="24" width="${W - 48}" height="${H - 48}" rx="24" fill="${C.card}" stroke="${C.line}" stroke-width="2"/>

  <text x="48" y="86" font-family="Instrument Serif" font-size="40" fill="${C.green}">Stevi · Caderno de Aplicações</text>
  <text x="48" y="122" font-family="DM Sans" font-size="22" font-weight="700" fill="${C.muted}">${esc(sub)}</text>
  <text x="48" y="154" font-family="DM Sans" font-size="20" fill="${C.muted}">${esc(period)}</text>

  ${rows}

  <text x="48" y="${footY + 40}" font-family="DM Sans" font-size="18" fill="${C.muted}">${esc(moreNote)}</text>
  <line x1="48" y1="${footY + 58}" x2="${W - 48}" y2="${footY + 58}" stroke="${C.line}" stroke-width="1"/>
  <text x="48" y="${footY + 86}" font-family="DM Sans" font-size="17" fill="${C.green2}">Registro declarado pelo produtor — não é receituário nem certificação técnica.</text>
  <text x="48" y="${footY + 110}" font-family="DM Sans" font-size="16" fill="${C.muted}">A escolha de produto e dose é do agrônomo. "Registro MAPA" é cruzamento informativo com o Agrofit.</text>
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
