/**
 * The message pipeline: normalize (ASR for voice) → route → farm card or
 * reason → compliance gate → persist → reply. Transport-agnostic; the webhook
 * hands it an adapter.
 */

import type { TransportAdapter, InboundMessage } from './transport/types';
import { routeIntent, type Intent } from './router';
import { reason } from './reason';
import { buildFarmCard } from './farmcard';
import { buildAgronomoBrief } from './brief';
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
  getFarm,
  getFarmLocation,
  getCachedNdvi,
  hasRecentReferral,
  getActivityLog,
} from './db';
import { buildHistoryReply } from './caderno';
import { fetchPrices, formatPricesReply } from './tools/prices';
import { parseCrops, joinCrops } from './tools/crops';
import type { PestCardData } from './cards/pest';
import { withRetry } from './retry';
import { alertFounders } from './alert';
import { sendReferralNotification, pingFoundersWhatsApp } from './notify';
import { maskWa } from './opsData';
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

// "Meu histórico" / "meu caderno" — the passive caderno de campo read-out.
// Anchored to possessives/conversation so "histórico de chuva" doesn't match.
const HISTORY_INTENT =
  /\b(meu|nosso)\s+(hist[óo]rico|caderno)\b|\bo\s+que\s+(a\s+gente\s+|n[óo]s\s+)?(j[áa]\s+)?(conversamos|falamos|falou)\b/i;

/** Whether a message asks for the farmer's own history/caderno. */
export function isHistoryRequest(text: string): boolean {
  return HISTORY_INTENT.test(text);
}

// Commodity quote asks — "cotação do café", "quanto tá a soja", "preço do
// milho", bare "cotações". Anchored to the commodities we can quote so
// "preço do frete" doesn't match.
// (no trailing \b after the commodity group: "café" ends in a non-ASCII word
// char, which JS \b mishandles — accent-aware lookahead instead)
const PRICE_INTENT =
  /\bcota[çc][õo]es?\b|\b(cota[çc][ãa]o|pre[çc]o)\b[^.?!]*\b(caf[ée]|soja|milho|d[óo]lar)(?![\wÀ-ÿ])|\bquanto\s+(t[áa]|est[áa]|anda)\s+(o\s+|a\s+)?(caf[ée]|soja|milho|d[óo]lar)(?![\wÀ-ÿ])/i;

/** Whether a message asks for commodity quotes. */
export function isPriceRequest(text: string): boolean {
  return PRICE_INTENT.test(text);
}

// Request to assemble the "resumo pro agrônomo" — the briefing the farmer
// forwards to a real agronomist. Also fired by the "Montar resumo" quick-reply.
const BRIEF_INTENT = /\bresumo\b|prepara[r]?\s+(pra|pro|para o)\s+agr[oôó]nomo/i;

/** Whether a message asks Stevi to assemble the agrônomo briefing. */
export function isBriefRequest(text: string): boolean {
  return BRIEF_INTENT.test(text);
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

// Where the public card images are served from (WhatsApp fetches these).
const PUBLIC_BASE = process.env.PUBLIC_BASE_URL || 'https://roca-black.vercel.app';

/**
 * Optional visual card for a reply, as a public PNG URL WhatsApp can fetch.
 * Reads the same data the reply used (fresh coords for spray; the just-cached
 * NDVI reading for field health), so it stays a thin presentation layer on top
 * of reason() — no change to reason()'s contract. Returns undefined when there's
 * nothing visual to add (or the underlying data isn't available).
 */
async function cardUrlFor(
  intent: Intent,
  msg: InboundMessage,
  userId: string | null
): Promise<string | undefined> {
  try {
    // Pin drop → the farm card (soil + spray + vazio) as the onboarding payback.
    if (msg.kind === 'location' && msg.location) {
      const { lat, lon } = msg.location;
      return `${PUBLIC_BASE}/api/card?type=farm&lat=${lat}&lon=${lon}`;
    }
    if (intent === 'spray_window') {
      let coords = msg.location;
      if (!coords && userId) coords = await getFarmLocation(userId);
      if (coords) return `${PUBLIC_BASE}/api/card?type=spray&lat=${coords.lat}&lon=${coords.lon}`;
    } else if (intent === 'field_health' && userId) {
      const farm = await getFarm(userId);
      if (farm) {
        const r = await getCachedNdvi(farm.id);
        if (r) {
          const q = new URLSearchParams({ type: 'ndvi', ndvi: String(r.ndvi), date: r.date });
          if (r.std != null) q.set('std', String(r.std));
          if (r.samples != null) q.set('samples', String(r.samples));
          // Pin coords let the card add a true-colour mini-map of the field.
          const loc = await getFarmLocation(userId);
          if (loc) {
            q.set('lat', String(loc.lat));
            q.set('lon', String(loc.lon));
          }
          return `${PUBLIC_BASE}/api/card?${q.toString()}`;
        }
      }
    }
  } catch (e) {
    log.error('cardUrlFor failed:', (e as Error).message);
  }
  return undefined;
}

/** Public URL for the pest-triage card, built from the vision identification. */
function pestCardUrl(c: PestCardData): string {
  const q = new URLSearchParams({ type: 'pest', pest: c.pest, confidence: c.confidence });
  if (c.crop) q.set('crop', c.crop);
  if (c.evidence) q.set('evidence', c.evidence.slice(0, 160));
  if (c.products != null) q.set('products', String(c.products));
  if (c.groups && c.groups.length) q.set('groups', c.groups.slice(0, 4).join('|'));
  return `${PUBLIC_BASE}/api/card?${q.toString()}`;
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
      return ['Montar resumo', 'Quero um agrônomo'];
    case 'referral':
      return ['Montar resumo'];
    case 'general':
      // Q&A is the highest-volume intent; scaffolded next steps are the
      // evidence-backed engagement lever (Farmer.Chat: suggested follow-ups
      // drove ~45% of interactions).
      return ['Posso pulverizar?', 'Ver satélite', 'Quero um agrônomo'];
    case 'brief':
      // The resumo exists to hand to a professional — offer the connection.
      return ['Quero um agrônomo'];
    case 'history':
      // From the season record, the useful next steps are the pro handoffs.
      return ['Montar resumo', 'Quero um agrônomo'];
    case 'prices':
      return ['Posso pulverizar?', 'Ver satélite'];
    default:
      return undefined;
  }
}

/**
 * Send with retries; a send that still fails is never silent — it's logged,
 * recorded as a `send_failed` outbound row (so the digest and ops console
 * surface it), and alerted to the founders. Returns whether the farmer
 * actually got the message, so callers can skip "delivered" side effects.
 */
async function sendOrRecord(
  adapter: TransportAdapter,
  to: string,
  out: { text: string; buttons?: string[]; mediaUrl?: string },
  userId: string | null,
  intent: string
): Promise<boolean> {
  try {
    await withRetry(() =>
      adapter.send({ to, text: out.text, buttons: out.buttons, mediaUrl: out.mediaUrl })
    );
    return true;
  } catch (e) {
    const reason = (e as Error).message;
    log.error('send failed after retries:', reason);
    if (userId) {
      await logMessage(userId, 'out', { kind: 'text', text: out.text, intent: 'send_failed' });
    }
    // No phone number in the alert — masked-PII discipline applies here too.
    await alertFounders(`⚠️ Stevi: envio ao produtor falhou (${intent}) — ${reason.slice(0, 200)}`);
    return false;
  }
}

export async function handleInbound(
  adapter: TransportAdapter,
  msg: InboundMessage
): Promise<void> {
  // LGPD deletion short-circuit — honour it before anything else. No DB write
  // on a send failure here: the user's data was just deleted, keep it that way.
  if (msg.text && LGPD_DELETE.test(msg.text)) {
    await deleteUserData(msg.from);
    try {
      await withRetry(() =>
        adapter.send({
          to: msg.from,
          text: 'Pronto, apaguei seus dados (localização e histórico). Se quiser voltar a usar é só mandar mensagem. 👍',
        })
      );
    } catch (e) {
      log.error('LGPD confirmation send failed:', (e as Error).message);
      await alertFounders(
        `⚠️ Stevi: confirmação de exclusão LGPD não foi entregue — ${(e as Error).message.slice(0, 200)}`
      );
    }
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
        const sent = await sendOrRecord(adapter, msg.from, { text: notice }, userId, 'rate_limited');
        if (sent) {
          await logMessage(userId, 'out', { kind: 'text', text: notice, intent: 'rate_limited' });
        }
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
  let pestCard: PestCardData | undefined;

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
  } else if (effective.kind === 'text' && effective.text && isHistoryRequest(effective.text)) {
    // Passive caderno de campo — the season record Stevi keeps for free.
    intent = 'history';
    if (userId && user?.awaiting) await setAwaiting(userId, null);
    replyText = userId
      ? buildHistoryReply(await getFarmProfile(userId), await getActivityLog(userId))
      : buildHistoryReply({ uf: null, crop: null }, []);
  } else if (effective.kind === 'text' && effective.text && isPriceRequest(effective.text)) {
    // Commodity quotes — the price habit loop. Crop-filtered when known.
    intent = 'prices';
    if (userId && user?.awaiting) await setAwaiting(userId, null);
    const profile = userId ? await getFarmProfile(userId) : { uf: null, crop: null };
    const { quotes, usdBrl } = await fetchPrices(profile.crop);
    replyText = formatPricesReply(quotes, usdBrl);
  } else if (effective.kind === 'text' && effective.text && isBriefRequest(effective.text)) {
    // Assemble the agrônomo briefing from the farmer's profile + recent messages.
    intent = 'brief';
    if (userId && user?.awaiting) await setAwaiting(userId, null);
    replyText = await buildAgronomoBrief(userId);
  } else if (effective.kind === 'text' && effective.text && isReferralRequest(effective.text)) {
    // Explicit agrônomo referral request — the business-model seed.
    intent = 'referral';
    if (userId) {
      if (user?.awaiting) await setAwaiting(userId, null);
      const profile = await getFarmProfile(userId);
      // Checked BEFORE inserting the new row: repeat taps within 24h stay
      // quiet on founder channels (the row below is still recorded for audit).
      const alreadyNotified = await hasRecentReferral(
        userId,
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      );
      await createReferralRequest(userId, {
        uf: profile.uf,
        crop: profile.crop,
        topic: effective.text.slice(0, 280),
        consentVersion: REFERRAL_CONSENT_VERSION,
      });
      if (!alreadyNotified) {
        // Concierge handoff: a human hears about the opt-in immediately —
        // email + WhatsApp ping to the founders' own numbers.
        const notice = {
          maskedPhone: maskWa(msg.from),
          uf: profile.uf,
          crops: profile.crop,
          topic: effective.text.slice(0, 280),
        };
        await sendReferralNotification(notice);
        await pingFoundersWhatsApp((to, text) => adapter.send({ to, text }), notice);
      }
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
      replyText = await reason(effective, intent, {
        userId,
        media,
        onPestCard: (c) => {
          pestCard = c;
        },
      });
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

  const mediaUrl = pestCard ? pestCardUrl(pestCard) : await cardUrlFor(intent, effective, userId);
  const sent = await sendOrRecord(
    adapter,
    msg.from,
    { text: finalText, buttons: buttonsForIntent(intent), mediaUrl },
    userId,
    intent
  );
  if (!sent) return;
  // Consent counts as "notified" only if the notice was actually delivered.
  if (firstContact && userId) await markConsentNotified(userId);
  await logMessage(userId, 'out', {
    kind: 'text',
    text: finalText,
    intent,
  });
}
