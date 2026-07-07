/**
 * The message pipeline: normalize → route → onboard/derive → reason → compliance
 * gate → persist → reply. Transport-agnostic; the webhook hands it an adapter.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { TransportAdapter, InboundMessage } from './transport/types';
import { TwilioAdapter } from './transport/twilio';
import { routeIntent } from './router';
import { reason } from './reason';
import { checkOutbound } from './compliance';
import {
  upsertUser,
  setFarmLocation,
  logMessage,
  deleteUserData,
} from './db';

let anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (anthropic) return anthropic;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
  anthropic = new Anthropic({ apiKey });
  return anthropic;
}

const LGPD_DELETE = /\b(apaga|apagar|exclui|excluir|delet)\w*\s+(meus?\s+)?dados\b/i;
const CONSENT_NOTE =
  '\n\n_Pra te dar conselhos melhores eu guardo sua localização e o histórico da conversa. É só o necessário, e você pode pedir "apaga meus dados" quando quiser. Mais tarde posso te conectar com um agrônomo de verdade se precisar._';

/**
 * Whether this is the user's first message (so we append the LGPD/consent note).
 * upsertUser returns the row; a freshly-created row has no consent timestamp yet.
 */
function isFirstContact(user: { consent_lgpd_at: string | null } | null): boolean {
  return !!user && user.consent_lgpd_at == null;
}

export async function handleInbound(
  adapter: TransportAdapter,
  msg: InboundMessage
): Promise<void> {
  const client = getAnthropic();

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

  await logMessage(userId, 'in', {
    kind: msg.kind,
    text: msg.text,
    messageId: msg.messageId,
  });

  // Location messages: persist and (if that's all they sent) reflect the payback moment.
  if (msg.kind === 'location' && msg.location && userId) {
    await setFarmLocation(userId, msg.location.lat, msg.location.lon);
  }

  const intent = await routeIntent(msg, client);

  // Fetch image media lazily, only for pest triage on the Twilio path.
  let media: { base64: string; mime: string } | null = null;
  if (msg.kind === 'image' && msg.mediaUrl && adapter instanceof TwilioAdapter) {
    try {
      media = await adapter.fetchMedia(msg.mediaUrl);
    } catch (e) {
      console.error('media fetch failed:', (e as Error).message);
    }
  }

  let replyText: string;
  try {
    replyText = await reason(msg, intent, { client, userId, media });
  } catch (e) {
    console.error('reasoning failed:', (e as Error).message);
    replyText =
      'Tive um problema pra processar isso agora. Tenta de novo daqui a pouco, ou manda de outro jeito.';
  }

  const gate = checkOutbound(replyText);
  if (!gate.safe) {
    console.error('compliance gate tripped:', gate.flags.join('; '));
  }
  let finalText = gate.text;

  if (firstContact) finalText += CONSENT_NOTE;

  await adapter.send({ to: msg.from, text: finalText });
  await logMessage(userId, 'out', {
    kind: 'text',
    text: finalText,
    intent,
  });
}
