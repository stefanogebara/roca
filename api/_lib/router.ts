/**
 * Intent router. A cheap-tier model classifies each inbound message into one
 * path (dossier Part 6.3). Structural signals (image → pest triage, location →
 * onboarding) short-circuit the LLM call. On any doubt we default to the safe
 * path: general reasoning with the handoff, never a confident prescription.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { InboundMessage } from './transport/types';
import { MODELS } from './env';

export type Intent =
  | 'pest_triage'
  | 'spray_window'
  | 'field_profile'
  | 'general'
  | 'onboarding'
  | 'smalltalk';

const ROUTER_INSTRUCTION = `Classifique a mensagem do produtor rural em UMA categoria. Responda só com a palavra-chave.

Categorias:
- pest_triage: fala de bicho, praga, doença, mancha, folha estranha, "que praga é essa".
- spray_window: pergunta se pode pulverizar/aplicar hoje/agora, sobre vento, chuva, clima pra aplicação.
- field_profile: pergunta sobre o próprio solo, terra, pH, fertilidade.
- general: dúvida agronômica geral (plantio, adubação, cultura, calendário, vazio sanitário).
- smalltalk: saudação, "oi", "quem é você", agradecimento, sem conteúdo agronômico.

Responda apenas a palavra-chave, nada mais.`;

const VALID: Intent[] = [
  'pest_triage',
  'spray_window',
  'field_profile',
  'general',
  'smalltalk',
];

/**
 * Route a message to an intent. Structural fast-paths first; LLM classification
 * for text. Defaults to 'general' (safe path) if classification is unclear.
 */
export async function routeIntent(
  msg: InboundMessage,
  client: Anthropic
): Promise<Intent> {
  // Structural signals beat the LLM.
  if (msg.kind === 'image') return 'pest_triage';
  if (msg.kind === 'location') return 'onboarding';

  const text = msg.text?.trim();
  if (!text) return 'general';

  try {
    const resp = await client.messages.create({
      model: MODELS.router(),
      max_tokens: 12,
      system: ROUTER_INSTRUCTION,
      messages: [{ role: 'user', content: text }],
    });
    const raw =
      resp.content[0]?.type === 'text' ? resp.content[0].text.trim().toLowerCase() : '';
    const match = VALID.find((v) => raw.includes(v));
    return match ?? 'general';
  } catch {
    // Never fail the whole message on a classification error — degrade to safe path.
    return 'general';
  }
}
