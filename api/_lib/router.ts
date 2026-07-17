/**
 * Intent router. A cheap-tier model classifies each inbound message into one
 * path (dossier Part 6.3). Structural signals (image → pest triage, location →
 * onboarding) short-circuit the LLM call. On any doubt we default to the safe
 * path: general reasoning with the handoff, never a confident prescription.
 */

import type { InboundMessage } from './transport/types';
import { chat } from './llm';
import { MODELS } from './env';
import { createLogger } from './logger';

const log = createLogger('router');

// --- Intent taxonomy: the single source of truth ---------------------------
// The `Intent` union is DERIVED from these producer sets, so the type and the
// runtime allow-lists can't drift apart. Each intent is grouped by who emits it;
// a few intents have more than one producer (e.g. 'general' is both an LLM class
// and a fast-path reply; 'onboarding' is structural and fast-path; 'pest_triage'
// is LLM and structural) — that overlap is intentional, not a duplicate map.

/** Intents a cheap-tier model may classify a text message into (see VALID/routeIntent). */
export const LLM_INTENTS = ['pest_triage', 'spray_window', 'field_profile', 'general', 'smalltalk'] as const;
/** Intents short-circuited by message structure before the LLM (image → pest, location → onboarding). */
export const STRUCTURAL_INTENTS = ['pest_triage', 'onboarding'] as const;
/** Intents emitted by the regex fast-path routes (the pipeline ROUTES table). Kept in sync by a guard test. */
export const FASTPATH_INTENTS = [
  'onboarding',
  'referral',
  'financing_report',
  'application_report',
  'history',
  'application_log',
  'prices',
  'brief',
  'general',
] as const;
/** Intents emitted only by the reasoning fallback's own regex. */
export const FALLBACK_INTENTS = ['field_health'] as const;

export type Intent =
  | (typeof LLM_INTENTS)[number]
  | (typeof STRUCTURAL_INTENTS)[number]
  | (typeof FASTPATH_INTENTS)[number]
  | (typeof FALLBACK_INTENTS)[number];

const ROUTER_INSTRUCTION = `Classifique a mensagem do produtor rural em UMA categoria. Responda só com a palavra-chave.

Categorias:
- pest_triage: fala de bicho, praga, doença, mancha, folha estranha, "que praga é essa".
- spray_window: pergunta se pode pulverizar/aplicar hoje/agora, sobre vento, chuva, clima pra aplicação.
- field_profile: pergunta sobre o próprio solo, terra, pH, fertilidade.
- general: dúvida agronômica geral (plantio, adubação, cultura, calendário, vazio sanitário).
- smalltalk: saudação, "oi", "quem é você", agradecimento, sem conteúdo agronômico.

Responda apenas a palavra-chave, nada mais.`;

// The classifier allow-list IS the LLM producer set — no second hand-maintained
// copy to drift from the taxonomy above.
const VALID = LLM_INTENTS;

/**
 * Route a message to an intent. Structural fast-paths first; LLM classification
 * for text. Defaults to 'general' (safe path) if classification is unclear.
 */
export async function routeIntent(msg: InboundMessage): Promise<Intent> {
  // Structural signals beat the LLM.
  if (msg.kind === 'image') return 'pest_triage';
  if (msg.kind === 'location') return 'onboarding';

  const text = msg.text?.trim();
  if (!text) return 'general';

  try {
    const raw = await chat({
      model: MODELS.router(),
      system: ROUTER_INSTRUCTION,
      user: text,
      maxTokens: 12,
    });
    const lowered = raw.toLowerCase();
    const match = VALID.find((v) => lowered.includes(v));
    return match ?? 'general';
  } catch (e) {
    // Never fail the whole message on a classification error — degrade to safe path.
    log.error('intent classification failed:', (e as Error).message);
    return 'general';
  }
}
