/**
 * The message pipeline: normalize (ASR for voice) → route → farm card or
 * reason → compliance gate → persist → reply. Transport-agnostic; the webhook
 * hands it an adapter.
 */

import type { TransportAdapter, InboundMessage } from './transport/types';
import { routeIntent, type Intent } from './router';
import { reason } from './reason';
import { buildFarmCard, isFarmConfirmYes } from './farmcard';
import { buildAgronomoBrief } from './brief';
import { handleProspectInbound, respondAsProspectAgent } from './prospect/inbound';
import { normalizePhoneBR } from './prospect/core';
import {
  findPartnerByPhone,
  buildDossierReply,
  matchPartnerForFarm,
  setReferralPartner,
  consentAskText,
  resolveConsentReply,
} from './partners';
import { parseVcards, describeContactCards } from './transport/vcard';
import { transcribeVoice } from './transcribe';
import { checkOutbound } from './compliance';
import { describeImage, type ChatImage } from './llm';
import {
  upsertUser,
  setUserSource,
  setUserState,
  setFarmLocation,
  markReferralPrompted,
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
  getRecentTurns,
  insertApplication,
  listApplications,
} from './db';
import {
  isApplicationLog,
  isApplicationReportRequest,
  parseApplication,
  formatApplicationConfirm,
} from './tools/applicationParse';
import {
  buildApplicationsReport,
  applicationsCaption,
  applicationsEmptyReply,
  applicationsTextSummary,
} from './cards/applications';
import { reportCardParams } from './reportToken';
import { isLocationSettingRequest, resolveStatedLocation, confirmLocationReply } from './location';
import { formatTurnsBlock } from './memory';
import { buildHistoryReply } from './caderno';
import { fetchPrices, formatPricesReply, askedCommodities } from './tools/prices';
import { parseCrops, joinCrops, isCropsOnlyMessage } from './tools/crops';
import { parseSourceToken, shouldPromptReferral, referralNudge } from './growth';
import type { CommodityQuote } from './tools/prices';
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

// Deletion request — covers "apaga meus dados" plus the phrasings the security
// review flagged as missed ("quero ser esquecido", "cancela meu cadastro",
// account variants). Deliberately requires dados/conta/cadastro or the
// esquecido idiom so "como apago a ferrugem" can't wipe an account.
const LGPD_DELETE =
  /\b(apag|exclu|delet|cancel)\w*\s+(meus?\s+dados|minha\s+conta|meu\s+cadastro)\b|\bquero\s+ser\s+esquecid[oa]\b/i;

/** Whether a message is an LGPD account-deletion request. */
export function isDeletionRequest(text: string): boolean {
  return LGPD_DELETE.test(text);
}
const CONSENT_NOTE =
  '\n\n_Pra te dar conselhos melhores eu guardo sua localização e o histórico da conversa. É só o necessário, e você pode pedir "apaga meus dados" quando quiser. Mais tarde posso te conectar com um agrônomo de verdade se precisar._';

// Exported for the canary: an elevated rate of this exact reply is the
// signature of a dead model slug / provider outage.
export const FALLBACK_REPLY =
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
// "a gente" conjugates third-singular, so conversou/falou must pair with
// conversamos/falamos — the golden baseline caught 'o que a gente já
// conversou?' falling through to the LLM router.
const HISTORY_INTENT =
  /\b(meu|nosso)\s+(hist[óo]rico|caderno)\b|\bo\s+que\s+(a\s+gente\s+|n[óo]s\s+)?(j[áa]\s+)?(convers(amos|ou)|fal(amos|ou))\b/i;

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

// A negated crop mention while we await the crop answer ("não planto soja,
// parei ano passado") must never be captured as the farm's crop.
const CROP_NEGATION = /\b(n[ãa]o|nunca|parei|deixei|larguei)\b/i;

const REFERRAL_REPLY =
  'Boa! 🙌 Anotei seu interesse em falar com um agrônomo — e não passo seus dados pra ninguém sem te perguntar antes.\n\n' +
  'Pra adiantar, leve pro agrônomo: fotos da lavoura, a cultura e a fase, e o que você observou (onde começou, como espalhou). Ele faz o diagnóstico e, se precisar, o receituário — o documento técnico que define o produto e a dose certos.\n\n' +
  'Dica: agrônomo tem registro no CREA do seu estado, e cooperativa/revenda geralmente tem um técnico responsável. Assim que a nossa rede de agrônomos parceiros estiver pronta, eu te conecto direto por aqui. 👊';

function isFirstContact(user: { consent_lgpd_at: string | null } | null): boolean {
  return !!user && user.consent_lgpd_at == null;
}

// Where the public card images are served from (WhatsApp fetches these).
const PUBLIC_BASE = process.env.PUBLIC_BASE_URL || 'https://roca-black.vercel.app';

// Honest redirect when a farmer asks for the "receituário": we don't write it
// (the agrônomo signs it), we build the record they take to him.
const RECEITUARIO_NOTE =
  'O receituário quem assina é o engenheiro agrônomo — é ele que define produto e dose, com responsabilidade técnica. O que eu monto é o seu *caderno de aplicações*: o registro do que você já aplicou, pra levar pra ele. 👇';

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
      // A city-precision location is a municipal centroid, not the talhão — the
      // reply already asks for the pin; never attach an NDVI card of the town.
      if (farm && farm.precision === 'city') return undefined;
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

/** Public URL for the price card — quotes packed into the query string so the
 * card endpoint re-renders without re-fetching Yahoo. Exported for tests. */
export function priceCardUrl(quotes: CommodityQuote[], usdBrl: number | null): string | undefined {
  if (!quotes.length) return undefined;
  const q = quotes
    .slice(0, 3)
    .map((c) => `${c.key}:${c.sacaBrl.toFixed(2)}:${c.weekChangePct?.toFixed(1) ?? ''}`)
    .join('|');
  const params = new URLSearchParams({ type: 'prices', q });
  if (usdBrl != null) params.set('usd', usdBrl.toFixed(2));
  return `${PUBLIC_BASE}/api/card?${params.toString()}`;
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
    case 'application_log':
      // Just logged an application → offer the report and the pro handoff.
      // Titles are real queries: "Minhas aplicações" routes to application_report.
      return ['Minhas aplicações', 'Quero um agrônomo'];
    case 'application_report':
      return ['Quero um agrônomo'];
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
  out: {
    text: string;
    buttons?: string[];
    mediaUrl?: string;
    mediaType?: 'image' | 'document';
    filename?: string;
  },
  userId: string | null,
  intent: string
): Promise<boolean> {
  try {
    await withRetry(() =>
      adapter.send({
        to,
        text: out.text,
        buttons: out.buttons,
        mediaUrl: out.mediaUrl,
        mediaType: out.mediaType,
        filename: out.filename,
      })
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
  if (msg.text && isDeletionRequest(msg.text)) {
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

  // Partner replies (agronomists in the referral network): their reply opens
  // the 24h window → deliver any pending lead dossier free-form. Partners
  // never reach the farmer pipeline (and never get a farmer profile).
  {
    const partnerPhone = normalizePhoneBR(msg.from);
    const partner = partnerPhone ? await findPartnerByPhone(partnerPhone) : null;
    if (partner) {
      const dossier = await buildDossierReply(partner);
      if (dossier) {
        await sendOrRecord(adapter, msg.from, { text: dossier }, null, 'partner_dossier');
        await alertFounders(`🤝 Dossiê de lead entregue pro parceiro ${partner.name}. Acompanhe o fechamento!`);
      } else {
        // No pending lead — this is relationship talk; a human answers it.
        await alertFounders(
          `💬 Parceiro ${partner.name} mandou mensagem (responda você): "${(msg.text ?? '(mídia)').slice(0, 150)}"`
        );
      }
      return;
    }
  }

  const user = await upsertUser(msg.from, msg.profileName);
  if (!user) {
    // DB unhealthy: without a user row there is no rate limit and no memory —
    // running the LLM path anyway would be an unmetered cost/abuse hole. Fail
    // closed with the human apology instead. Still claim by provider id
    // (user_id null) so a provider redelivery doesn't buy a second apology.
    const claimed = await claimInbound(null, {
      kind: msg.kind,
      text: msg.text,
      messageId: msg.messageId,
    });
    if (!claimed) {
      log.info('duplicate inbound on the fail-closed path — dropped:', msg.messageId);
      return;
    }
    log.error('upsertUser unavailable — failing closed, no LLM work');
    try {
      await withRetry(() => adapter.send({ to: msg.from, text: FALLBACK_REPLY }));
    } catch (e) {
      log.error('fail-closed notice send failed:', (e as Error).message);
    }
    return;
  }
  const userId = user.id;
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

  // Acquisition attribution: a vouched farmer's first message carries who sent
  // them ("Oi! Vim pelo José" / #tec-jose). First-wins at the DB layer — the
  // vouchado/orgânico cohort split is the flight plan's gate metric.
  if (firstContact && msg.text) {
    const src = parseSourceToken(msg.text);
    if (src) await setUserSource(userId, src);
  }

  // Prospect replies: honour an opt-out ("sair") immediately and permanently
  // before any other handling. A non-opt-out prospect reply is routed to the
  // partnerships conversation agent after media normalization (below).
  const pr = await handleProspectInbound(msg.from, msg.text ?? null);
  if (pr.handled && pr.reply) {
    await sendOrRecord(adapter, msg.from, { text: pr.reply }, userId, 'prospect_optout');
    if (userId) await logMessage(userId, 'out', { kind: 'text', text: pr.reply, intent: 'prospect_optout' });
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
  // Size cap before any LLM work: an oversized payload is a cost-abuse vector
  // (each image feeds two reasoning-tier vision calls) and breaks model input
  // limits anyway. ~8 MB binary ≈ 11 MB base64.
  const MEDIA_BASE64_CAP = 11_000_000;
  let media: ChatImage | null = null;
  let transcript: string | null = null;
  let contactText: string | null = null;
  let mediaTooLarge = false;
  if (msg.mediaUrl && adapter.fetchMedia) {
    try {
      const fetched = await adapter.fetchMedia(msg.mediaUrl);
      if (fetched.base64.length > MEDIA_BASE64_CAP) {
        log.error(`media over cap (${fetched.base64.length} b64 chars) — skipped`);
        mediaTooLarge = true;
      } else if (fetched.mime.includes('vcard')) {
        // Shared contact card (Twilio delivers vCards as media).
        contactText = describeContactCards(
          parseVcards(Buffer.from(fetched.base64, 'base64').toString('utf8'))
        );
      } else if (msg.kind === 'image') {
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

  // Prospect conversation agent: a reply from a cold-messaged business talks to
  // the partnerships persona, not farmer-Stevi. Media is normalized to text
  // first (voice transcript, vision description, vCard summary).
  if (pr.prospect) {
    let inboundText = effective.text ?? '';
    let inboundKind = 'text';
    if (contactText) {
      inboundText = [inboundText, contactText].filter(Boolean).join('\n');
      inboundKind = 'contact';
    } else if (msg.kind === 'voice' && transcript) {
      inboundKind = 'voice';
    } else if (msg.kind === 'image' && media) {
      inboundKind = 'image';
      try {
        const caption = await describeImage(media);
        inboundText = [inboundText, `[imagem enviada: ${caption}]`].filter(Boolean).join('\n');
      } catch (e) {
        log.error('prospect image description failed:', (e as Error).message);
        inboundText = [inboundText, '[imagem enviada — não consegui processar]'].filter(Boolean).join('\n');
      }
    }
    if (!inboundText) inboundText = '[mensagem sem texto legível]';

    const agentReply = await respondAsProspectAgent(pr.prospect, inboundText, inboundKind);
    if (agentReply) {
      await sendOrRecord(adapter, msg.from, { text: agentReply }, userId, 'prospect_agent');
    }
    return; // prospects never fall through to the farmer pipeline
  }

  let intent: Intent;
  let replyText: string;
  let pestCard: PestCardData | undefined;
  // Set by branches that carry their own visual (prices) — pest keeps its
  // dedicated path below.
  let extraCardUrl: string | undefined;
  // The applications report as a PDF, delivered as a second message
  // (save/print/forward) after the in-chat PNG card.
  let extraDocUrl: string | undefined;
  // Set when a branch must NOT ship the generic card (e.g. a pin we couldn't
  // confirm as a field — the honest text must not carry a "SUA LAVOURA" image).
  let suppressCard = false;

  // If we asked what they grow (right after the farm card) and they replied with
  // recognizable crops, capture them. Only a crops-ONLY reply gets the capture
  // confirmation; a question that merely names a crop ("posso pulverizar na
  // soja?") is captured silently and routes normally — never swallowed. A
  // negated mention ("não planto soja, parei") is never captured — the model
  // handles it. A no-crop reply clears the wait and falls through.
  const cropAnswer =
    user?.awaiting === 'crop' &&
    effective.kind === 'text' &&
    effective.text &&
    !CROP_NEGATION.test(effective.text)
      ? parseCrops(effective.text)
      : null;
  const cropsOnly =
    !!cropAnswer && cropAnswer.length > 0 && !!effective.text && isCropsOnlyMessage(effective.text);
  if (cropAnswer && cropAnswer.length > 0 && !cropsOnly && userId) {
    await setFarmCrops(userId, cropAnswer);
    await setAwaiting(userId, null);
  }

  // Pending share-consent question (partner handoff): a clear yes/no resolves
  // it; anything else falls through to normal handling and the question stays
  // open until answered or superseded by another intent.
  const consentReply =
    user?.awaiting === 'referral_consent' && effective.kind === 'text' && effective.text && userId
      ? await resolveConsentReply(userId, effective.text)
      : null;

  // "É aí mesmo" — the farmer affirming that a bare pin we couldn't confirm IS
  // their field (pousio / recém-colhida). Checked before the location resolve so
  // an affirmation never spends an LLM extract.
  const confirmYes =
    user?.awaiting === 'farm_confirm' &&
    effective.kind === 'text' &&
    !!effective.text &&
    isFarmConfirmYes(effective.text);

  // Stated location: "minha lavoura fica em X" / "sou de X", or any redirect
  // while awaiting the farmer to fix a bad pin. Geocodes to a coarse city
  // centroid. The LLM extract only runs on an explicit location statement or a
  // farm_confirm redirect — never on a plain confirm or an ordinary message.
  const statedLocation =
    !confirmYes &&
    effective.kind === 'text' &&
    !!effective.text &&
    !!userId &&
    (isLocationSettingRequest(effective.text) || user?.awaiting === 'farm_confirm')
      ? await resolveStatedLocation(effective.text)
      : null;

  if (cropAnswer && cropAnswer.length > 0 && cropsOnly) {
    if (userId) {
      await setFarmCrops(userId, cropAnswer);
      await setAwaiting(userId, null);
    }
    intent = 'onboarding';
    replyText = `Anotado: você trabalha com ${joinCrops(cropAnswer)}. 🌱 Agora que sei sua cultura, meus conselhos ficam mais no ponto. Manda foto de praga, pergunta "posso pulverizar hoje?", ou o que precisar.`;
  } else if (consentReply) {
    intent = 'referral';
    if (userId) await setAwaiting(userId, null);
    replyText = consentReply;
  } else if (confirmYes) {
    // Farmer confirmed the bare pin IS their field (pousio / recém-colhida) →
    // keep the stored location and move on to the crop question.
    intent = 'onboarding';
    if (userId) await setAwaiting(userId, 'crop');
    replyText =
      'Beleza, mantive sua localização então. 🌱 Me conta: o que você planta aí? Soja, milho, café, pasto?';
  } else if (statedLocation?.kind === 'resolved' && userId) {
    // Farmer named where the field is → store a coarse city reference and invite
    // the pin to refine. Decouples "onde você está" from "onde é a lavoura".
    intent = 'onboarding';
    await setFarmLocation(userId, statedLocation.lat, statedLocation.lon, 'city');
    if (statedLocation.uf) await setUserState(userId, statedLocation.uf);
    await setAwaiting(userId, 'crop');
    replyText = confirmLocationReply(statedLocation);
  } else if (statedLocation?.kind === 'ungeocodable' && userId) {
    // Named a place we couldn't locate → ask for city+UF or the pin. A message
    // that named NO place ('no_place') falls through instead — no false "não achei".
    intent = 'onboarding';
    if (user?.awaiting) await setAwaiting(userId, null);
    replyText =
      `Hmm, não consegui achar "${statedLocation.city.slice(0, 40)}" no mapa 🤔. Me diz a cidade e o estado da sua lavoura (ex: "Patrocínio-MG"), ou manda o pin (clipe 📎 → Localização).`;
  } else if (effective.kind === 'text' && effective.text && isApplicationReportRequest(effective.text)) {
    // Caderno de aplicações report (rastreabilidade). Checked BEFORE the history
    // fast-path, since "meu caderno de aplicações" also matches isHistoryRequest.
    // The dose/brand live in the rendered card (gate never sees it); the caption
    // and any text fallback are gate-safe.
    intent = 'application_report';
    if (userId && user?.awaiting) await setAwaiting(userId, null);
    const rows = userId ? await listApplications(userId, { limit: 200 }) : [];
    const receituarioPrefix = /receitu/i.test(effective.text) ? `${RECEITUARIO_NOTE}\n\n` : '';
    if (rows.length === 0) {
      replyText = receituarioPrefix + applicationsEmptyReply();
    } else {
      const params = userId ? reportCardParams(userId) : null;
      if (params) {
        replyText = receituarioPrefix + applicationsCaption(rows.length);
        extraCardUrl = `${PUBLIC_BASE}/api/card?${params}`;
        extraDocUrl = `${PUBLIC_BASE}/api/report?${params}`;
      } else {
        // No URL-signing secret configured → gate-safe text summary rather than
        // shipping the farmer's chemical history through an unsigned public URL.
        const profile = userId ? await getFarmProfile(userId) : { uf: null, crop: null };
        replyText = receituarioPrefix + applicationsTextSummary(buildApplicationsReport(profile, rows));
      }
    }
  } else if (effective.kind === 'text' && effective.text && isHistoryRequest(effective.text)) {
    // Passive caderno de campo — the season record Stevi keeps for free.
    intent = 'history';
    if (userId && user?.awaiting) await setAwaiting(userId, null);
    replyText = userId
      ? buildHistoryReply(await getFarmProfile(userId), await getActivityLog(userId))
      : buildHistoryReply({ uf: null, crop: null }, []);
  } else if (effective.kind === 'text' && effective.text && isApplicationLog(effective.text)) {
    // Caderno de aplicações — the farmer declaring an application they already
    // made ("apliquei X ontem"). Record it (their own data, never a
    // prescription) and read the parsed record back so they can correct it.
    // The confirm keeps the numeric dose out of its text so it clears the
    // compliance gate; the full dose lives in the record + rendered report.
    intent = 'application_log';
    if (userId && user?.awaiting) await setAwaiting(userId, null);
    const profile = userId ? await getFarmProfile(userId) : { uf: null, crop: null };
    const app = await parseApplication(effective.text, {
      source: msg.kind === 'voice' ? 'declared_voice' : 'declared_text',
      knownCrops: profile.crop,
    });
    if (userId) {
      const farm = await getFarm(userId);
      await insertApplication(userId, app, farm?.id ?? null);
    }
    replyText = formatApplicationConfirm(app);
  } else if (effective.kind === 'text' && effective.text && isPriceRequest(effective.text)) {
    // Commodity quotes — the price habit loop. Crop-filtered when known.
    intent = 'prices';
    if (userId && user?.awaiting) await setAwaiting(userId, null);
    // An explicitly named commodity beats the profile filter.
    const asked = askedCommodities(effective.text);
    const profile = userId ? await getFarmProfile(userId) : { uf: null, crop: null };
    const { quotes, usdBrl } = await fetchPrices(asked.length > 0 ? asked : profile.crop);
    replyText = formatPricesReply(quotes, usdBrl);
    // The shareable card — prices are the most-forwarded content in rural
    // groups, so the reply ships as an image farmers can pass on.
    extraCardUrl = priceCardUrl(quotes, usdBrl);
  } else if (effective.kind === 'text' && effective.text && isBriefRequest(effective.text)) {
    // Assemble the agrônomo briefing from the farmer's profile + recent messages.
    intent = 'brief';
    if (userId && user?.awaiting) await setAwaiting(userId, null);
    replyText = await buildAgronomoBrief(userId);
  } else if (effective.kind === 'text' && effective.text && isReferralRequest(effective.text)) {
    // Explicit agrônomo referral request — the business-model seed.
    intent = 'referral';
    replyText = REFERRAL_REPLY;
    if (userId) {
      if (user?.awaiting) await setAwaiting(userId, null);
      const profile = await getFarmProfile(userId);
      // Checked BEFORE inserting the new row: repeat taps within 24h stay
      // quiet on founder channels (the row below is still recorded for audit).
      const alreadyNotified = await hasRecentReferral(
        userId,
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      );
      const referralId = await createReferralRequest(userId, {
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
      // Partner match (farm pin within a partner's coverage): instead of the
      // generic promise, ask the farmer's explicit consent to share — LGPD:
      // the referral opt-in alone never hands data to a third party.
      try {
        const matched = await matchPartnerForFarm(userId);
        if (matched && referralId) {
          await setReferralPartner(referralId, matched.id);
          await setAwaiting(userId, 'referral_consent');
          replyText = consentAskText(matched);
        }
      } catch (e) {
        log.error('partner match failed (generic referral reply kept):', (e as Error).message);
      }
    }
  } else if (mediaTooLarge) {
    intent = 'general';
    replyText =
      'Opa, esse arquivo veio grande demais pra eu processar. 😅 Manda de novo como foto normal (sem ser em qualidade máxima/documento) que eu dou conta.';
  } else if (msg.kind === 'voice' && !transcript) {
    intent = 'general';
    replyText =
      'Recebi seu áudio mas não consegui entender direito. 🙉 Pode escrever em texto, ou mandar o áudio de novo mais pertinho do celular?';
  } else if (effective.kind === 'location' && effective.location) {
    // Pin drop → the payback moment, or an honest "não achei vegetação aí" when
    // the pin isn't a field. buildFarmCard sets `awaiting` itself ('crop', or
    // 'farm_confirm' when it needs the farmer to confirm or redirect the pin).
    intent = 'onboarding';
    const fc = await buildFarmCard(userId, effective.location.lat, effective.location.lon);
    replyText = fc.text;
    // No vegetation → the reply is an honest question; never attach a "SUA
    // LAVOURA" card over a rooftop/water.
    suppressCard = !fc.card;
  } else {
    // A pending crop/confirm question that got an unrelated reply: stop waiting,
    // answer normally (don't leave the farmer stuck in an onboarding state).
    if ((user?.awaiting === 'crop' || user?.awaiting === 'farm_confirm') && userId) {
      await setAwaiting(userId, null);
    }
    // kind guard matters: a photo with a "como está minha lavoura?" caption is
    // a pest-triage image, not a satellite ask — captions never fast-path.
    intent =
      effective.kind === 'text' && effective.text && isFieldHealthRequest(effective.text)
        ? 'field_health'
        : await routeIntent(effective);
    try {
      // Working memory: the last few turns, so follow-ups ("e o que eu
      // faço?") resolve their referent. Fail-soft — no memory beats no reply.
      const history =
        userId && effective.kind === 'text'
          ? formatTurnsBlock(await getRecentTurns(userId, msg.messageId))
          : null;
      replyText = await reason(effective, intent, {
        userId,
        media,
        history,
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

  // A gate-replaced reply never ships its visual — the pest card carries the
  // exact product/group data the gate just blocked. `suppressCard` blocks the
  // generic card when the text is an honest "isso não parece uma lavoura" hold.
  const mediaUrl =
    !gate.safe || suppressCard
      ? undefined
      : pestCard
        ? pestCardUrl(pestCard)
        : (extraCardUrl ?? (await cardUrlFor(intent, effective, userId)));

  // Referral nudge after a DELIVERED victory moment (visual verdict in hand):
  // the produtor→produtor chain the flight plan watches for. The link is
  // pre-filled with this farmer's name, so the next farmer arrives already
  // attributed. Sparing: ≥14d cooldown, never first contact, never gated.
  const nudge = shouldPromptReferral(
    {
      intent,
      hasVisual: !!mediaUrl,
      firstContact,
      gateSafe: gate.safe,
      lastPromptedAt: user.referral_prompted_at ?? null,
    },
    new Date()
  );
  if (nudge) finalText += referralNudge(user.name);

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
  if (nudge) await markReferralPrompted(userId);
  await logMessage(userId, 'out', {
    kind: 'text',
    text: finalText,
    intent,
  });

  // Second message: the same report as a PDF document, to save/print/forward.
  // Only after the caption shipped safely and a signed PDF URL was built. The
  // caption text is gate-safe; the record's dose/brand live inside the PDF.
  if (extraDocUrl && gate.safe) {
    await sendOrRecord(
      adapter,
      msg.from,
      {
        text: 'Segue também em PDF, pra guardar ou imprimir. 📎',
        mediaUrl: extraDocUrl,
        mediaType: 'document',
        filename: 'caderno-de-aplicacoes.pdf',
      },
      userId,
      'application_report_pdf'
    );
  }
}
