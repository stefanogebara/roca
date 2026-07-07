/**
 * Outbound compliance gate — the last line before a reply reaches the farmer.
 *
 * Prime legal rule (dossier Part 5): the product triages, it never prescribes.
 * A prescription is a specific defensivo product name + an application dose/rate
 * framed as an instruction to apply. This gate is a heuristic backstop for when
 * the model slips past its system-prompt instructions — it does NOT replace them.
 *
 * Pure function, unit-tested. On a suspected prescription we don't silently drop
 * the message (that would be a silent failure); we replace it with a safe,
 * honest handoff so the farmer still gets a useful, legal answer.
 */

export interface ComplianceResult {
  safe: boolean;
  /** The text to actually send (original if safe, replacement if not). */
  text: string;
  /** Why it was flagged, for logging. Empty when safe. */
  flags: string[];
}

// Dose/rate patterns: a number followed by an application rate. Two shapes:
//   per-area unit that already embeds the area (0,5 L/ha, 2 kg/ha), or
//   a mass/volume unit followed by an area word (500 ml por hectare).
const DOSE_PATTERN = new RegExp(
  '\\b\\d+([.,]\\d+)?\\s?-?\\s?\\d*([.,]\\d+)?\\s?(' +
    '(l|litros?|ml|kg|g|gramas?)\\s?\\/\\s?(ha|hectare|alqueire)' + // 0,5 L/ha
    '|' +
    '(ml|l|litros?|kg|g|gramas?)\\s?(por\\s+)?(hectare|ha|alqueire)' + // 500 ml por hectare
    ')\\b',
  'i'
);

// Imperative "apply" verbs that turn information into instruction.
const APPLY_VERB =
  /\b(aplique|aplicar|pulverize|pulverizar|use\s+o\s+produto|utilize|passe|jogue|joga|dose\s+de)\b/i;

// A rough signal that a specific commercial product is being named alongside a dose.
// We keep this conservative: the real guard is DOSE + APPLY together.
const PRODUCT_HINT =
  /\b(produto|defensivo|fungicida|inseticida|herbicida|agrot[óo]xico)\b/i;

const SAFE_REPLACEMENT = `Olha, quem define qual produto e qual dose aplicar é o engenheiro agrônomo, através do receituário agronômico — é ele que assina a responsabilidade técnica. Posso te ajudar a entender a praga/doença, o manejo (monitoramento, rotação, controle biológico) e o que levar pro agrônomo. Quer que eu te explique o que provavelmente está acontecendo na sua lavoura pra você chegar já sabendo o que perguntar?`;

/**
 * Inspect an outbound reply. Flags it as unsafe only when it combines an
 * application instruction with a concrete dose/rate — the shape of a prescription.
 * A mention of a chemical group or "existe registro para..." is allowed.
 */
export function checkOutbound(text: string): ComplianceResult {
  const flags: string[] = [];

  const hasDose = DOSE_PATTERN.test(text);
  const hasApply = APPLY_VERB.test(text);
  const hasProduct = PRODUCT_HINT.test(text);

  // Prescription shape = telling someone to apply + a concrete dose.
  if (hasDose && (hasApply || hasProduct)) {
    flags.push('prescription_shape: dose + application/product instruction');
  }

  if (flags.length > 0) {
    return { safe: false, text: SAFE_REPLACEMENT, flags };
  }

  return { safe: true, text, flags };
}
