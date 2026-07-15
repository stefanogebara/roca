/**
 * Caderno de aplicações as a one-file PDF — the forwardable/printable record.
 *
 * Same report model as the PNG card (cards/applications), rendered with pdf-lib
 * (pure JS, no native binaries — Vercel-safe; resvg only outputs PNG). Standard
 * Helvetica covers Latin-1, so Portuguese accents render; anything outside
 * WinAnsi (emoji, exotic unicode from a farmer's free-text product name) is
 * stripped so a draw never throws. Legal framing matches the card: a declared
 * record, not a receituário.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { ApplicationsReport, ReportLine } from '../cards/applications';

// A4 portrait, points.
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;

const INK = rgb(0.1, 0.14, 0.12);
const MUTED = rgb(0.42, 0.48, 0.45);
const GREEN = rgb(0.08, 0.26, 0.18);
const LINECOL = rgb(0.89, 0.86, 0.79);
const GO = rgb(0.18, 0.62, 0.39);
const CAUTION = rgb(0.79, 0.54, 0.1);

const VERDICT_COLOR: Record<ReportLine['verdict']['level'], ReturnType<typeof rgb>> = {
  registrado: GO,
  existe_registro: GREEN,
  nao_localizado: CAUTION,
  sem_dados: MUTED,
};

// Column x-offsets (from MARGIN) for the record table.
const COL = { data: 0, produto: 60, dose: 300, registro: 360 };
const ROW_H = 30;
const HEADER_BOTTOM = PAGE_H - 150; // first row baseline area
const FOOTER_TOP = 96; // reserve for the legal footer

/** Strip characters Helvetica/WinAnsi can't encode (emoji, exotic unicode). */
function san(s: string): string {
  return s.replace(/[^\x20-\x7E -ÿ]/g, '').trim();
}

function dm(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function clip(s: string, n: number): string {
  const t = san(s);
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

interface Fonts {
  reg: PDFFont;
  bold: PDFFont;
}

function drawHeader(page: PDFPage, f: Fonts, report: ApplicationsReport): void {
  page.drawText('Stevi — Caderno de Aplicações', {
    x: MARGIN,
    y: PAGE_H - MARGIN - 8,
    size: 20,
    font: f.bold,
    color: GREEN,
  });
  const sub = ['declarado pelo produtor', report.cropLabel, report.uf].filter(Boolean).join(' · ');
  page.drawText(san(sub), { x: MARGIN, y: PAGE_H - MARGIN - 30, size: 11, font: f.bold, color: MUTED });
  const period = report.period
    ? `Período: ${dm(report.period.from)} a ${dm(report.period.to)} · ${report.total} registro${report.total === 1 ? '' : 's'}`
    : `${report.total} registro${report.total === 1 ? '' : 's'}`;
  page.drawText(san(period), { x: MARGIN, y: PAGE_H - MARGIN - 48, size: 10, font: f.reg, color: MUTED });

  // Column headers
  const hy = PAGE_H - 128;
  const head = (label: string, dx: number) =>
    page.drawText(label, { x: MARGIN + dx, y: hy, size: 9, font: f.bold, color: MUTED });
  head('DATA', COL.data);
  head('PRODUTO / CULTURA · ALVO', COL.produto);
  head('DOSE', COL.dose);
  head('REGISTRO MAPA', COL.registro);
  page.drawLine({
    start: { x: MARGIN, y: hy - 6 },
    end: { x: MARGIN + CONTENT_W, y: hy - 6 },
    thickness: 1,
    color: LINECOL,
  });
}

function drawFooter(page: PDFPage, f: Fonts): void {
  page.drawLine({
    start: { x: MARGIN, y: FOOTER_TOP + 20 },
    end: { x: MARGIN + CONTENT_W, y: FOOTER_TOP + 20 },
    thickness: 1,
    color: LINECOL,
  });
  page.drawText('Registro declarado pelo produtor — não é receituário nem certificação técnica.', {
    x: MARGIN,
    y: FOOTER_TOP,
    size: 9,
    font: f.reg,
    color: GREEN,
  });
  page.drawText(
    'A escolha de produto e dose é do agrônomo (receituário). "Registro MAPA" é cruzamento informativo com o Agrofit.',
    { x: MARGIN, y: FOOTER_TOP - 14, size: 8.5, font: f.reg, color: MUTED }
  );
}

function drawRow(page: PDFPage, f: Fonts, line: ReportLine, y: number): void {
  page.drawText(dm(line.applied_on), { x: MARGIN + COL.data, y, size: 10, font: f.bold, color: INK });
  page.drawText(clip(line.product ?? '—', 46), {
    x: MARGIN + COL.produto,
    y,
    size: 10,
    font: f.bold,
    color: INK,
  });
  const l2 = [line.crop, line.target ? `contra ${line.target}` : null].filter(Boolean).join(' · ');
  if (l2) {
    page.drawText(clip(l2, 52), { x: MARGIN + COL.produto, y: y - 12, size: 8.5, font: f.reg, color: MUTED });
  }
  if (line.dose) {
    page.drawText(clip(line.dose, 16), { x: MARGIN + COL.dose, y, size: 10, font: f.reg, color: GREEN });
  }
  page.drawText(clip(line.verdict.label, 22), {
    x: MARGIN + COL.registro,
    y,
    size: 8.5,
    font: f.bold,
    color: VERDICT_COLOR[line.verdict.level],
  });
  page.drawLine({
    start: { x: MARGIN, y: y - 18 },
    end: { x: MARGIN + CONTENT_W, y: y - 18 },
    thickness: 0.5,
    color: LINECOL,
  });
}

/**
 * Render the applications report to a PDF byte array. Paginates when the records
 * don't fit one page. Async (pdf-lib embeds fonts). Pure w.r.t. inputs.
 */
export async function buildApplicationsPdf(report: ApplicationsReport): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('Caderno de Aplicações — Stevi');
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fonts: Fonts = { reg, bold };

  const rowsPerPage = Math.max(1, Math.floor((HEADER_BOTTOM - FOOTER_TOP) / ROW_H));
  const lines = report.lines;
  const pageCount = Math.max(1, Math.ceil(lines.length / rowsPerPage));

  for (let p = 0; p < pageCount; p++) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    drawHeader(page, fonts, report);
    drawFooter(page, fonts);
    const slice = lines.slice(p * rowsPerPage, (p + 1) * rowsPerPage);
    slice.forEach((line, i) => drawRow(page, fonts, line, HEADER_BOTTOM - i * ROW_H));
  }

  return doc.save();
}
