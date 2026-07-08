/**
 * Build the Agrofit grounding slice for Stevi's focus crops.
 *
 * From the 370 MB registry, keep only what grounds a pest/disease answer:
 * per (crop, pest) → registered chemical GROUPS (modo de ação = FRAC/IRAC/HRAC),
 * active-ingredient NAMES (dosages stripped — we inform, never prescribe), the
 * product CLASSE, and a registered-product count. Only SITUACAO=TRUE (active).
 *
 * Output: knowledge/agrofit/registry-slice.json (compact, shippable).
 */
import { createReadStream, writeFileSync } from 'node:fs';
import { parse } from 'csv-parse';

const FILE = 'knowledge/agrofit/produtos_formulados.csv';
const OUT = 'knowledge/agrofit/registry-slice.json';

// Focus crops → canonical key. "Todas as culturas" is kept separate and
// unioned into every crop at query time.
const CROP_MATCHERS = [
  { key: 'soja', re: /\bsoja\b/i },
  { key: 'milho', re: /\bmilho\b/i },
  { key: 'pastagem', re: /pastagem|pasto|capim|forrage|braqui/i },
  { key: 'cafe', re: /caf[eé]/i },
  { key: 'citros', re: /citros|lim[aã]o|laranja|tangerin/i },
];
const TODAS_RE = /todas as culturas/i;

/** Strip parenthetical dosage/description so we keep the active NAME only.
 * Also removes leftover stray parens (unbalanced source) and trailing joiners. */
function cleanActive(s) {
  return s
    .replace(/\([^)]*\)/g, '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\+\s*$/, '')
    .trim();
}

/** Split a quoted multi-value field on ';' into trimmed non-empty parts. */
function multi(s) {
  return (s ?? '')
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean);
}

// crop -> pestKey -> { pest, sci:Set, classes:Set, ativos:Set, n }
// (MODO_DE_ACAO dropped: free-text "sistêmico/contato" with dozens of spelling
//  variants — not the FRAC group; the model infers groups from the actives.)
const data = new Map();
for (const c of [...CROP_MATCHERS.map((c) => c.key), 'todas']) data.set(c, new Map());

function bucket(cropKey, pestName, sci, classe, ativos) {
  const key = pestName.toLowerCase();
  const crop = data.get(cropKey);
  let e = crop.get(key);
  if (!e) {
    e = { pest: pestName, sci: new Set(), classes: new Set(), ativos: new Set(), n: 0 };
    crop.set(key, e);
  }
  e.n++;
  if (sci) e.sci.add(sci);
  if (classe) e.classes.add(classe);
  for (const a of ativos) e.ativos.add(a);
}

const parser = createReadStream(FILE, 'utf8').pipe(
  parse({ delimiter: ';', columns: true, relax_quotes: true, skip_records_with_error: true })
);

let seen = 0;
let kept = 0;
for await (const row of parser) {
  seen++;
  if ((row.SITUACAO ?? '').trim() !== 'TRUE') continue;

  const cultura = row.CULTURA ?? '';
  const targets = [];
  if (TODAS_RE.test(cultura)) targets.push('todas');
  for (const c of CROP_MATCHERS) if (c.re.test(cultura)) targets.push(c.key);
  if (targets.length === 0) continue;

  const pests = multi(row.PRAGA_NOME_COMUM);
  if (pests.length === 0) continue;
  const sci = (row.PRAGA_NOME_CIENTIFICO ?? '').trim();
  const classe = (row.CLASSE ?? '').trim();
  const ativos = multi(row.INGREDIENTE_ATIVO).map(cleanActive).filter(Boolean);

  kept++;
  for (const t of targets) for (const p of pests) bucket(t, p, sci, classe, ativos);
}

// Serialize sets → sorted arrays; cap actives to keep the file lean.
const out = {};
for (const [crop, pests] of data) {
  out[crop] = {};
  for (const [key, e] of pests) {
    out[crop][key] = {
      pest: e.pest,
      sci: [...e.sci].slice(0, 4),
      classes: [...e.classes].sort(),
      ativos: [...e.ativos].sort().slice(0, 30),
      products: e.n,
    };
  }
}

const meta = {
  source: 'Agrofit / MAPA — produtos formulados (dados.agricultura.gov.br)',
  generated_from: 'produtos_formulados.csv',
  filter: 'SITUACAO=TRUE (registro ativo)',
  crops: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Object.keys(v).length])),
};

writeFileSync(OUT, JSON.stringify({ meta, data: out }));
console.log(`seen=${seen} kept=${kept}`);
console.log('pests per crop:', JSON.stringify(meta.crops));
const bytes = JSON.stringify({ meta, data: out }).length;
console.log(`output: ${(bytes / 1024).toFixed(0)} KB -> ${OUT}`);
