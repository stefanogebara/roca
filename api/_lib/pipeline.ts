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
  isFinancingReportRequest,
  parseApplication,
  formatApplicationConfirm,
} from './tools/applicationParse';
import { financingCaption, financingEmptyReply } from './report/financing';
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
    .map(
      (c) =>
        `${c.key}:${c.sacaBrl.toFixed(2)}:${c.weekChangePct?.toFixed(1) ?? ''}:${
          c.series?.map((v) => v.toFixed(1)).join(';') ?? ''
        }`
    )
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
    case 'financing_report':
      // The doc goes to a professional — offer the connection.
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

// --- Route table scaffolding (refactor 2026-07-16-handleinbound-refactor) ---
// The intent ladder is being extracted into an ordered list of routes. T1 lands
// the shared types + context builder; the branch bodies move into routes in T2.

type PipelineUser = NonNullable<Awaited<ReturnType<typeof upsertUser>>>;
type StatedLocation = Awaited<ReturnType<typeof resolveStatedLocation>>;

/**
 * Everything a route needs to decide and handle a message, built once after the
 * pre-route guards (LGPD/partner/fail-closed/idempotency/prospect/rate-limit)
 * and media normalization have run. The onboarding signals (crop/consent/
 * confirm/statedLocation) are precomputed here — eagerly and in the same order
 * as before — so a route's `match` predicate stays pure and cheap.
 */
interface RouteContext {
  adapter: TransportAdapter;
  msg: InboundMessage;
  /** Voice→text normalized message (transcript folded in when present). */
  effective: InboundMessage;
  user: PipelineUser;
  userId: string;
  firstContact: boolean;
  media: ChatImage | null;
  transcript: string | null;
  contactText: string | null;
  mediaTooLarge: boolean;
  // Onboarding precomputes (may fire side effects — see buildRouteContext).
  cropAnswer: string[] | null;
  cropsOnly: boolean;
  consentReply: string | null;
  confirmYes: boolean;
  statedLocation: StatedLocation | null;
}

/** The 8 outputs an intent branch produces — replaces the mutable accumulators. */
interface RouteResult {
  intent: Intent;
  replyText: string;
  pestCard?: PestCardData;
  extraCardUrl?: string;
  extraDocUrl?: string;
  extraDocCaption?: string;
  extraDocFilename?: string;
  suppressCard?: boolean;
}

/**
 * A route handler's output: everything in RouteResult EXCEPT the intent, which
 * the route declares statically (Route.intent) and the dispatcher stamps on.
 * This keeps the fast-path intent taxonomy in one place per route.
 */
type RouteOutput = Omit<RouteResult, 'intent'>;

/**
 * One intent branch. `match` is a pure, I/O-free predicate over the context;
 * `handle` produces the reply. ROUTES order is priority (overlapping fast-path
 * regexes make ordering load-bearing).
 */
interface Route {
  name: string;
  /** The (fixed) intent every match of this route emits — the single place it's declared. */
  intent: Intent;
  match: (ctx: RouteContext) => boolean;
  handle: (ctx: RouteContext) => Promise<RouteOutput>;
}

/** The pre-route-guard survivors, before the onboarding signals are computed. */
type RouteContextBase = Omit<
  RouteContext,
  'cropAnswer' | 'cropsOnly' | 'consentReply' | 'confirmYes' | 'statedLocation'
>;

/**
 * Build the route context from the guard survivors: compute the onboarding
 * signals eagerly, in the exact order and under the exact conditions the inline
 * precompute used. Preserves the one side effect here — a crop answer that ALSO
 * carries a question ("posso pulverizar na soja?") is captured silently, so the
 * message can still route normally instead of being swallowed by onboarding.
 */
async function buildRouteContext(base: RouteContextBase): Promise<RouteContext> {
  const { effective, user, userId } = base;

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

  const consentReply =
    user?.awaiting === 'referral_consent' && effective.kind === 'text' && effective.text && userId
      ? await resolveConsentReply(userId, effective.text)
      : null;

  const confirmYes =
    user?.awaiting === 'farm_confirm' &&
    effective.kind === 'text' &&
    !!effective.text &&
    isFarmConfirmYes(effective.text);

  const statedLocation =
    !confirmYes &&
    effective.kind === 'text' &&
    !!effective.text &&
    !!userId &&
    (isLocationSettingRequest(effective.text) || user?.awaiting === 'farm_confirm')
      ? await resolveStatedLocation(effective.text)
      : null;

  return { ...base, cropAnswer, cropsOnly, consentReply, confirmYes, statedLocation };
}

// --- The route table -------------------------------------------------------
// Each route is an intent branch lifted verbatim from the old ladder. ORDER IS
// PRIORITY: ROUTES is scanned top-to-bottom and the first match wins, which
// preserves the load-bearing precedence the fast-path regexes rely on
// (financing before application_report before history — overlapping patterns).
// A route's `match` is a pure, I/O-free predicate; `handle` does the work and
// returns the reply. The trailing `else` (field_health | routeIntent → reason)
// is reasonFallback, run when nothing matches.

const cropsOnlyRoute: Route = {
  name: 'cropsOnly',
  intent: 'onboarding',
  match: (ctx) => !!ctx.cropAnswer && ctx.cropAnswer.length > 0 && ctx.cropsOnly,
  handle: async (ctx) => {
    const { userId, cropAnswer } = ctx;
    if (userId) {
      await setFarmCrops(userId, cropAnswer!);
      await setAwaiting(userId, null);
    }
    return {
      replyText: `Anotado: você trabalha com ${joinCrops(cropAnswer!)}. 🌱 Agora que sei sua cultura, meus conselhos ficam mais no ponto. Manda foto de praga, pergunta "posso pulverizar hoje?", ou o que precisar.`,
    };
  },
};

const consentRoute: Route = {
  name: 'consent',
  intent: 'referral',
  match: (ctx) => !!ctx.consentReply,
  handle: async (ctx) => {
    const { userId, consentReply } = ctx;
    if (userId) await setAwaiting(userId, null);
    return { replyText: consentReply! };
  },
};

const confirmYesRoute: Route = {
  name: 'confirmYes',
  intent: 'onboarding',
  match: (ctx) => ctx.confirmYes,
  handle: async (ctx) => {
    // Farmer confirmed the bare pin IS their field (pousio / recém-colhida) →
    // keep the stored location and move on to the crop question.
    const { userId } = ctx;
    if (userId) await setAwaiting(userId, 'crop');
    return {
      replyText:
        'Beleza, mantive sua localização então. 🌱 Me conta: o que você planta aí? Soja, milho, café, pasto?',
    };
  },
};

const statedLocationResolvedRoute: Route = {
  name: 'statedLocationResolved',
  intent: 'onboarding',
  match: (ctx) => ctx.statedLocation?.kind === 'resolved' && !!ctx.userId,
  handle: async (ctx) => {
    // Farmer named where the field is → store a coarse city reference and invite
    // the pin to refine. Decouples "onde você está" from "onde é a lavoura".
    const { userId } = ctx;
    const sl = ctx.statedLocation as Extract<StatedLocation, { kind: 'resolved' }>;
    await setFarmLocation(userId, sl.lat, sl.lon, 'city');
    if (sl.uf) await setUserState(userId, sl.uf);
    await setAwaiting(userId, 'crop');
    return { replyText: confirmLocationReply(sl) };
  },
};

const statedLocationUngeocodableRoute: Route = {
  name: 'statedLocationUngeocodable',
  intent: 'onboarding',
  match: (ctx) => ctx.statedLocation?.kind === 'ungeocodable' && !!ctx.userId,
  handle: async (ctx) => {
    // Named a place we couldn't locate → ask for city+UF or the pin. A message
    // that named NO place ('no_place') falls through instead — no false "não achei".
    const { userId, user } = ctx;
    const sl = ctx.statedLocation as Extract<StatedLocation, { kind: 'ungeocodable' }>;
    if (user?.awaiting) await setAwaiting(userId, null);
    return {
      replyText: `Hmm, não consegui achar "${sl.city.slice(0, 40)}" no mapa 🤔. Me diz a cidade e o estado da sua lavoura (ex: "Patrocínio-MG"), ou manda o pin (clipe 📎 → Localização).`,
    };
  },
};

const financingReportRoute: Route = {
  name: 'financingReport',
  intent: 'financing_report',
  // Histórico de manejo — the crédito-rural/PRONAF SUPPORT report. Checked
  // BEFORE application_report so "relatório de aplicações pro banco" lands here.
  // A record, never the application: the projeto técnico (ART), the DAP/CAF, the
  // CAR and the credit analysis stay with the professionals — caption says so.
  match: (ctx) => ctx.effective.kind === 'text' && !!ctx.effective.text && isFinancingReportRequest(ctx.effective.text),
  handle: async (ctx) => {
    const { userId, user } = ctx;
    if (userId && user?.awaiting) await setAwaiting(userId, null);
    const finRows = userId ? await listApplications(userId, { limit: 200 }) : [];
    if (finRows.length === 0) {
      return { replyText: financingEmptyReply() };
    }
    const finParams = userId ? reportCardParams(userId) : null;
    if (finParams) {
      return {
        replyText: financingCaption(finRows.length),
        extraDocUrl: `${PUBLIC_BASE}/api/report?${finParams}&kind=pronaf`,
        extraDocCaption:
          'Segue o *histórico de manejo* em PDF — leve ao seu agrônomo, cooperativa ou banco junto com seus documentos. 📎',
        extraDocFilename: 'historico-manejo-pronaf.pdf',
      };
    }
    // No URL-signing secret → gate-safe text: honest framing + aggregate summary,
    // never an unsigned URL to private records.
    const finProfile = userId ? await getFarmProfile(userId) : { uf: null, crop: null };
    return {
      replyText:
        financingCaption(finRows.length) +
        '\n\n' +
        applicationsTextSummary(buildApplicationsReport(finProfile, finRows)),
    };
  },
};

const applicationReportRoute: Route = {
  name: 'applicationReport',
  intent: 'application_report',
  // Caderno de aplicações report (rastreabilidade). Checked BEFORE the history
  // fast-path, since "meu caderno de aplicações" also matches isHistoryRequest.
  // The dose/brand live in the rendered card (gate never sees it); the caption
  // and any text fallback are gate-safe.
  match: (ctx) => ctx.effective.kind === 'text' && !!ctx.effective.text && isApplicationReportRequest(ctx.effective.text),
  handle: async (ctx) => {
    const { userId, user, effective } = ctx;
    if (userId && user?.awaiting) await setAwaiting(userId, null);
    const rows = userId ? await listApplications(userId, { limit: 200 }) : [];
    const receituarioPrefix = /receitu/i.test(effective.text!) ? `${RECEITUARIO_NOTE}\n\n` : '';
    if (rows.length === 0) {
      return { replyText: receituarioPrefix + applicationsEmptyReply() };
    }
    const params = userId ? reportCardParams(userId) : null;
    if (params) {
      return {
        replyText: receituarioPrefix + applicationsCaption(rows.length),
        extraCardUrl: `${PUBLIC_BASE}/api/card?${params}`,
        extraDocUrl: `${PUBLIC_BASE}/api/report?${params}`,
      };
    }
    // No URL-signing secret configured → gate-safe text summary rather than
    // shipping the farmer's chemical history through an unsigned public URL.
    const profile = userId ? await getFarmProfile(userId) : { uf: null, crop: null };
    return {
      replyText: receituarioPrefix + applicationsTextSummary(buildApplicationsReport(profile, rows)),
    };
  },
};

const historyRoute: Route = {
  name: 'history',
  intent: 'history',
  // Passive caderno de campo — the season record Stevi keeps for free.
  match: (ctx) => ctx.effective.kind === 'text' && !!ctx.effective.text && isHistoryRequest(ctx.effective.text),
  handle: async (ctx) => {
    const { userId, user } = ctx;
    if (userId && user?.awaiting) await setAwaiting(userId, null);
    const replyText = userId
      ? buildHistoryReply(await getFarmProfile(userId), await getActivityLog(userId))
      : buildHistoryReply({ uf: null, crop: null }, []);
    return { replyText };
  },
};

const applicationLogRoute: Route = {
  name: 'applicationLog',
  intent: 'application_log',
  // Caderno de aplicações — the farmer declaring an application already made
  // ("apliquei X ontem"). Record it (their own data, never a prescription) and
  // read the parsed record back. The confirm keeps the numeric dose out of its
  // text so it clears the compliance gate; the dose lives in the record + report.
  match: (ctx) => ctx.effective.kind === 'text' && !!ctx.effective.text && isApplicationLog(ctx.effective.text),
  handle: async (ctx) => {
    const { userId, user, effective, msg } = ctx;
    if (userId && user?.awaiting) await setAwaiting(userId, null);
    const profile = userId ? await getFarmProfile(userId) : { uf: null, crop: null };
    const app = await parseApplication(effective.text!, {
      source: msg.kind === 'voice' ? 'declared_voice' : 'declared_text',
      knownCrops: profile.crop,
    });
    if (userId) {
      const farm = await getFarm(userId);
      await insertApplication(userId, app, farm?.id ?? null);
    }
    return { replyText: formatApplicationConfirm(app) };
  },
};

const pricesRoute: Route = {
  name: 'prices',
  intent: 'prices',
  // Commodity quotes — the price habit loop. Crop-filtered when known.
  match: (ctx) => ctx.effective.kind === 'text' && !!ctx.effective.text && isPriceRequest(ctx.effective.text),
  handle: async (ctx) => {
    const { userId, user, effective } = ctx;
    if (userId && user?.awaiting) await setAwaiting(userId, null);
    // An explicitly named commodity beats the profile filter.
    const asked = askedCommodities(effective.text!);
    const profile = userId ? await getFarmProfile(userId) : { uf: null, crop: null };
    const { quotes, usdBrl } = await fetchPrices(asked.length > 0 ? asked : profile.crop);
    return {
      replyText: formatPricesReply(quotes, usdBrl),
      // The shareable card — prices are the most-forwarded content in rural
      // groups, so the reply ships as an image farmers can pass on.
      extraCardUrl: priceCardUrl(quotes, usdBrl),
    };
  },
};

const briefRoute: Route = {
  name: 'brief',
  intent: 'brief',
  // Assemble the agrônomo briefing from the farmer's profile + recent messages.
  match: (ctx) => ctx.effective.kind === 'text' && !!ctx.effective.text && isBriefRequest(ctx.effective.text),
  handle: async (ctx) => {
    const { userId, user } = ctx;
    if (userId && user?.awaiting) await setAwaiting(userId, null);
    const replyText = await buildAgronomoBrief(userId);
    // Attach the caderno de aplicações PDF so the agrônomo gets the structured
    // spray history alongside the briefing. Only when there's something recorded
    // and the report URL can be signed; otherwise the brief ships text-only.
    let extraDocUrl: string | undefined;
    let extraDocCaption: string | undefined;
    if (userId) {
      const params = reportCardParams(userId);
      if (params && (await listApplications(userId, { limit: 1 })).length > 0) {
        extraDocUrl = `${PUBLIC_BASE}/api/report?${params}`;
        extraDocCaption =
          'Anexei também seu *caderno de aplicações* em PDF — dá pra encaminhar junto pro agrônomo, ele já vê o que foi aplicado. 📎';
      }
    }
    return { replyText, extraDocUrl, extraDocCaption };
  },
};

const referralRoute: Route = {
  name: 'referral',
  intent: 'referral',
  // Explicit agrônomo referral request — the business-model seed.
  match: (ctx) => ctx.effective.kind === 'text' && !!ctx.effective.text && isReferralRequest(ctx.effective.text),
  handle: async (ctx) => {
    const { userId, user, effective, msg, adapter } = ctx;
    let replyText = REFERRAL_REPLY;
    if (userId) {
      if (user?.awaiting) await setAwaiting(userId, null);
      const profile = await getFarmProfile(userId);
      // Checked BEFORE inserting the new row: repeat taps within 24h stay quiet
      // on founder channels (the row below is still recorded for audit).
      const alreadyNotified = await hasRecentReferral(
        userId,
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      );
      const referralId = await createReferralRequest(userId, {
        uf: profile.uf,
        crop: profile.crop,
        topic: effective.text!.slice(0, 280),
        consentVersion: REFERRAL_CONSENT_VERSION,
      });
      if (!alreadyNotified) {
        // Concierge handoff: a human hears about the opt-in immediately —
        // email + WhatsApp ping to the founders' own numbers.
        const notice = {
          maskedPhone: maskWa(msg.from),
          uf: profile.uf,
          crops: profile.crop,
          topic: effective.text!.slice(0, 280),
        };
        await sendReferralNotification(notice);
        await pingFoundersWhatsApp((to, text) => adapter.send({ to, text }), notice);
      }
      // Partner match (farm pin within a partner's coverage): instead of the
      // generic promise, ask the farmer's explicit consent to share — LGPD: the
      // referral opt-in alone never hands data to a third party.
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
    return { replyText };
  },
};

const mediaTooLargeRoute: Route = {
  name: 'mediaTooLarge',
  intent: 'general',
  match: (ctx) => ctx.mediaTooLarge,
  handle: async () => ({
    replyText:
      'Opa, esse arquivo veio grande demais pra eu processar. 😅 Manda de novo como foto normal (sem ser em qualidade máxima/documento) que eu dou conta.',
  }),
};

const voiceNoTranscriptRoute: Route = {
  name: 'voiceNoTranscript',
  intent: 'general',
  match: (ctx) => ctx.msg.kind === 'voice' && !ctx.transcript,
  handle: async () => ({
    replyText:
      'Recebi seu áudio mas não consegui entender direito. 🙉 Pode escrever em texto, ou mandar o áudio de novo mais pertinho do celular?',
  }),
};

const locationPinRoute: Route = {
  name: 'locationPin',
  intent: 'onboarding',
  match: (ctx) => ctx.effective.kind === 'location' && !!ctx.effective.location,
  handle: async (ctx) => {
    // Pin drop → the payback moment, or an honest "não achei vegetação aí" when
    // the pin isn't a field. buildFarmCard sets `awaiting` itself ('crop', or
    // 'farm_confirm' when it needs the farmer to confirm or redirect the pin).
    const { userId, effective } = ctx;
    const fc = await buildFarmCard(userId, effective.location!.lat, effective.location!.lon);
    // No vegetation → the reply is an honest question; never attach a "SUA
    // LAVOURA" card over a rooftop/water.
    return { replyText: fc.text, suppressCard: !fc.card };
  },
};

// Order = priority. Do not reorder without re-checking the overlapping fast-path
// regexes (see the per-route comments; the T0 characterization tests pin it).
// Exported so the intent-taxonomy guard test can assert the routes' declared
// intents stay in sync with router.ts's FASTPATH_INTENTS.
export const ROUTES: Route[] = [
  cropsOnlyRoute,
  consentRoute,
  confirmYesRoute,
  statedLocationResolvedRoute,
  statedLocationUngeocodableRoute,
  financingReportRoute,
  applicationReportRoute,
  historyRoute,
  applicationLogRoute,
  pricesRoute,
  briefRoute,
  referralRoute,
  mediaTooLargeRoute,
  voiceNoTranscriptRoute,
  locationPinRoute,
];

/**
 * The trailing `else` of the old ladder: clear a stuck onboarding wait, pick the
 * intent (field_health fast-path | LLM router), then reason() with working
 * memory. Fail-soft to FALLBACK_REPLY. Captures the pest card via the callback.
 */
async function reasonFallback(ctx: RouteContext): Promise<RouteResult> {
  const { effective, userId, user, msg, media } = ctx;
  // A pending crop/confirm question that got an unrelated reply: stop waiting,
  // answer normally (don't leave the farmer stuck in an onboarding state).
  if ((user?.awaiting === 'crop' || user?.awaiting === 'farm_confirm') && userId) {
    await setAwaiting(userId, null);
  }
  // kind guard matters: a photo with a "como está minha lavoura?" caption is a
  // pest-triage image, not a satellite ask — captions never fast-path.
  const intent: Intent =
    effective.kind === 'text' && effective.text && isFieldHealthRequest(effective.text)
      ? 'field_health'
      : await routeIntent(effective);
  let pestCard: PestCardData | undefined;
  let replyText: string;
  try {
    // Working memory: the last few turns, so follow-ups ("e o que eu faço?")
    // resolve their referent. Fail-soft — no memory beats no reply.
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
  return { intent, replyText, pestCard };
}

/** The media survivors of the fetch step, normalized for downstream routing. */
interface InboundMedia {
  media: ChatImage | null;
  transcript: string | null;
  contactText: string | null;
  mediaTooLarge: boolean;
}

type ProspectState = Awaited<ReturnType<typeof handleProspectInbound>>;

/**
 * LGPD deletion short-circuit — honour it before anything else. No DB write
 * on a send failure here: the user's data was just deleted, keep it that way.
 * Returns true when handled (caller returns).
 */
async function guardDeletionRequest(adapter: TransportAdapter, msg: InboundMessage): Promise<boolean> {
  if (!(msg.text && isDeletionRequest(msg.text))) return false;
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
  return true;
}

/**
 * Partner replies (agronomists in the referral network): their reply opens
 * the 24h window → deliver any pending lead dossier free-form. Partners
 * never reach the farmer pipeline (and never get a farmer profile). Returns
 * true when the sender is a partner (caller returns).
 */
async function guardPartnerReply(adapter: TransportAdapter, msg: InboundMessage): Promise<boolean> {
  const partnerPhone = normalizePhoneBR(msg.from);
  const partner = partnerPhone ? await findPartnerByPhone(partnerPhone) : null;
  if (!partner) return false;
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
  return true;
}

/**
 * Resolve the farmer's user row, upserting on first contact. On DB failure
 * there's no user row → no rate limit and no memory, so running the LLM path
 * would be an unmetered cost/abuse hole: fail closed with the human apology.
 * Still claim by provider id (user_id null) so a redelivery doesn't buy a
 * second apology. Returns null when it has fully handled (caller returns).
 */
async function resolveUserOrFailClosed(
  adapter: TransportAdapter,
  msg: InboundMessage
): Promise<PipelineUser | null> {
  const user = await upsertUser(msg.from, msg.profileName);
  if (user) return user;
  const claimed = await claimInbound(null, {
    kind: msg.kind,
    text: msg.text,
    messageId: msg.messageId,
  });
  if (!claimed) {
    log.info('duplicate inbound on the fail-closed path — dropped:', msg.messageId);
    return null;
  }
  log.error('upsertUser unavailable — failing closed, no LLM work');
  try {
    await withRetry(() => adapter.send({ to: msg.from, text: FALLBACK_REPLY }));
  } catch (e) {
    log.error('fail-closed notice send failed:', (e as Error).message);
  }
  return null;
}

/**
 * Idempotency gate: claim the message by provider id before any work. A
 * provider retry (timeout redelivery) is a duplicate → ack without reprocessing.
 * Returns true when the message was already claimed (caller returns).
 */
async function guardDuplicateInbound(userId: string, msg: InboundMessage): Promise<boolean> {
  const claimed = await claimInbound(userId, {
    kind: msg.kind,
    text: msg.text,
    messageId: msg.messageId,
  });
  if (!claimed) {
    log.info('duplicate inbound ignored:', msg.messageId);
    return true;
  }
  return false;
}

/**
 * Rate limit before any expensive work (media fetch, LLM). The current message
 * is already claimed (counted), so throttle strictly above the cap; notify once
 * at the threshold, then drop silently so a flood / echo loop can't storm.
 * Returns true when throttled (caller returns).
 */
async function guardRateLimit(adapter: TransportAdapter, msg: InboundMessage, userId: string): Promise<boolean> {
  if (!userId) return false;
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const count = await countRecentInbound(userId, since);
  if (count <= RATE_MAX_PER_WINDOW) return false;
  if (count === RATE_MAX_PER_WINDOW + 1) {
    const notice =
      'Opa, chegou bastante coisa junta! 😅 Me dá uns segundinhos e manda de novo, que eu te respondo com calma.';
    const sent = await sendOrRecord(adapter, msg.from, { text: notice }, userId, 'rate_limited');
    if (sent) {
      await logMessage(userId, 'out', { kind: 'text', text: notice, intent: 'rate_limited' });
    }
  }
  return true;
}

/**
 * Media fetch (image or voice) — provider-agnostic, lazy, fail-soft.
 * Size cap before any LLM work: an oversized payload is a cost-abuse vector
 * (each image feeds two reasoning-tier vision calls) and breaks model input
 * limits anyway. ~8 MB binary ≈ 11 MB base64.
 */
async function fetchInboundMedia(adapter: TransportAdapter, msg: InboundMessage): Promise<InboundMedia> {
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
  return { media, transcript, contactText, mediaTooLarge };
}

/**
 * Prospect conversation agent: a reply from a cold-messaged business talks to
 * the partnerships persona, not farmer-Stevi. Media is normalized to text
 * first (voice transcript, vision description, vCard summary). Returns true when
 * the sender is a prospect — they never fall through to the farmer pipeline.
 */
async function respondAsProspectIfApplicable(
  adapter: TransportAdapter,
  msg: InboundMessage,
  userId: string,
  prospect: ProspectState['prospect'],
  effective: InboundMessage,
  media: ChatImage | null,
  transcript: string | null,
  contactText: string | null
): Promise<boolean> {
  if (!prospect) return false;
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

  const agentReply = await respondAsProspectAgent(prospect, inboundText, inboundKind);
  if (agentReply) {
    await sendOrRecord(adapter, msg.from, { text: agentReply }, userId, 'prospect_agent');
  }
  return true; // prospects never fall through to the farmer pipeline
}

/**
 * Common send tail (phase D): compliance gate → first-contact consent note →
 * media/card selection → referral nudge → send → delivery-gated markers →
 * optional second PDF document. Order and conditions unchanged from the inline
 * tail; the route's outputs arrive as one RouteResult.
 */
async function finalizeAndSend(ctx: RouteContext, result: RouteResult): Promise<void> {
  const { adapter, msg, effective, user, userId, firstContact } = ctx;
  const { intent, replyText, pestCard, extraCardUrl, extraDocUrl, extraDocCaption, extraDocFilename, suppressCard } =
    result;

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
        text: extraDocCaption ?? 'Segue também em PDF, pra guardar ou imprimir. 📎',
        mediaUrl: extraDocUrl,
        mediaType: 'document',
        filename: extraDocFilename ?? 'caderno-de-aplicacoes.pdf',
      },
      userId,
      'application_report_pdf'
    );
  }
}

export async function handleInbound(
  adapter: TransportAdapter,
  msg: InboundMessage
): Promise<void> {
  // Pre-route guards — each may fully handle the message and short-circuit.
  if (await guardDeletionRequest(adapter, msg)) return;
  if (await guardPartnerReply(adapter, msg)) return;

  const user = await resolveUserOrFailClosed(adapter, msg);
  if (!user) return;
  const userId = user.id;
  const firstContact = isFirstContact(user);

  if (await guardDuplicateInbound(userId, msg)) return;

  // Acquisition attribution: a vouched farmer's first message carries who sent
  // them ("Oi! Vim pelo José" / #tec-jose). First-wins at the DB layer — the
  // vouchado/orgânico cohort split is the flight plan's gate metric.
  if (firstContact && msg.text) {
    const src = parseSourceToken(msg.text);
    if (src) await setUserSource(userId, src);
  }

  // Prospect opt-out ("sair") is honoured immediately and permanently, before
  // any other handling. `pr` also carries the prospect for the agent branch,
  // which runs after media normalization below.
  const pr = await handleProspectInbound(msg.from, msg.text ?? null);
  if (pr.handled && pr.reply) {
    await sendOrRecord(adapter, msg.from, { text: pr.reply }, userId, 'prospect_optout');
    if (userId) await logMessage(userId, 'out', { kind: 'text', text: pr.reply, intent: 'prospect_optout' });
    return;
  }

  if (await guardRateLimit(adapter, msg, userId)) return;

  const { media, transcript, contactText, mediaTooLarge } = await fetchInboundMedia(adapter, msg);

  // A transcribed voice note becomes a normal text message downstream.
  const effective: InboundMessage =
    msg.kind === 'voice' && transcript ? { ...msg, kind: 'text', text: transcript } : msg;
  // Attach the transcript to the already-claimed inbound row (observability).
  if (transcript) await updateInboundTranscript(msg.messageId, transcript);

  if (
    await respondAsProspectIfApplicable(adapter, msg, userId, pr.prospect, effective, media, transcript, contactText)
  )
    return;

  // Build the route context (guard survivors + onboarding signals), then pick
  // the first matching route by priority order; if nothing matches, the
  // reasoning fallback. The branch's 8 outputs come back as one RouteResult.
  const ctx = await buildRouteContext({
    adapter,
    msg,
    effective,
    user,
    userId,
    firstContact,
    media,
    transcript,
    contactText,
    mediaTooLarge,
  });
  const route = ROUTES.find((r) => r.match(ctx));
  // The route declares its intent statically; stamp it onto the handler output.
  // The fallback owns its own (dynamic) intent, so it returns a full RouteResult.
  const result: RouteResult = route
    ? { ...(await route.handle(ctx)), intent: route.intent }
    : await reasonFallback(ctx);
  await finalizeAndSend(ctx, result);
}
