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
  deleteUserData,
  markConsentNotified,
} from './db';
import { createLogger } from './logger';

const log = createLogger('pipeline');

const LGPD_DELETE = /\b(apaga|apagar|exclui|excluir|delet)\w*\s+(meus?\s+)?dados\b/i;
const CONSENT_NOTE =
  '\n\n_Pra te dar conselhos melhores eu guardo sua localização e o histórico da conversa. É só o necessário, e você pode pedir "apaga meus dados" quando quiser. Mais tarde posso te conectar com um agrônomo de verdade se precisar._';

const FALLBACK_REPLY =
  'Tive um problema pra processar isso agora. Tenta de novo daqui a pouco, ou manda de outro jeito.';

function isFirstContact(user: { consent_lgpd_at: string | null } | null): boolean {
  return !!user && user.consent_lgpd_at == null;
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

  await logMessage(userId, 'in', {
    kind: msg.kind,
    text: effective.text,
    transcript,
    messageId: msg.messageId,
  });

  let intent: Intent;
  let replyText: string;

  if (msg.kind === 'voice' && !transcript) {
    intent = 'general';
    replyText =
      'Recebi seu áudio mas não consegui entender direito. 🙉 Pode escrever em texto, ou mandar o áudio de novo mais pertinho do celular?';
  } else if (effective.kind === 'location' && effective.location) {
    // Pin drop → the payback moment. Deterministic, no LLM needed.
    intent = 'onboarding';
    replyText = await buildFarmCard(userId, effective.location.lat, effective.location.lon);
  } else {
    intent = await routeIntent(effective);
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

  await adapter.send({ to: msg.from, text: finalText });
  if (firstContact && userId) await markConsentNotified(userId);
  await logMessage(userId, 'out', {
    kind: 'text',
    text: finalText,
    intent,
  });
}
