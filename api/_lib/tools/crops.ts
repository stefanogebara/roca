/**
 * Crop parsing for onboarding capture. After the farm card asks "o que você
 * planta?", we detect which crops the farmer named and persist them. Broader
 * than the Agrofit CropKey set (includes café/citros/outros) because we store
 * whatever they grow, even if grounding for that crop isn't live yet.
 */

export interface CropMatch {
  /** Canonical label stored on the farm. */
  label: string;
  re: RegExp;
}

const CROP_PATTERNS: CropMatch[] = [
  { label: 'soja', re: /\bsoja\b/ },
  { label: 'milho', re: /\bmilho\b|milharal/ },
  { label: 'pastagem', re: /pastagem|\bpasto\b|capim|forrage|braqui|\bgado\b|\bboi\b|\bbois\b|\bvaca\b|pecuar/ },
  { label: 'café', re: /\bcafe\b|cafeeiro|cafezal|\bcafé\b/ },
  { label: 'citros', re: /citros|citrus|laranja|limao|limão|tangerina|\blima\b|pomar/ },
  { label: 'algodão', re: /algod/ },
  { label: 'cana', re: /cana-de-acucar|cana de acucar|\bcana\b|canavial/ },
  { label: 'feijão', re: /feijao|feijão/ },
  { label: 'trigo', re: /\btrigo\b/ },
  { label: 'arroz', re: /\barroz\b/ },
];

function strip(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/**
 * Parse the crops a farmer names in free text. Returns canonical labels,
 * deduped, in a stable order. Empty when nothing recognizable was said.
 */
export function parseCrops(text: string): string[] {
  const norm = strip(text);
  const found: string[] = [];
  for (const { label, re } of CROP_PATTERNS) {
    // Match against the accent-stripped text; patterns are written accent-free.
    if (re.test(norm) && !found.includes(label)) found.push(label);
  }
  return found;
}

/** Human-friendly join: ["soja","milho"] → "soja e milho". */
export function joinCrops(crops: string[]): string {
  if (crops.length === 0) return '';
  if (crops.length === 1) return crops[0];
  return crops.slice(0, -1).join(', ') + ' e ' + crops[crops.length - 1];
}
