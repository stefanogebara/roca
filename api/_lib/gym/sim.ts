/**
 * Gym SIMULATOR — offline voice training, ZERO side effects.
 *
 * An LLM plays a farmer PERSONA against the REAL Stevi brain (reason()) to
 * produce a transcript we can later judge. Nothing here touches the outside
 * world beyond LLM calls:
 *   - reason() is always invoked with `userId: null`, which guarantees no DB
 *     reads/writes (no farm lookups, no NDVI cache writes).
 *   - No WhatsApp sends happen — we never call any transport adapter.
 *   - The only mutation is building the local transcript array.
 * The persona's voice is driven purely by chat() on the cheap tier; Stevi's
 * voice is driven by reason() with a style-pack `packOverride` (the pack BODY
 * under test; null means "base prompt only").
 */

import type { Persona, SimTranscript, Turn } from './types';
import type { InboundMessage } from '../transport/types';
import { reason } from '../reason';
import { routeIntent } from '../router';
import { chat } from '../llm';
import { MODELS } from '../env';
import { createLogger } from '../logger';

const log = createLogger('gym-sim');

const DEFAULT_MAX_TURNS = 5;
const END_TOKEN = '[FIM]';

const PERSONA_RULES =
  'Você é ESTE produtor no WhatsApp conversando com a Stevi (assistente agrícola). ' +
  'Responda SEMPRE como o produtor, curto, no registro dele. NÃO seja a Stevi. ' +
  'Se já resolveu ou perdeu o interesse, responda apenas com o token [FIM]. Uma mensagem só.';

/** Build the text InboundMessage a simulated farmer turn sends to Stevi. */
function farmerMessage(persona: Persona, index: number, text: string): InboundMessage {
  return {
    from: 'sim',
    messageId: `sim-${index}`,
    kind: 'text',
    text,
    mediaUrl: null,
    mediaMime: null,
    location: null,
    profileName: persona.label,
  };
}

/** Render the dialogue so far as prompt lines, ending with an open "Produtor:". */
function dialoguePrompt(turns: Turn[]): string {
  const lines = turns.map((t) => `${t.role === 'farmer' ? 'Produtor' : 'Stevi'}: ${t.text}`);
  lines.push('Produtor:');
  return lines.join('\n');
}

/** Ask Stevi (the real brain) to reply to a farmer message. Zero side effects. */
async function steviReply(msg: InboundMessage, packBody: string | null): Promise<string> {
  const intent = await routeIntent(msg);
  return reason(msg, intent, { userId: null, packOverride: packBody });
}

/**
 * Run one simulated conversation: `persona` (played by an LLM) vs. the real
 * Stevi brain configured with `packBody`. Up to `maxTurns` farmer turns; Stevi
 * replies after each. Resilient — any LLM failure ends the transcript
 * gracefully at whatever was collected so far.
 */
export async function simulate(
  persona: Persona,
  packVersion: number,
  packBody: string | null,
  opts?: { maxTurns?: number }
): Promise<SimTranscript> {
  const maxTurns = opts?.maxTurns ?? DEFAULT_MAX_TURNS;
  const turns: Turn[] = [];

  try {
    // Turn 1: the persona's fixed opener.
    turns.push({ role: 'farmer', text: persona.opener });
    const firstReply = await steviReply(farmerMessage(persona, 1, persona.opener), packBody);
    if (firstReply.includes(END_TOKEN)) {
      return { persona: persona.key, packVersion, turns };
    }
    turns.push({ role: 'stevi', text: firstReply });

    // Turns 2..maxTurns: the persona LLM improvises follow-ups.
    for (let i = 2; i <= maxTurns; i++) {
      const raw = await chat({
        model: MODELS.router(),
        temperature: 0.9,
        maxTokens: 120,
        system: `${persona.brief}\n\n${PERSONA_RULES}`,
        user: dialoguePrompt(turns),
      });

      // Persona ended the conversation (explicit token or nothing to say).
      const trimmed = raw.trim();
      if (!trimmed || trimmed.includes(END_TOKEN)) break;

      const farmerText = trimmed;
      turns.push({ role: 'farmer', text: farmerText });

      const reply = await steviReply(farmerMessage(persona, i, farmerText), packBody);
      // If Stevi's reply carries the end token, record it stripped and stop.
      if (reply.includes(END_TOKEN)) {
        turns.push({ role: 'stevi', text: reply.replace(END_TOKEN, '').trim() });
        break;
      }
      turns.push({ role: 'stevi', text: reply });
    }
  } catch (e) {
    // One failed LLM call must not crash the whole gym run — end gracefully
    // with whatever transcript we managed to collect.
    log.error(`sim aborted for persona ${persona.key}:`, (e as Error).message);
  }

  return { persona: persona.key, packVersion, turns };
}
