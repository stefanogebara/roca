/**
 * The message pipeline: normalize (ASR for voice) → route → farm card or
 * reason → compliance gate → persist → reply. Transport-agnostic; the webhook
 * hands it an adapter.
 */

import type { TransportAdapter, InboundMessage } from './transport/types';
import { routeIntent, type Intent } from './router';
import { reason } from './reason';
import { buildFarmCard } from './farmcard';
import { transcribeVoice } from './transcribe';
import { checkOutbound } from './compliance';
import type { ChatImage } from './llm';
import {
  upsertUser,
  logMessage,
  claimInbound,
  updateInboundTranscript,
  deleteUserData,
  markConsentNotified,
  setAwaiting,
  setFarmCrops,
  countRecentInbound,
  getFarmProfile,
  createReferralRequest,
} from './db';
import { parseCrops, joinCrops } from './tools/crops';
import { createLogger } from './logger';

const log = createLogger('pipeline');

// Rate limit: protects the LLM-calling endpoint from abuse and echo loops.
// Generous for real use (a human won't send 15 messages in a minute).
const RATE_MAX_PER_WINDOW = 15;
const RATE_WINDOW_MS = 60_000;

const LGPD_DELETE = /\b(apaga|apagar|exclui|excluir|delet)\w*\s+(meus?\s+)?dados\b/i;
const CONSENT_NOTE =
  '\n\n_Pra te dar conselhos melhores eu guardo sua localização e o histórico da conversa. É só o necessário, e você pode pedir "apaga meus dados" quando quiser. Mais tarde posso te conectar com um agrônomo de verdade se precisar._';

const FALLBACK_REPLY =
  'Tive um problema pra processar isso agora. Tenta de novo daqui a pouco, ou manda de outro jeito.';

// Explicit request to be connected to an agrônomo (the referral opt-in). Kept
// conservative so we only capture on a clear ask — storing is within the
// onboarding consent; sharing with a third party would ask again (future).
const REFERRAL_INTENT =
  /\b(me\s+(indic\w*|arrum\w*|ach\w*|conect\w*|pass\w*)\s+(um\s+)?agr[oôó]nomo|quero\s+(um\s+|falar\s+com\s+(um\s+)?)?agr[oôó]nomo|preciso\s+de\s+(um\s+)?agr[oôó]nomo|(conect\w*|indic\w*)\s+[^.?!]{0,30}\bagr[oôó]nomo)/i;

/** Whether a message is an explicit request to be connected to an agrônomo. */
export function isReferralRequest(text: string): boolean {
  return REFERRAL_INTENT.test(text);
}

// Satellite field-vigor (NDVI) request — asks how the field looks from space, or
// how the crop is doing overall. Kept a fast regex because it triggers a distinct
// action (satellite fetch) that the generic router would likely miss.
const FIELD_HEALTH_INTENT =
  /\b(sat[ée]lite|ndvi|vigor\b|imagem\s+(da|de|por)\s+sat[ée]lite)|como\s+(est[áa]|t[áa]|vai)\s+(a\s+|minha\s+|a\s+minha\s+)?(lavoura|ro[çc]a|planta[çc][ãa]o|plantio)/i;

/** Whether a message asks for a satellite/vigor read of the field. */
export function isFieldHealthRequest(text: string): boolean {
  return FIELD_HEALTH_INTENT.test(text);
}

// Bump this string whenever REFERRAL_REPLY's wording changes — it's stored with
// each opt-in so the consent is provable (LGPD accountability).
const REFERRAL_CONSENT_VERSION = 'referral-v1-2026-07';

const REFERRAL_REPLY =
  'Boa! 🙌 Anotei seu interesse em falar com um agrônomo — e não passo seus dados pra ninguém sem te perguntar antes.\n\n' +
  'Pra adiantar, leve pro agrônomo: fotos da lavoura, a cultura e a fase, e o que você observou (onde começou, como espalhou). Ele faz o diagnóstico e, se precisar, o receituário — o documento técnico que define o produto e a dose certos.\n\n' +
  'Dica: agrônomo tem registro no CREA do seu estado, e cooperativa/revenda geralmente tem um técnico responsável. Assim que a nossa rede de agrônomos parceiros estiver pronta, eu te conecto direto por aqui. 👊';

function isFirstContact(user: { consent_lgpd_at: string | null } | null): boolean {
  return !!user && user.consent_lgpd_at == null;
}

/**
 * Quick-reply buttons per intent. Titles ARE real queries: a tap arrives as a
 * normal text message and routes through the existing pipeline ("Ver satélite"
 * → field_health regex, "Quero um agrônomo" → referral regex, "Posso
 * pulverizar?" → router). ≤3 buttons, ≤20 chars, only next steps that already
 * work. Adapters degrade to plain text when buttons can't render.
 */
export function buttonsForIntent(intent: Intent): string[] | undefined {
  switch (intent) {
    case 'smalltalk':
      return ['Posso pulverizar?', 'Ver satélite', 'Quero um agrônomo'];
    case 'spray_window':
      return ['Ver satélite', 'Quero um agrônomo'];
    case 'field_health':
      return ['Posso pulverizar?', 'Quero um agrônomo'];
    case 'pest_triage':
      return ['Quero um agrônomo'];
    default:
      return undefined;
  }
}

export async function handleInbound(
  adapter: TransportAdapter,
  msg: InboundMessage
): Promise<void> {
  // LGPD deletion short-circuit — honour it before anything else.
  if (msg.text && LGPD_DELETE.test(msg.text)) {
    await deleteUserData(msg.from);
    await adapter.send({
      to: msg.from,
      text: 'Pronto, apaguei seus dados (localização e histórico). Se quiser voltar a usar é só mandar mensagem. 👍',
    });
    return;
  }

  const user = await upsertUser(msg.from, msg.profileName);
  const userId = user?.id ?? null;
  const firstContact = isFirstContact(user);

  // Idempotency gate: claim the message by provider id before any work. A
  // provider retry (timeout redelivery) is a duplicate → ack without reprocessing.
  const claimed = await claimInbound(userId, {
    kind: msg.kind,
    text: msg.text,
    messageId: msg.messageId,
  });
  if (!claimed) {
    log.info('duplicate inbound ignored:', msg.messageId);
    return;
  }

  // Rate limit before any expensive work (media fetch, LLM). The current message
  // is already claimed (counted), so throttle strictly above the cap; notify once
  // at the threshold, then drop silently so a flood / echo loop can't storm.
  if (userId) {
    const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
    const count = await countRecentInbound(userId, since);
    if (count > RATE_MAX_PER_WINDOW) {
      if (count === RATE_MAX_PER_WINDOW + 1) {
        const notice =
          'Opa, chegou bastante coisa junta! 😅 Me dá uns segundinhos e manda de novo, que eu te respondo com calma.';
        await adapter.send({ to: msg.from, text: notice });
        await logMessage(userId, 'out', { kind: 'text', text: notice, intent: 'rate_limited' });
      }
      return;
    }
  }

  // Media fetch (image or voice) — provider-agnostic, lazy, fail-soft.
  let media: ChatImage | null = null;
  let transcript: string | null = null;
  if (msg.mediaUrl && adapter.fetchMedia) {
    try {
      const fetched = await adapter.fetchMedia(msg.mediaUrl);
      if (msg.kind === 'image') {
        media = { base64: fetched.base64, mime: fetched.mime };
      } else if (msg.kind === 'voice') {
        transcript = await transcribeVoice(fetched.base64, fetched.mime);
      }
    } catch (e) {
      log.error('media fetch failed:', (e as Error).message);
    }
  }

  // A transcribed voice note becomes a normal text message downstream.
  const effective: InboundMessage =
    msg.kind === 'voice' && transcript ? { ...msg, kind: 'text', text: transcript } : msg;

  // Attach the transcript to the already-claimed inbound row (observability).
  if (transcript) await updateInboundTranscript(msg.messageId, transcript);

  let intent: Intent;
  let replyText: string;

  // If we asked what they grow (right after the farm card) and they replied with
  // recognizable crops, capture them. A non-crop reply clears the wait and falls
  // through to normal handling, so the message is never swallowed.
  const cropAnswer =
    user?.awaiting === 'crop' && effective.kind === 'text' && effective.text
      ? parseCrops(effective.text)
      : null;

  if (cropAnswer && cropAnswer.length > 0) {
    if (userId) {
      await setFarmCrops(userId, cropAnswer);
      await setAwaiting(userId, null);
    }
    intent = 'onboarding';
    replyText = `Anotado: você trabalha com ${joinCrops(cropAnswer)}. 🌱 Agora que sei sua cultura, meus conselhos ficam mais no ponto. Manda foto de praga, pergunta "posso pulverizar hoje?", ou o que precisar.`;
  } else if (effective.kind === 'text' && effective.text && isReferralRequest(effective.text)) {
    // Explicit agrônomo referral request — the business-model seed.
    intent = 'referral';
    if (userId) {
      if (user?.awaiting) await setAwaiting(userId, null);
      const profile = await getFarmProfile(userId);
      await createReferralRequest(userId, {
        uf: profile.uf,
        crop: profile.crop,
        topic: effective.text.slice(0, 280),
        consentVersion: REFERRAL_CONSENT_VERSION,
      });
    }
    replyText = REFERRAL_REPLY;
  } else if (msg.kind === 'voice' && !transcript) {
    intent = 'general';
    replyText =
      'Recebi seu áudio mas não consegui entender direito. 🙉 Pode escrever em texto, ou mandar o áudio de novo mais pertinho do celular?';
  } else if (effective.kind === 'location' && effective.location) {
    // Pin drop → the payback moment. Deterministic, no LLM needed.
    intent = 'onboarding';
    replyText = await buildFarmCard(userId, effective.location.lat, effective.location.lon);
    if (userId) await setAwaiting(userId, 'crop');
  } else {
    // A pending crop question that got a non-crop reply: stop waiting, answer normally.
    if (user?.awaiting === 'crop' && userId) await setAwaiting(userId, null);
    intent =
      effective.text && isFieldHealthRequest(effective.text)
        ? 'field_health'
        : await routeIntent(effective);
    try {
      replyText = await reason(effective, intent, { userId, media });
    } catch (e) {
      log.error('reasoning failed:', (e as Error).message);
      replyText = FALLBACK_REPLY;
    }
  }

  const gate = checkOutbound(replyText);
  if (!gate.safe) {
    log.error('compliance gate tripped:', gate.flags.join('; '));
  }
  let finalText = gate.text;

  if (firstContact) finalText += CONSENT_NOTE;

  await adapter.send({ to: msg.from, text: finalText, buttons: buttonsForIntent(intent) });
  if (firstContact && userId) await markConsentNotified(userId);
  await logMessage(userId, 'out', {
    kind: 'text',
    text: finalText,
    intent,
  });
}
