/**
 * Outbound compliance gate — the last line before a reply reaches the farmer.
 *
 * Prime legal rule (dossier Part 5): the product triages, it never prescribes.
 * A prescription is a specific defensivo product name + an application dose/rate
 * framed as an instruction to apply. This gate is a heuristic backstop for when
 * the model slips past its system-prompt instructions — it does NOT replace them.
 *
 * Prescription shape = a concrete dose/rate PLUS any of: an apply instruction,
 * a generic product word, a commercial brand name (Agrofit MARCA_COMERCIAL),
 * or a registered active ingredient. Doses come in per-area (L/ha), per-plant
 * (ml por planta / g por pé — how café and citros are dosed), and tank-mix
 * (ml por 100 L de água) shapes.
 *
 * On a suspected prescription we don't silently drop the message (that would be
 * a silent failure); we replace it with a safe, honest handoff so the farmer
 * still gets a useful, legal answer.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { allActiveIngredients } from './tools/agrofit';

export interface ComplianceResult {
  safe: boolean;
  /** The text to actually send (original if safe, replacement if not). */
  text: string;
  /** Why it was flagged, for logging. Empty when safe. */
  flags: string[];
}

const UNIT = '(l|litros?|ml|kg|g|gramas?)';
const CONNECTOR = '(por|pra|para(\\s+cada)?)';

// Dose/rate patterns: a number followed by an application rate.
const DOSE_PATTERN = new RegExp(
  '\\b\\d+([.,]\\d+)?\\s?-?\\s?\\d*([.,]\\d+)?\\s?(' +
    // 0,5 L/ha · 2 kg/ha · 100 ml/100 L (tank mix)
    `${UNIT}\\s?\\/\\s?(ha|hectare|alqueire|100\\s?l(itros)?)` +
    '|' +
    // 500 ml por hectare
    `${UNIT}\\s?(${CONNECTOR}\\s+)?(hectare|ha|alqueire)` +
    '|' +
    // 5 ml por planta · 200 g por pé/cova/m² (perennial dosing)
    `${UNIT}\\s?${CONNECTOR}\\s+(planta|p[ée]s?|cova|m2|m²|metro\\s+quadrado)` +
    '|' +
    // 100 ml para cada 100 litros (de água) — citros tank mix
    `${UNIT}\\s?${CONNECTOR}\\s+100\\s?(l|litros?)` +
    // no \b here: "pé" ends in a non-ASCII word char, which JS \b mishandles
    ')(?![\\wÀ-ÿ])',
  'i'
);

// Imperative "apply" signals that turn information into instruction — verbs plus
// noun framings ("faça uma aplicação de", "a recomendação é", "dose de").
const APPLY_VERB =
  /\b(aplique|aplicar|aplica[çc][aã]o\s+de|pulverize|pulverizar|use|usa|usar|utilize|utilizar|passe|passar|jogue|joga|jogar|misture|misturar|dilua|diluir|recomendo|recomenda[çc][aã]o|dose\s+de)\b/i;

// A rough signal that a specific commercial product is being named alongside a dose.
const PRODUCT_HINT =
  /\b(produto|defensivo|fungicida|inseticida|herbicida|acaricida|nematicida|agrot[óo]xico)\b/i;

/** Lowercase, strip diacritics, collapse punctuation — accent/hyphen-insensitive. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Commercial brand names from the Agrofit slice (built by
 * scripts/agrofit-extract.mjs). Missing file degrades the gate to
 * verbs/units/actives only — logged loudly, never fatal: a weaker gate must not
 * take the whole webhook down.
 */
function loadBrands(): Set<string> {
  const candidates = [
    join(process.cwd(), 'api/_lib/data/agrofit-brands.json'),
    join(__dirname, 'data/agrofit-brands.json'),
  ];
  for (const p of candidates) {
    try {
      const file = JSON.parse(readFileSync(p, 'utf8')) as { brands: string[] };
      return new Set(file.brands.map(norm).filter((b) => b.length >= 4));
    } catch {
      // try next candidate
    }
  }
  console.error(
    'compliance: agrofit-brands.json not found — brand+dose check disabled'
  );
  return new Set();
}

const BRANDS = loadBrands();

// Active-ingredient lexicon from the Agrofit slice. Full names are matched as
// normalized phrases; single leading tokens (e.g. "azoxistrobina" out of
// "azoxistrobina + mancozebe") are matched only when long enough and not a
// generic chemistry/food word — fertilizer-style advice ("sulfato de amônio")
// is not a defensivo prescription.
const GENERIC_CHEM_TOKENS = new Set([
  'extrato', 'farinha', 'oleo', 'acido', 'sulfato', 'fosfato', 'cloreto',
  'hidroxido', 'oxido', 'carbonato', 'bicarbonato', 'proteina', 'gordura',
  'essencia', 'residuo', 'sal',
]);

interface AtivoLexicon {
  phrases: string[];
  tokens: Set<string>;
}

function buildAtivoLexicon(): AtivoLexicon {
  const phrases = new Set<string>();
  const tokens = new Set<string>();
  for (const ativo of allActiveIngredients()) {
    const n = norm(ativo);
    if (n.length >= 6) phrases.add(n);
    const first = n.split(' ')[0];
    if (first.length >= 7 && !GENERIC_CHEM_TOKENS.has(first)) tokens.add(first);
  }
  return { phrases: [...phrases], tokens };
}

const ATIVOS = buildAtivoLexicon();

/** Brand check runs only on proper-noun n-grams (1–3 consecutive words, the
 * first capitalized) — requiring source-casing keeps lowercase common nouns
 * that collide with brand names ("ametista", "ágata") from tripping the gate. */
function hasBrandName(text: string): boolean {
  if (BRANDS.size === 0) return false;
  const words = text
    .split(/\s+/)
    .map((w) => w.replace(/^[^\wÀ-ÿ]+|[^\wÀ-ÿ]+$/g, ''))
    .filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    if (!/^[A-ZÀ-Ý]/.test(words[i])) continue;
    let phrase = words[i];
    for (let n = 0; n < 3 && i + n < words.length; n++) {
      if (n > 0) {
        // continuation words may be capitalized or numeric ("Priori Xtra", "Curzate M 200")
        if (!/^[A-ZÀ-Ý0-9]/.test(words[i + n])) break;
        phrase += ` ${words[i + n]}`;
      }
      const p = norm(phrase);
      if (p.length >= 4 && BRANDS.has(p)) return true;
    }
  }
  return false;
}

function hasActiveIngredient(text: string): boolean {
  const n = ` ${norm(text)} `;
  for (const t of n.split(' ')) {
    if (t && ATIVOS.tokens.has(t)) return true;
  }
  for (const phrase of ATIVOS.phrases) {
    if (n.includes(` ${phrase} `)) return true;
  }
  return false;
}

const SAFE_REPLACEMENT = `Olha, quem define qual produto e qual dose aplicar é o engenheiro agrônomo, através do receituário agronômico — é ele que assina a responsabilidade técnica. Posso te ajudar a entender a praga/doença, o manejo (monitoramento, rotação, controle biológico) e o que levar pro agrônomo. Quer que eu te explique o que provavelmente está acontecendo na sua lavoura pra você chegar já sabendo o que perguntar?`;

/**
 * Inspect an outbound reply. Flags it as unsafe only when it combines a
 * concrete dose/rate with an application instruction, a product word, a brand
 * name, or a registered active ingredient — the shapes of a prescription.
 * A mention of a chemical group or "existe registro para..." is allowed.
 */
export function checkOutbound(text: string): ComplianceResult {
  const flags: string[] = [];

  const hasDose = DOSE_PATTERN.test(text);
  if (hasDose) {
    if (APPLY_VERB.test(text)) {
      flags.push('prescription_shape: dose + application instruction');
    } else if (PRODUCT_HINT.test(text)) {
      flags.push('prescription_shape: dose + product word');
    } else if (hasBrandName(text)) {
      flags.push('prescription_shape: dose + commercial brand name');
    } else if (hasActiveIngredient(text)) {
      flags.push('prescription_shape: dose + active ingredient');
    }
  }

  if (flags.length > 0) {
    return { safe: false, text: SAFE_REPLACEMENT, flags };
  }

  return { safe: true, text, flags };
}
