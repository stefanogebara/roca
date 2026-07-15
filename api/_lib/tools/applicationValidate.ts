/**
 * AGROFIT cross-reference for a declared application. Given what the farmer says
 * they applied (crop + target + product/active), this annotates whether that
 * shows up in the MAPA registry — a factual *presence check*, never a
 * recommendation and never a dose judgment.
 *
 * Scope + honesty (dossier prime directive): the bundled agrofit slice is
 * indexed crop → pest → {ativos, products}. So this can confirm "há registro
 * para esse alvo nessa cultura" and, when the active is named, "esse ingrediente
 * ativo consta" — but it is NOT a per-product, per-dose legal compliance
 * certification. The report says so in its footer. A full product↔dose check
 * needs a richer extract (plan Phase 2.4).
 */

import { normalizeCrop, lookupPest } from './agrofit';

export interface ValidatableApplication {
  crop: string | null;
  product_name: string | null;
  active_ingredient: string | null;
  target: string | null;
}

export type ValidationLevel =
  | 'registrado' // the named active is registered for this crop + target
  | 'existe_registro' // there IS registry for this crop + target (active unconfirmed)
  | 'nao_localizado' // crop + target given, nothing found in the registry
  | 'sem_dados'; // not enough was declared to check

export interface ApplicationValidation {
  level: ValidationLevel;
  /** Short WhatsApp/card label. */
  label: string;
  /** Optional context (matched pest · crop, product count). */
  note?: string;
}

/** Lowercase, strip diacritics, collapse punctuation to spaces. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Whether a declared active/product name matches one of the registered actives. */
function activeMatches(declared: string, ativos: string[]): boolean {
  const d = norm(declared);
  if (!d) return false;
  const dTokens = d.split(' ').filter((t) => t.length >= 6);
  for (const a of ativos) {
    const na = norm(a);
    if (na.includes(d)) return true;
    if (dTokens.some((t) => na.includes(t))) return true;
  }
  return false;
}

/**
 * Cross-reference one declared application against AGROFIT. Pure (reads the
 * bundled registry). Never asserts a dose or a recommendation.
 */
export function validateApplication(app: ValidatableApplication): ApplicationValidation {
  const target = app.target?.trim();
  const declared = app.active_ingredient?.trim() || app.product_name?.trim() || '';

  // Without a target we can't ground a pest — a product name alone isn't enough
  // to responsibly assert registration status.
  if (!target) {
    return { level: 'sem_dados', label: 'sem dados p/ conferir no registro' };
  }

  const hit = lookupPest(normalizeCrop(app.crop), target);
  if (!hit) {
    return {
      level: 'nao_localizado',
      label: 'não localizei no registro MAPA',
      note: 'Vale conferir com o agrônomo.',
    };
  }

  const pestCtx = `${hit.entry.pest} · ${hit.crop}`;
  if (declared && activeMatches(declared, hit.entry.ativos)) {
    return { level: 'registrado', label: 'consta no registro MAPA', note: pestCtx };
  }
  return {
    level: 'existe_registro',
    label: 'há registro p/ esse alvo',
    note: `${hit.entry.products} produtos · ${pestCtx}`,
  };
}
