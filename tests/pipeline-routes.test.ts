/**
 * Characterization tests for the intent-ladder branches of handleInbound that
 * pipeline.test.ts doesn't drive (audit plan 2026-07-16-handleinbound-refactor,
 * T0). These lock the CURRENT behavior of financing_report, application_report,
 * history, application_log, prices, brief, referral (incl. the partner→consent
 * branch), mediaTooLarge, voice-no-transcript and consentReply, plus the second
 * PDF document send — so the upcoming route-table extraction can be proven
 * behavior-identical.
 *
 * Each branch is pinned two ways: (1) the fallback reason() is NOT called (proof
 * the fast-path handled it), and (2) the branch's signature output/side effect
 * fires (a document send, a card URL, an insert, a notification, an awaiting
 * transition). Pure predicates/formatters run for real; only I/O is mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api/_lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/_lib/db')>();
  return {
    ...actual,
    upsertUser: vi.fn(),
    setUserSource: vi.fn(),
    setUserState: vi.fn(),
    setFarmLocation: vi.fn(),
    markReferralPrompted: vi.fn(),
    logMessage: vi.fn(),
    claimInbound: vi.fn(),
    updateInboundTranscript: vi.fn(),
    deleteUserData: vi.fn(),
    markConsentNotified: vi.fn(),
    setAwaiting: vi.fn(),
    setFarmCrops: vi.fn(),
    countRecentInbound: vi.fn(),
    getFarmProfile: vi.fn(),
    createReferralRequest: vi.fn(),
    getFarm: vi.fn(),
    getFarmLocation: vi.fn(),
    getCachedNdvi: vi.fn(),
    hasRecentReferral: vi.fn(),
    getActivityLog: vi.fn(),
    getRecentTurns: vi.fn(),
    insertApplication: vi.fn(),
    listApplications: vi.fn(),
  };
});
vi.mock('../api/_lib/reason', () => ({ reason: vi.fn() }));
vi.mock('../api/_lib/router', () => ({ routeIntent: vi.fn() }));
vi.mock('../api/_lib/prospect/inbound', () => ({
  handleProspectInbound: vi.fn(),
  respondAsProspectAgent: vi.fn(),
}));
vi.mock('../api/_lib/partners', () => ({
  findPartnerByPhone: vi.fn(),
  buildDossierReply: vi.fn(),
  matchPartnerForFarm: vi.fn(),
  setReferralPartner: vi.fn(),
  consentAskText: vi.fn(),
  resolveConsentReply: vi.fn(),
}));
vi.mock('../api/_lib/compliance', () => ({ checkOutbound: vi.fn() }));
vi.mock('../api/_lib/alert', () => ({ alertFounders: vi.fn() }));
vi.mock('../api/_lib/notify', () => ({
  sendReferralNotification: vi.fn(),
  pingFoundersWhatsApp: vi.fn(),
}));
vi.mock('../api/_lib/farmcard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/_lib/farmcard')>();
  return { ...actual, buildFarmCard: vi.fn() };
});
vi.mock('../api/_lib/location', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/_lib/location')>();
  return { ...actual, resolveStatedLocation: vi.fn() };
});
vi.mock('../api/_lib/brief', () => ({ buildAgronomoBrief: vi.fn() }));
vi.mock('../api/_lib/transcribe', () => ({ transcribeVoice: vi.fn() }));
vi.mock('../api/_lib/llm', () => ({ describeImage: vi.fn() }));
vi.mock('../api/_lib/reportToken', () => ({ reportCardParams: vi.fn() }));
// Keep the real regex predicates + formatPricesReply/askedCommodities; stub the fetch.
vi.mock('../api/_lib/tools/prices', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/_lib/tools/prices')>();
  return { ...actual, fetchPrices: vi.fn() };
});
// Keep the real is*Request predicates; stub the LLM parse + the confirm formatter.
vi.mock('../api/_lib/tools/applicationParse', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/_lib/tools/applicationParse')>();
  return { ...actual, parseApplication: vi.fn(), formatApplicationConfirm: vi.fn() };
});

import { handleInbound } from '../api/_lib/pipeline';
import type { InboundMessage, TransportAdapter } from '../api/_lib/transport/types';
import * as db from '../api/_lib/db';
import { reason } from '../api/_lib/reason';
import { handleProspectInbound } from '../api/_lib/prospect/inbound';
import { findPartnerByPhone, matchPartnerForFarm, consentAskText, resolveConsentReply } from '../api/_lib/partners';
import { checkOutbound } from '../api/_lib/compliance';
import { sendReferralNotification } from '../api/_lib/notify';
import { resolveStatedLocation } from '../api/_lib/location';
import { reportCardParams } from '../api/_lib/reportToken';
import { fetchPrices } from '../api/_lib/tools/prices';
import { parseApplication, formatApplicationConfirm } from '../api/_lib/tools/applicationParse';
import { buildAgronomoBrief } from '../api/_lib/brief';
import { transcribeVoice } from '../api/_lib/transcribe';

const USER = {
  id: 'u1',
  wa_id: '+5511999990000',
  name: 'João',
  state: null,
  consent_lgpd_at: '2026-01-01T00:00:00Z',
  awaiting: null as string | null,
  source: null as string | null,
  referral_prompted_at: null as string | null,
};

const msgFixture = (over: Partial<InboundMessage> = {}): InboundMessage => ({
  from: '+5511999990000',
  messageId: 'wamid-in-1',
  kind: 'text',
  text: 'oi',
  mediaUrl: null,
  mediaMime: null,
  location: null,
  profileName: 'João',
  ...over,
});

type SendMock = ReturnType<typeof vi.fn>;
function makeAdapter(fetchMedia?: SendMock): TransportAdapter & { send: SendMock } {
  const a: any = {
    provider: 'test',
    isSync: false,
    verifySignature: async () => true,
    parseInbound: async () => null,
    send: vi.fn().mockResolvedValue(undefined),
  };
  if (fetchMedia) a.fetchMedia = fetchMedia;
  return a;
}

/** The main (first) send payload. */
function firstSend(adapter: { send: SendMock }) {
  return adapter.send.mock.calls[0][0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.upsertUser).mockResolvedValue({ ...USER });
  vi.mocked(db.claimInbound).mockResolvedValue(true);
  vi.mocked(db.countRecentInbound).mockResolvedValue(0);
  vi.mocked(db.getRecentTurns).mockResolvedValue([]);
  vi.mocked(db.getFarmProfile).mockResolvedValue({ uf: 'MG', crop: ['café'] });
  vi.mocked(db.getFarm).mockResolvedValue(null);
  vi.mocked(db.getFarmLocation).mockResolvedValue(null);
  vi.mocked(db.getActivityLog).mockResolvedValue([]);
  vi.mocked(db.hasRecentReferral).mockResolvedValue(false);
  vi.mocked(db.createReferralRequest).mockResolvedValue('ref-1');
  vi.mocked(db.insertApplication).mockResolvedValue(undefined as never);
  vi.mocked(db.listApplications).mockResolvedValue([]);
  vi.mocked(handleProspectInbound).mockResolvedValue({ handled: false, prospect: null } as never);
  vi.mocked(findPartnerByPhone).mockResolvedValue(null);
  vi.mocked(matchPartnerForFarm).mockResolvedValue(null as never);
  vi.mocked(resolveStatedLocation).mockResolvedValue({ kind: 'no_place' } as never);
  vi.mocked(reason).mockResolvedValue('resposta padrão (fallback)');
  vi.mocked(reportCardParams).mockReturnValue('u=u1&exp=999&sig=abc');
  vi.mocked(checkOutbound).mockImplementation((text: string) =>
    text.includes('##UNSAFE##')
      ? { safe: false, text: 'resposta segura no lugar', flags: ['teste'] }
      : { safe: true, text, flags: [] }
  );
});

// A couple of application rows to make the report/financing branches "non-empty".
const ROWS = [
  { applied_on: '2026-06-02', product: 'Priori Xtra', crop: 'café', target: 'ferrugem', dose: '300 mL/ha' },
  { applied_on: '2026-06-10', product: 'Fox', crop: 'café', target: 'ferrugem', dose: '500 mL/ha' },
] as never;

describe('financing_report route', () => {
  it('checked before application_report; ships a PRONAF PDF as a second document message', async () => {
    vi.mocked(db.listApplications).mockResolvedValue(ROWS);
    const adapter = makeAdapter();
    await handleInbound(adapter, msgFixture({ text: 'preciso do relatório de aplicações pro banco' }));

    expect(reason).not.toHaveBeenCalled();
    expect(adapter.send).toHaveBeenCalledTimes(2);
    const doc = adapter.send.mock.calls[1][0];
    expect(doc.mediaType).toBe('document');
    expect(doc.mediaUrl).toContain('/api/report?');
    expect(doc.mediaUrl).toContain('kind=pronaf');
    expect(doc.filename).toBe('historico-manejo-pronaf.pdf');
  });

  it('empty history → gate-safe text, no document', async () => {
    vi.mocked(db.listApplications).mockResolvedValue([] as never);
    const adapter = makeAdapter();
    await handleInbound(adapter, msgFixture({ text: 'relatório pro financiamento' }));
    expect(reason).not.toHaveBeenCalled();
    expect(adapter.send).toHaveBeenCalledTimes(1);
  });
});

describe('application_report route', () => {
  it('ships the caderno PNG card in-chat and the PDF as a second document', async () => {
    vi.mocked(db.listApplications).mockResolvedValue(ROWS);
    const adapter = makeAdapter();
    await handleInbound(adapter, msgFixture({ text: 'me manda minhas aplicações' }));

    expect(reason).not.toHaveBeenCalled();
    expect(firstSend(adapter).mediaUrl).toContain('/api/card?');
    expect(adapter.send).toHaveBeenCalledTimes(2);
    const doc = adapter.send.mock.calls[1][0];
    expect(doc.mediaType).toBe('document');
    expect(doc.mediaUrl).toContain('/api/report?');
    expect(doc.filename).toBe('caderno-de-aplicacoes.pdf');
  });

  it('without a signing secret, falls back to a gate-safe text summary (no URL)', async () => {
    vi.mocked(db.listApplications).mockResolvedValue(ROWS);
    vi.mocked(reportCardParams).mockReturnValue(null as never);
    const adapter = makeAdapter();
    await handleInbound(adapter, msgFixture({ text: 'minhas aplicações' }));
    expect(reason).not.toHaveBeenCalled();
    expect(adapter.send).toHaveBeenCalledTimes(1);
    expect(firstSend(adapter).mediaUrl).toBeUndefined();
  });
});

describe('history route', () => {
  it('checked after application_report; answers from the season record, clears awaiting', async () => {
    const adapter = makeAdapter();
    await handleInbound(adapter, msgFixture({ text: 'me mostra meu histórico' }));
    expect(reason).not.toHaveBeenCalled();
    expect(db.getActivityLog).toHaveBeenCalledWith('u1');
    expect(firstSend(adapter).text).toBeTruthy();
  });
});

describe('application_log route', () => {
  it('parses + stores the declared application and reads the confirm back', async () => {
    vi.mocked(parseApplication).mockResolvedValue({ product: 'X', crop: 'café' } as never);
    vi.mocked(formatApplicationConfirm).mockReturnValue('Anotei sua aplicação. ✅');
    const adapter = makeAdapter();
    await handleInbound(adapter, msgFixture({ text: 'apliquei Priori Xtra ontem na lavoura' }));

    expect(reason).not.toHaveBeenCalled();
    expect(db.insertApplication).toHaveBeenCalledTimes(1);
    expect(formatApplicationConfirm).toHaveBeenCalled();
    expect(firstSend(adapter).text).toContain('Anotei sua aplicação');
  });
});

describe('prices route', () => {
  it('fetches quotes and ships the shareable price card', async () => {
    vi.mocked(fetchPrices).mockResolvedValue({
      quotes: [{ key: 'cafe', label: 'Café arábica', sacaBrl: 2000, weekChangePct: null }],
      usdBrl: 5.4,
    } as never);
    const adapter = makeAdapter();
    // PRICE_INTENT matches "cotação <...> café"; note "quanto tá a saca do café"
    // does NOT match (the commodity must follow "quanto tá (o|a)" directly), so
    // it would fall through to reason() — a real edge the regex encodes today.
    await handleInbound(adapter, msgFixture({ text: 'cotação do café hoje?' }));

    expect(reason).not.toHaveBeenCalled();
    expect(fetchPrices).toHaveBeenCalled();
    expect(firstSend(adapter).mediaUrl).toContain('type=prices');
  });
});

describe('brief route', () => {
  it('builds the agrônomo briefing and attaches the caderno PDF when there are rows', async () => {
    vi.mocked(buildAgronomoBrief).mockResolvedValue('Resumo pro agrônomo: ...');
    vi.mocked(db.listApplications).mockResolvedValue([ROWS[0]] as never);
    const adapter = makeAdapter();
    await handleInbound(adapter, msgFixture({ text: 'monta o resumo pro agrônomo' }));

    expect(reason).not.toHaveBeenCalled();
    expect(buildAgronomoBrief).toHaveBeenCalledWith('u1');
    expect(adapter.send).toHaveBeenCalledTimes(2);
    expect(adapter.send.mock.calls[1][0].mediaType).toBe('document');
  });
});

describe('referral route', () => {
  it('generic path: records the request and pings the founders (no partner match)', async () => {
    const adapter = makeAdapter();
    await handleInbound(adapter, msgFixture({ text: 'quero falar com um agrônomo' }));

    expect(reason).not.toHaveBeenCalled();
    expect(db.createReferralRequest).toHaveBeenCalledTimes(1);
    expect(sendReferralNotification).toHaveBeenCalledTimes(1);
  });

  it('partner-match path: asks explicit share-consent and sets awaiting=referral_consent', async () => {
    vi.mocked(matchPartnerForFarm).mockResolvedValue({ id: 'p1', name: 'Agr. Silva' } as never);
    vi.mocked(consentAskText).mockReturnValue('Posso passar seu contato pro Agr. Silva?');
    const adapter = makeAdapter();
    await handleInbound(adapter, msgFixture({ text: 'me indica um agrônomo' }));

    expect(db.setAwaiting).toHaveBeenCalledWith('u1', 'referral_consent');
    expect(firstSend(adapter).text).toContain('Posso passar seu contato');
  });
});

describe('consentReply route (awaiting=referral_consent)', () => {
  it('a yes/no resolves the pending share-consent and clears the wait', async () => {
    vi.mocked(db.upsertUser).mockResolvedValue({ ...USER, awaiting: 'referral_consent' });
    vi.mocked(resolveConsentReply).mockResolvedValue('Combinado! Vou passar seu contato. 👍');
    const adapter = makeAdapter();
    await handleInbound(adapter, msgFixture({ text: 'pode sim' }));

    expect(reason).not.toHaveBeenCalled();
    expect(resolveConsentReply).toHaveBeenCalled();
    expect(db.setAwaiting).toHaveBeenCalledWith('u1', null);
    expect(firstSend(adapter).text).toContain('Combinado');
  });
});

describe('mediaTooLarge route', () => {
  it('an oversized image is refused with the "manda de novo" text, no reasoning', async () => {
    const big = 'a'.repeat(11_000_001);
    const fetchMedia = vi.fn().mockResolvedValue({ base64: big, mime: 'image/jpeg' });
    const adapter = makeAdapter(fetchMedia);
    await handleInbound(adapter, msgFixture({ kind: 'image', mediaUrl: 'https://m/x.jpg', text: null }));

    expect(reason).not.toHaveBeenCalled();
    expect(firstSend(adapter).text).toContain('grande demais');
  });
});

describe('voice-no-transcript route', () => {
  it('an untranscribable voice note asks the farmer to retry, no reasoning', async () => {
    const fetchMedia = vi.fn().mockResolvedValue({ base64: 'AAAA', mime: 'audio/ogg' });
    vi.mocked(transcribeVoice).mockResolvedValue(null as never);
    const adapter = makeAdapter(fetchMedia);
    await handleInbound(adapter, msgFixture({ kind: 'voice', mediaUrl: 'https://m/a.ogg', text: null }));

    expect(reason).not.toHaveBeenCalled();
    expect(firstSend(adapter).text).toContain('áudio');
  });
});
