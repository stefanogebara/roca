/**
 * Agrofit grounding — "what does the official MAPA registry say is registered
 * for this crop/pest?". This turns pest answers from model-memory into cited
 * fact (dossier prime directive). We surface WHAT is registered (active
 * ingredients, product classe, count) — never a dose or an instruction to apply.
 *
 * Data: a pre-extracted slice of the Agrofit "produtos formulados" open dataset
 * (SITUACAO=TRUE only), bundled at data/agrofit.json. Rebuild with
 * scripts/agrofit-extract.mjs when the registry updates.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface PestEntry {
  pest: string;
  sci: string[];
  classes: string[];
  ativos: string[];
  products: number;
}

interface AgrofitFile {
  meta: { source: string };
  data: Record<string, Record<string, PestEntry>>;
}

// Loaded at module init from the bundled JSON. Runtime read (not a static import)
// keeps tsc from inferring a ~550 KB literal type — that made typecheck take
// ~2 minutes. Vercel ships the file via `includeFiles` in vercel.json.
function loadAgrofit(): AgrofitFile {
  const candidates = [
    join(process.cwd(), 'api/_lib/data/agrofit.json'),
    join(__dirname, '../data/agrofit.json'),
    join(__dirname, 'data/agrofit.json'),
  ];
  for (const p of candidates) {
    try {
      return JSON.parse(readFileSync(p, 'utf8')) as AgrofitFile;
    } catch {
      // try next candidate
    }
  }
  throw new Error('agrofit.json not found in any known location');
}

const AGROFIT = loadAgrofit();
export const AGROFIT_SOURCE = AGROFIT.meta.source;

/** Every distinct registered active-ingredient name in the slice (deduped,
 * original casing). Used by the compliance gate to spot ingredient+dose
 * prescription shapes on the way out. */
export function allActiveIngredients(): string[] {
  const set = new Set<string>();
  for (const pests of Object.values(AGROFIT.data)) {
    for (const entry of Object.values(pests)) {
      for (const a of entry.ativos) set.add(a);
    }
  }
  return [...set];
}

export type CropKey = 'soja' | 'milho' | 'pastagem' | 'cafe' | 'citros';

const ALL_CROPS: CropKey[] = ['soja', 'milho', 'pastagem', 'cafe', 'citros'];

/** Map free crop text → canonical key, or null if not a covered crop. */
export function normalizeCrop(crop: string | null | undefined): CropKey | null {
  if (!crop) return null;
  const c = strip(crop);
  if (/\bsoja\b/.test(c)) return 'soja';
  if (/\bmilho\b/.test(c)) return 'milho';
  if (/pastagem|pasto|capim|forrage|braqui|gado|pecuar/.test(c)) return 'pastagem';
  if (/cafe|cafeeiro|cafezal/.test(c)) return 'cafe';
  if (/citros|citrus|laranja|limao|tangerin|pomar/.test(c)) return 'citros';
  return null;
}

/** Lowercase + strip diacritics for accent-insensitive matching. */
function strip(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/** Like strip(), but also collapses punctuation/hyphens to single spaces —
 * so "lagarta-do-cartucho" and "lagarta do cartucho" compare equal. */
function matchNorm(s: string): string {
  return strip(s).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokens(s: string): string[] {
  return strip(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

interface Scored {
  entry: PestEntry;
  crop: CropKey;
  score: number;
}

/** Score a query against a pest entry (common name + scientific name).
 * `cropBonus` favours the crop-specific bucket over "todas as culturas", so a
 * soy "ferrugem" query prefers "ferrugem da soja" over a generic rust entry. */
function scoreEntry(
  qTokens: string[],
  qMatch: string,
  key: string,
  entry: PestEntry,
  cropBonus: number
): number {
  const keyMatch = matchNorm(key);
  let base: number;
  // Substring matches require the contained string to be ≥4 chars, so a short
  // pest name can't spuriously match inside an unrelated longer query.
  if (keyMatch === qMatch) base = 100;
  else if (qMatch.length >= 4 && keyMatch.includes(qMatch)) base = 82;
  else if (keyMatch.length >= 4 && qMatch.includes(keyMatch)) base = 76;
  else {
    const targetTokens = new Set([
      ...tokens(entry.pest),
      ...entry.sci.flatMap((s) => tokens(s)),
    ]);
    let overlap = 0;
    for (const t of qTokens) if (targetTokens.has(t)) overlap++;
    if (overlap === 0) return 0;
    base = 40 + overlap * 10;
  }
  return base + cropBonus;
}

export interface AgrofitLookup {
  entry: PestEntry;
  crop: CropKey;
  source: string;
}

/**
 * Look up the best-matching registered pest for a crop + free-text pest name.
 * Searches the crop's pests plus the "todas as culturas" bucket. Returns null
 * when nothing clears a confidence floor — we'd rather say nothing than
 * mis-ground (prime directive).
 */
export function lookupPest(
  crop: CropKey | null,
  pestQuery: string
): AgrofitLookup | null {
  const qMatch = matchNorm(pestQuery);
  const qTokens = tokens(pestQuery);
  if (qTokens.length === 0 && qMatch.length < 3) return null;

  const cropsToSearch: CropKey[] = crop ? [crop] : ALL_CROPS;
  const candidates: Scored[] = [];

  for (const c of cropsToSearch) {
    for (const bucket of [c, 'todas']) {
      const pests = AGROFIT.data[bucket];
      if (!pests) continue;
      const cropBonus = bucket === c ? 30 : 0;
      for (const [key, entry] of Object.entries(pests)) {
        const score = scoreEntry(qTokens, qMatch, key, entry, cropBonus);
        if (score > 0) candidates.push({ entry, crop: c, score });
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score || b.entry.products - a.entry.products);
  const best = candidates[0];
  if (best.score < 50) return null; // confidence floor

  return { entry: best.entry, crop: best.crop, source: AGROFIT_SOURCE };
}

/** Chemical-group hint for common actives, so the reply can teach FRAC rotation. */
const GROUP_HINTS: Array<{ re: RegExp; group: string }> = [
  { re: /(azoxistrobina|picoxistrobina|trifloxistrobina|piraclostrobina|estrobirulina|strobil)/, group: 'estrobilurinas' },
  { re: /(conazol|triazol)/, group: 'triazóis' },
  { re: /(benzovindiflupyr|fluindapyr|bixafem|pidiflumetofen|fluxapiroxade|carboxamida)/, group: 'carboxamidas' },
  { re: /(mancozeb|clorotalonil|oxicloreto de cobre|cobre)/, group: 'multissítios (protetores)' },
];

/**
 * Resolve the Agrofit entry for a pest, scoped to the right crop. An explicit
 * crop (from the message/photo) wins; otherwise we prefer the farmer's KNOWN
 * crop(s) so a generic "ferrugem" from a café grower grounds in café — not soja
 * (which `lookupPest(null, …)` would pick by product-count tiebreak). Only when
 * neither is available do we fall back to the crop-agnostic search.
 */
export function groundedHit(
  textCrop: string | null,
  pest: string,
  knownCrops?: string[] | null
): AgrofitLookup | null {
  const explicit = normalizeCrop(textCrop);
  if (explicit) return lookupPest(explicit, pest);
  for (const c of knownCrops ?? []) {
    const hit = lookupPest(normalizeCrop(c), pest);
    if (hit) return hit; // first known crop the pest is actually registered for
  }
  return lookupPest(null, pest);
}

/** Distinct FRAC/IRAC chemical groups present among a hit's registered actives. */
export function chemicalGroups(hit: AgrofitLookup): string[] {
  const groups = new Set<string>();
  for (const a of hit.entry.ativos) {
    const s = strip(a);
    for (const g of GROUP_HINTS) if (g.re.test(s)) groups.add(g.group);
  }
  return [...groups];
}

/**
 * Compose a grounded, WhatsApp-sized context block for the reasoning model.
 * Informational only — lists what is registered and nudges rotation + handoff.
 */
export function groundingBlock(hit: AgrofitLookup): string {
  const { entry } = hit;
  const lines: string[] = [];
  const name = entry.sci.length
    ? `${entry.pest} (${entry.sci[0]})`
    : entry.pest;
  lines.push(`Agrofit (registro oficial MAPA) — ${name}, na cultura ${hit.crop}:`);
  lines.push(`- ${entry.products} produtos com registro ativo.`);
  if (entry.classes.length) {
    lines.push(`- Classes: ${entry.classes.slice(0, 6).join(', ')}.`);
  }
  if (entry.ativos.length) {
    lines.push(`- Exemplos de ingredientes ativos registrados: ${entry.ativos.slice(0, 12).join('; ')}.`);
    const groups = new Set<string>();
    for (const a of entry.ativos) {
      const s = strip(a);
      for (const g of GROUP_HINTS) if (g.re.test(s)) groups.add(g.group);
    }
    if (groups.size > 1) {
      lines.push(`- Grupos presentes: ${[...groups].join(', ')} — dá pra pensar em rotação de modos de ação (FRAC/IRAC) com o agrônomo.`);
    }
  }
  lines.push(`Fonte: ${hit.source}. Isto é o que EXISTE registrado — a escolha de produto e dose é do agrônomo, no receituário.`);
  return lines.join('\n');
}
