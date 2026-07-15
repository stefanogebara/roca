/**
 * Application capture — turn a farmer's past-tense declaration ("apliquei Priori
 * Xtra 0,3 L/ha na soja contra ferrugem ontem") into a structured record row.
 *
 * This is the input side of the caderno de aplicações (rastreabilidade). It
 * records what the farmer SAYS they already did — never a recommendation. The
 * fast-path predicate is deliberately conservative: only clear past-tense
 * declarations qualify, so a *question* ("posso aplicar hoje?") is never logged
 * as an application (it must route to spray_window/general instead).
 *
 * Design note (compliance): the per-log confirmation is outbound TEXT and so
 * passes through checkOutbound. `formatApplicationConfirm` therefore keeps the
 * numeric dose OUT of the text (it's stored, and shown in the rendered report,
 * which the gate never sees). Echoing dose + brand in text would trip the gate
 * exactly as a prescription would — and the gate can't tell a record echo from a
 * prescription by shape alone.
 */

import { chat } from '../llm';
import { MODELS } from '../env';
import { normalizeCrop } from './agrofit';
import { createLogger } from '../logger';

const log = createLogger('applicationParse');

export type ApplicationSource = 'declared_text' | 'declared_voice';

export interface ParsedApplication {
  /** YYYY-MM-DD. Resolved from the extract or the text; defaults to today. */
  applied_on: string;
  /** Canonical crop key when resolvable, else the declared word, else null. */
  crop: string | null;
  product_name: string | null;
  active_ingredient: string | null;
  /** Verbatim, as declared ("0,3 L/ha") — never normalized. */
  dose_text: string | null;
  area_ha: number | null;
  target: string | null;
  source: ApplicationSource;
  raw_text: string;
}

/** Lowercase + strip diacritics — patterns below are written accent-free. */
function strip(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// Strong past-tense application verbs — unambiguous on their own.
const STRONG_PAST =
  /\b(apliquei|aplicamos|apliquamos|pulverizei|pulverizamos|fiz\s+(uma\s+)?aplicac)\w*/;
// Weak verbs that also mean other things — require a product/chemical nearby.
const WEAK_PAST = /\b(passei|passamos|joguei|jogamos)\b/;
const PRODUCT_HINT =
  /\b(veneno|defensivo|agrotoxico|fungicida|inseticida|herbicida|acaricida|nematicida|formicida|produto|adubo|calcario|ureia|glifosato|glifosato|oleo\s+mineral|cupinicida)\b/;
// Future / negation about applying — kills "não apliquei ainda", "vou aplicar".
const FUTURE_OR_NEGATED =
  /\b(nao|nunca|ainda\s+nao)\s+(apliquei|apliquamos|aplicamos|pulverizei|pulverizamos|passei|joguei)\b|\b(vou|irei|pretendo|penso\s+em|quero|preciso)\s+(aplicar|pulverizar|passar|jogar|fazer\s+(uma\s+)?aplicac)\w*/;

/**
 * Whether a message is a past-tense application declaration (something to log),
 * as opposed to a question/plan about applying (which routes normally). Pure.
 */
export function isApplicationLog(text: string): boolean {
  const t = strip(text);
  if (FUTURE_OR_NEGATED.test(t)) return false;
  if (STRONG_PAST.test(t)) return true;
  if (WEAK_PAST.test(t) && PRODUCT_HINT.test(t)) return true;
  return false;
}

// Request for the caderno de aplicações report. Requires "de aplica…" (or an
// explicit synonym) so it doesn't collide with "meu caderno"/"meu histórico"
// (the passive season record) — the pipeline checks this BEFORE the history
// fast-path. "receituário" is included so we can honestly redirect: we build the
// record, the agrônomo signs the receituário.
const REPORT_REQUEST =
  /\b(relatorio|caderno)\s+de\s+aplica|\bminhas\s+aplica|\brelatorio\s+de\s+(agrotoxico|defensivo|pulveriza)|\breceituario\b/;

/** Whether a message asks for the applications report (caderno de aplicações). */
export function isApplicationReportRequest(text: string): boolean {
  return REPORT_REQUEST.test(strip(text));
}

const DAY_MS = 86_400_000;
const iso = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * Resolve a relative Portuguese date in the text to an ISO date. Handles
 * ontem/anteontem/hoje and "dia N" (this month, or last month when N is still
 * in the future). Defaults to `now`'s date. Pure — `now` is injectable for tests.
 */
export function resolveApplyDate(text: string, now: Date = new Date()): string {
  const t = strip(text);
  if (/\banteontem\b/.test(t)) return iso(new Date(now.getTime() - 2 * DAY_MS));
  if (/\bontem\b/.test(t)) return iso(new Date(now.getTime() - 1 * DAY_MS));

  const m = t.match(/\bdia\s+(\d{1,2})\b/);
  if (m) {
    const dd = Number(m[1]);
    if (dd >= 1 && dd <= 31) {
      const y = now.getUTCFullYear();
      const mo = now.getUTCMonth();
      let d = new Date(Date.UTC(y, mo, dd));
      // A day later than today can't be this month → assume last month.
      if (d.getTime() > now.getTime()) d = new Date(Date.UTC(y, mo - 1, dd));
      return iso(d);
    }
  }
  return iso(now); // hoje / agora / unstated
}

/** Trim to a non-empty string, or null. */
function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length > 0 ? s : null;
}

/** Coerce an area to a positive number (accepts comma decimals), else null. */
function coerceArea(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  if (typeof v === 'string') {
    const n = Number.parseFloat(v.replace(',', '.'));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

export interface FinalizeOpts {
  now?: Date;
  source?: ApplicationSource;
  /** Farmer's known crops — used as a fallback when none was declared. */
  knownCrops?: string[] | null;
}

/**
 * Deterministically turn a (possibly partial or garbage) extract into a
 * ParsedApplication. Never throws — a null extract still yields a row with the
 * resolved date and the raw text, so a bad parse loses nothing. Pure.
 */
export function finalizeApplication(
  rawText: string,
  extracted: Record<string, unknown> | null,
  opts: FinalizeOpts = {}
): ParsedApplication {
  const now = opts.now ?? new Date();
  const e = extracted ?? {};

  let applied_on = str(e.applied_on);
  if (!applied_on || !/^\d{4}-\d{2}-\d{2}$/.test(applied_on)) {
    applied_on = resolveApplyDate(rawText, now);
  }

  const declaredCrop = str(e.crop);
  const canonical = declaredCrop ? normalizeCrop(declaredCrop) : null;
  let crop = canonical ?? declaredCrop;
  if (!crop && opts.knownCrops && opts.knownCrops.length > 0) crop = opts.knownCrops[0];

  return {
    applied_on,
    crop: crop ?? null,
    product_name: str(e.product_name),
    active_ingredient: str(e.active_ingredient),
    dose_text: str(e.dose_text),
    area_ha: coerceArea(e.area_ha),
    target: str(e.target),
    source: opts.source ?? 'declared_text',
    raw_text: rawText,
  };
}

const EXTRACT_SYSTEM = `Você extrai, de uma frase de um produtor rural que RELATA uma aplicação que JÁ fez, os campos abaixo. Responda APENAS um JSON válido, sem texto extra, sem markdown.

Campos (use null quando não souber):
- applied_on: data no formato YYYY-MM-DD se houver data explícita, senão null (não invente).
- crop: cultura (ex: "soja", "milho", "café"), senão null.
- product_name: nome comercial do produto, como o produtor falou, senão null.
- active_ingredient: ingrediente ativo, se citado, senão null.
- dose_text: a dose EXATAMENTE como o produtor falou (ex: "0,3 L/ha", "2 kg por hectare"), senão null.
- area_ha: área em hectares como número, senão null.
- target: praga/doença/planta daninha alvo, senão null.

Não corrija, não recomende, não normalize a dose. Só extraia o que foi dito.`;

/** Pull the first balanced JSON object out of a model reply (tolerates fences). */
function extractJsonObject(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Extract a structured application from a farmer declaration. Uses the cheap
 * router-tier model for extraction, then deterministic finalization. Fail-soft:
 * on any model/parse failure, returns a row with the resolved date + raw text so
 * the record is never lost (the farmer can correct it later).
 */
export async function parseApplication(
  text: string,
  opts: FinalizeOpts = {}
): Promise<ParsedApplication> {
  try {
    const raw = await chat({
      model: MODELS.router(),
      system: EXTRACT_SYSTEM,
      user: text,
      maxTokens: 200,
    });
    return finalizeApplication(text, extractJsonObject(raw), opts);
  } catch (e) {
    log.error('parseApplication extract failed — storing raw:', (e as Error).message);
    return finalizeApplication(text, null, opts);
  }
}

/** dd/mm from an ISO date. */
function dm(isoDate: string): string {
  const [, m, d] = isoDate.split('-');
  return `${d}/${m}`;
}

/**
 * The confirmation the farmer sees after a logged application. Reads back the
 * fields they can verify — crop, product, target, date — but deliberately keeps
 * the numeric dose OUT of the text so this reply never forms a dose+product
 * "prescription shape" that checkOutbound would (correctly) blank out. The dose
 * is stored and appears in the rendered report, which the gate never inspects.
 * Pure.
 */
export function formatApplicationConfirm(app: ParsedApplication): string {
  const parts: string[] = [];
  if (app.crop) parts.push(app.crop);
  if (app.product_name) parts.push(app.product_name);
  else if (app.active_ingredient) parts.push(app.active_ingredient);
  if (app.area_ha != null) parts.push(`${app.area_ha} ha`);
  if (app.target) parts.push(`contra ${app.target}`);
  parts.push(dm(app.applied_on));

  const doseNote = app.dose_text ? ' Guardei também a dose que você falou.' : '';
  return (
    `✅ Anotei no seu caderno de aplicações: ${parts.join(' · ')}.${doseNote}\n\n` +
    '_Fica guardado como registro seu. Peça "meu caderno de aplicações" quando quiser o relatório — e se anotei algo errado, é só me corrigir._'
  );
}
