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
import type { FinancingReport } from './financing';

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

// ---- Financing variant (Histórico de Manejo — apoio ao crédito rural) ----
// Bigger first-page header (identificação + safra aggregates), slim continuation
// header, and a financing-specific legal footer. Reuses the row/table primitives.

const FIN_FIRST_TOP = PAGE_H - 300; // first row baseline on page 1 (tall header)
const FIN_CONT_TOP = PAGE_H - 150; // rows baseline on continuation pages

function drawColumnHeads(page: PDFPage, f: Fonts, topY: number): void {
  const hy = topY + 26;
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

function drawFinancingHeader(page: PDFPage, f: Fonts, fr: FinancingReport): void {
  page.drawText('Stevi — Histórico de Manejo da Safra', {
    x: MARGIN,
    y: PAGE_H - MARGIN - 10,
    size: 18,
    font: f.bold,
    color: GREEN,
  });
  page.drawText('apoio ao crédito rural (PRONAF) · declarado pelo produtor', {
    x: MARGIN,
    y: PAGE_H - MARGIN - 30,
    size: 10.5,
    font: f.bold,
    color: MUTED,
  });

  const ident = [
    fr.producer ? `Produtor: ${fr.producer}` : null,
    fr.base.uf ? `UF: ${fr.base.uf}` : null,
    fr.base.cropLabel ? `Culturas: ${fr.base.cropLabel}` : null,
  ].filter(Boolean) as string[];
  let y = PAGE_H - MARGIN - 58;
  page.drawText(san(ident.join('  ·  ') || 'Produtor: (a confirmar)'), {
    x: MARGIN,
    y,
    size: 10.5,
    font: f.reg,
    color: INK,
  });
  y -= 18;
  const period = fr.base.period
    ? `Período: ${dm(fr.base.period.from)} a ${dm(fr.base.period.to)}`
    : null;
  page.drawText(
    san(
      [period, `${fr.base.total} aplicação${fr.base.total === 1 ? '' : 'ões'} registrada${fr.base.total === 1 ? '' : 's'}`]
        .filter(Boolean)
        .join('  ·  ')
    ),
    { x: MARGIN, y, size: 10.5, font: f.reg, color: INK }
  );

  y -= 28;
  page.drawText('RESUMO DA SAFRA', { x: MARGIN, y, size: 9, font: f.bold, color: MUTED });
  y -= 16;
  const areaLine =
    fr.areaHa != null
      ? `Área somada das aplicações: ${fr.areaHa} ha`
      : 'Área somada das aplicações: não declarada';
  const cropsLine = fr.cropsTreated.length ? `Culturas tratadas: ${fr.cropsTreated.join(', ')}` : null;
  page.drawText(san([areaLine, cropsLine].filter(Boolean).join('  ·  ')), {
    x: MARGIN,
    y,
    size: 10,
    font: f.reg,
    color: INK,
  });
  y -= 16;
  const a = fr.activity;
  const actLine =
    `Atividade registrada: ${a.triages} triagem(ns) de praga · ${a.satellite} leitura(s) de satélite · ` +
    `${a.sprayConsults} consulta(s) de pulverização` +
    (fr.activitySince ? ` — desde ${dm(fr.activitySince)}` : '');
  page.drawText(san(actLine), { x: MARGIN, y, size: 10, font: f.reg, color: INK });

  drawColumnHeads(page, f, FIN_FIRST_TOP);
}

function drawFinancingContHeader(page: PDFPage, f: Fonts): void {
  page.drawText('Histórico de Manejo da Safra — continuação', {
    x: MARGIN,
    y: PAGE_H - MARGIN - 10,
    size: 12,
    font: f.bold,
    color: GREEN,
  });
  drawColumnHeads(page, f, FIN_CONT_TOP);
}

function drawFinancingFooter(page: PDFPage, f: Fonts): void {
  page.drawLine({
    start: { x: MARGIN, y: FOOTER_TOP + 20 },
    end: { x: MARGIN + CONTENT_W, y: FOOTER_TOP + 20 },
    thickness: 1,
    color: LINECOL,
  });
  page.drawText(
    'Documento de apoio, gerado a partir dos registros do produtor — não é o projeto técnico, a DAP/CAF, o CAR nem a solicitação de crédito.',
    { x: MARGIN, y: FOOTER_TOP, size: 8.5, font: f.reg, color: GREEN }
  );
  page.drawText(
    'Leve ao seu agrônomo, cooperativa ou banco. A responsabilidade técnica (ART) e a análise de crédito são deles. "Registro MAPA": cruzamento informativo (Agrofit).',
    { x: MARGIN, y: FOOTER_TOP - 13, size: 8, font: f.reg, color: MUTED }
  );
}

/**
 * Render the Histórico de Manejo (financing support) PDF. First page carries the
 * identificação + safra aggregates; continuation pages are slim. Paginates.
 */
export async function buildFinancingPdf(fr: FinancingReport): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('Histórico de Manejo da Safra — Stevi');
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fonts: Fonts = { reg, bold };

  const lines = fr.base.lines;
  const rowsFirst = Math.max(1, Math.floor((FIN_FIRST_TOP - FOOTER_TOP) / ROW_H));
  const rowsCont = Math.max(1, Math.floor((FIN_CONT_TOP - FOOTER_TOP) / ROW_H));

  let idx = 0;
  let pageNo = 0;
  do {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    const first = pageNo === 0;
    if (first) drawFinancingHeader(page, fonts, fr);
    else drawFinancingContHeader(page, fonts);
    drawFinancingFooter(page, fonts);
    const cap = first ? rowsFirst : rowsCont;
    const top = first ? FIN_FIRST_TOP : FIN_CONT_TOP;
    lines.slice(idx, idx + cap).forEach((line, i) => drawRow(page, fonts, line, top - i * ROW_H));
    idx += cap;
    pageNo++;
  } while (idx < lines.length);

  return doc.save();
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
