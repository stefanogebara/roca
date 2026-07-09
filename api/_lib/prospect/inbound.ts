/**
 * Handle an inbound WhatsApp message that came from a *prospect* (a business we
 * cold-messaged), not a farmer. The compliance-critical case: an opt-out ("sair"/
 * "parar") must be honoured immediately and permanently. A non-opt-out reply is
 * just annotated as engagement (status → replied) and left to flow through normal
 * handling, so a curious coop rep can still talk to Stevi.
 */

import { normalizePhoneBR, isOptOut } from './core';
import {
  findProspectByPhone,
  addOptout,
  markProspectReplied,
  logProspectMessage,
  getProspectThread,
  mergeProspectQualification,
  type ProspectRow,
} from './db';
import { AGENT_NAME, needsEscalation, buildAgentReply, extractQualification } from './agent';
import { alertFounders } from '../alert';
import { createLogger } from '../logger';

const log = createLogger('prospect-inbound');

export interface ProspectInboundResult {
  /** True when this message was fully handled here (opt-out) — stop the pipeline. */
  handled: boolean;
  /** A reply to send when handled (opt-out confirmation), else null. */
  reply: string | null;
  /** The matched prospect (null when the sender isn't one) — lets the pipeline
   * route non-opt-out replies to the conversation agent after media handling. */
  prospect: ProspectRow | null;
}

const NOT_A_PROSPECT: ProspectInboundResult = { handled: false, reply: null, prospect: null };

/**
 * Inspect an inbound from `waFrom` (raw WhatsApp id). If it's from a known
 * prospect and is an opt-out, blocklist the number and return a confirmation to
 * send (handled=true). If it's a prospect replying anything else, mark it
 * `replied` and return handled=false so normal handling continues.
 */
export async function handleProspectInbound(
  waFrom: string,
  text: string | null
): Promise<ProspectInboundResult> {
  const phone = normalizePhoneBR(waFrom);
  if (!phone) return NOT_A_PROSPECT;

  const prospect = await findProspectByPhone(phone);
  if (!prospect) return NOT_A_PROSPECT;

  if (isOptOut(text)) {
    await addOptout(phone, 'inbound opt-out');
    await markProspectReplied(prospect.id); // record the interaction, then never contact again
    log.info(`prospect opt-out honoured: ${prospect.id}`);
    return {
      handled: true,
      reply: 'Perfeito, não mando mais mensagens. 👍 Se um dia quiser conhecer a Stevi, é só chamar. Bom trabalho!',
      prospect,
    };
  }

  // A prospect engaged — valuable signal. The pipeline routes it to the
  // conversation agent (or, with agent_enabled=false, leaves it to the founder).
  await markProspectReplied(prospect.id);
  return { handled: false, reply: null, prospect };
}

/**
 * The conversation-agent turn for a prospect reply. `inboundText` must already
 * be normalized (voice transcribed, image described, vCard summarized). Logs
 * both directions to the thread, escalates to the founders when the trigger
 * fires (pricing/contract/human ask), and merges extracted qualification.
 * Returns the reply to send, or null when the agent is off (human takeover).
 */
export async function respondAsProspectAgent(
  prospect: ProspectRow,
  inboundText: string,
  inboundKind: string
): Promise<string | null> {
  await logProspectMessage(prospect.id, 'in', inboundKind, inboundText);

  if ((prospect as ProspectRow & { agent_enabled?: boolean }).agent_enabled === false) {
    // Human takeover: record, ping the founder, stay silent.
    await alertFounders(
      `💬 Prospect ${prospect.name} respondeu (agente desligado — responda você): "${inboundText.slice(0, 150)}"`
    );
    return null;
  }

  if (needsEscalation(inboundText)) {
    await alertFounders(
      `📞 Prospect ${prospect.name} pediu preço/contrato/humano — assuma a conversa: "${inboundText.slice(0, 150)}"`
    );
  }

  const thread = await getProspectThread(prospect.id);
  const reply = await buildAgentReply(prospect.name, thread, inboundText);
  await logProspectMessage(prospect.id, 'out', 'text', reply);

  // Extracted from the whole thread; a failure only costs freshness.
  const q = await extractQualification([...thread, { direction: 'in', text: inboundText }]);
  if (q) await mergeProspectQualification(prospect.id, q as Record<string, unknown>);

  log.info(`agent (${AGENT_NAME}) replied to prospect ${prospect.id}`);
  return reply;
}
