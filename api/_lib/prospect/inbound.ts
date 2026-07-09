/**
 * Handle an inbound WhatsApp message that came from a *prospect* (a business we
 * cold-messaged), not a farmer. The compliance-critical case: an opt-out ("sair"/
 * "parar") must be honoured immediately and permanently. A non-opt-out reply is
 * just annotated as engagement (status → replied) and left to flow through normal
 * handling, so a curious coop rep can still talk to Stevi.
 */

import { normalizePhoneBR, isOptOut } from './core';
import { findProspectByPhone, addOptout, markProspectReplied } from './db';
import { createLogger } from '../logger';

const log = createLogger('prospect-inbound');

export interface ProspectInboundResult {
  /** True when this message was fully handled here (opt-out) — stop the pipeline. */
  handled: boolean;
  /** A reply to send when handled (opt-out confirmation), else null. */
  reply: string | null;
}

const NOT_A_PROSPECT: ProspectInboundResult = { handled: false, reply: null };

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
    };
  }

  // A prospect engaged — valuable signal. Let the normal pipeline take the reply.
  await markProspectReplied(prospect.id);
  return NOT_A_PROSPECT;
}
