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

// Scaffolding that legitimately appears in a pure crop answer ("planto soja e
// milho", "uns 50 hectares de café", "tenho pasto pro gado", "bom dia! só
// soja"). Written accent-free — it runs against strip()ed text.
const ANSWER_FILLER =
  /\b(planto|plantamos|cultivo|cultivamos|crio|criamos|tenho|temos|mexo|mexemos|trabalho|trabalhamos|lido|lidamos|com|de|do|da|dos|das|no|na|nos|nas|em|e|eh|uns?|umas?|pouco|mais|so|tambem|aqui|meu|minha|meus|minhas|nosso|nossa|pra|pro|para|por|enquanto|hoje|atualmente|sim|oi|ola|bom|boa|dia|tarde|noite|obrigado|obrigada|hectares?|ha|alqueires?|pes?|sacas?|cabecas?|\d+)\b/g;

/**
 * Whether a message is essentially just naming crops — an answer to "o que
 * você planta?" — as opposed to a question/report that happens to mention one
 * ("posso pulverizar na soja?"). The onboarding capture must only confirm-and-
 * stop on the former; the latter has to route normally or the question is
 * swallowed (caught live). Strips crop names and answer scaffolding; anything
 * meaningful left over means the farmer said more than crops.
 */
export function isCropsOnlyMessage(text: string): boolean {
  if (text.includes('?')) return false;
  let rest = strip(text);
  for (const { re } of CROP_PATTERNS) {
    rest = rest.replace(new RegExp(re.source, 'g'), ' ');
  }
  rest = rest
    .replace(ANSWER_FILLER, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return rest.length <= 2;
}
