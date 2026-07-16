/**
 * Histórico de Manejo da Safra — the PRONAF / crédito-rural SUPPORT report.
 *
 * Scope (plan 2026-07-16-pronaf-report): stevi produces a supporting activity
 * record from data it already holds — it is NOT the projeto técnico (agrônomo's
 * ART), the DAP/CAF, the CAR, nor the credit application. Every farmer-facing
 * string here says so. No CPF/DAP/CAR/bank data is collected or rendered.
 *
 * Composition reuses the caderno report model (validated application lines) and
 * adds the financing-relevant layer: identificação (what we know), safra
 * aggregates (area, crops, activity counts — evidence of active, documented
 * management), and the honest framing.
 */

import type { ApplicationRow } from '../db';
import type { ActivityRow } from '../caderno';
import { buildApplicationsReport, type ApplicationsReport } from '../cards/applications';

export interface FinancingActivity {
  triages: number;
  satellite: number;
  sprayConsults: number;
  briefs: number;
}

export interface FinancingReport {
  /** Producer display name, as stevi knows it (WhatsApp profile). */
  producer: string | null;
  /** The caderno report model — uf, cropLabel, period, total, validated lines. */
  base: ApplicationsReport;
  /** Sum of declared application areas; null when none was declared. */
  areaHa: number | null;
  /** Distinct crops across the application rows, first-seen order. */
  cropsTreated: string[];
  /** Counts of logged manejo activity beyond applications. */
  activity: FinancingActivity;
  /** Earliest counted activity date (YYYY-MM-DD), or null. */
  activitySince: string | null;
}

/** Which logged intents count as manejo evidence, and where they tally. */
const ACTIVITY_KEY: Record<string, keyof FinancingActivity> = {
  pest_triage: 'triages',
  field_health: 'satellite',
  spray_window: 'sprayConsults',
  brief: 'briefs',
};

/**
 * Build the financing report model from data stevi already holds. Pure —
 * everything here is deterministic aggregation; nothing is fetched.
 */
export function buildFinancingReport(
  producer: string | null,
  profile: { uf: string | null; crop: string[] | null },
  rows: ApplicationRow[],
  activityLog: ActivityRow[]
): FinancingReport {
  // Full-season lines for the PDF (the card cap doesn't apply here).
  const base = buildApplicationsReport(profile, rows, { maxLines: 200 });

  let areaSum = 0;
  let areaSeen = false;
  const crops: string[] = [];
  for (const r of rows) {
    if (typeof r.area_ha === 'number' && Number.isFinite(r.area_ha) && r.area_ha > 0) {
      areaSum += r.area_ha;
      areaSeen = true;
    }
    if (r.crop && !crops.includes(r.crop)) crops.push(r.crop);
  }

  const activity: FinancingActivity = { triages: 0, satellite: 0, sprayConsults: 0, briefs: 0 };
  let since: string | null = null;
  for (const a of activityLog) {
    const key = a.intent ? ACTIVITY_KEY[a.intent] : undefined;
    if (!key) continue;
    activity[key] += 1;
    const d = a.created_at.slice(0, 10);
    if (since === null || d < since) since = d;
  }

  return {
    producer: producer?.trim() || null,
    base,
    areaHa: areaSeen ? Number(areaSum.toFixed(2)) : null,
    cropsTreated: crops,
    activity,
    activitySince: since,
  };
}

// ---- Gate-safe farmer-facing replies (no dose/product shapes) ----

/** Caption for the financing report delivery. Honest about what it is NOT. */
export function financingCaption(total: number): string {
  return (
    `📄 Montei seu *histórico de manejo da safra* — ${total} registro${total === 1 ? '' : 's'} — ` +
    'pra apoiar o pedido de crédito.\n\n' +
    '_Isso não é o projeto técnico nem a solicitação do PRONAF: leve ao seu agrônomo, ' +
    'cooperativa ou banco junto com seus documentos (DAP/CAF, CAR). A responsabilidade ' +
    'técnica (ART) e a análise de crédito são deles._'
  );
}

/** Reply when there's nothing recorded yet to build the report from. */
export function financingEmptyReply(): string {
  return (
    '📒 Pra montar seu *histórico de manejo* (o documento de apoio ao crédito), primeiro ' +
    'preciso dos seus registros de aplicação.\n\n' +
    'Me conta o que você já aplicou — tipo "apliquei tal produto na soja semana passada" ' +
    '(pode ser áudio) — que eu vou guardando. Com os registros, eu gero o PDF pra levar ' +
    'ao banco ou à cooperativa.'
  );
}
