/**
 * handleInbound orchestration — the first tests above the pure-predicate layer.
 * Everything with I/O is mocked; the pipeline's own routing/gating decisions
 * run for real. Pins four behaviors that unit tests can't see:
 *
 * 1. A question that names a crop while awaiting='crop' is answered, not
 *    swallowed by the onboarding capture (crops still captured silently).
 * 2. A photo with a "como está minha lavoura?" caption still goes to the
 *    router (pest triage), not to the text-only field_health regex.
 * 3. When the compliance gate replaces a reply, the pest card is suppressed
 *    (the card carries the very product/group data the gate blocked).
 * 4. If the user row can't be established (DB down), the pipeline fails
 *    closed: apology reply, no LLM work, no unmetered path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api/_lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/_lib/db')>();
  return {
    ...actual,
    upsertUser: vi.fn(),
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
vi.mock('../api/_lib/farmcard', () => ({ buildFarmCard: vi.fn() }));
vi.mock('../api/_lib/brief', () => ({ buildAgronomoBrief: vi.fn() }));
vi.mock('../api/_lib/transcribe', () => ({ transcribeVoice: vi.fn() }));
vi.mock('../api/_lib/llm', () => ({ describeImage: vi.fn() }));

import { handleInbound } from '../api/_lib/pipeline';
import type { InboundMessage, TransportAdapter } from '../api/_lib/transport/types';
import * as db from '../api/_lib/db';
import { reason } from '../api/_lib/reason';
import { routeIntent } from '../api/_lib/router';
import { handleProspectInbound } from '../api/_lib/prospect/inbound';
import { findPartnerByPhone } from '../api/_lib/partners';
import { checkOutbound } from '../api/_lib/compliance';

const USER = {
  id: 'u1',
  wa_id: '+5511999990000',
  name: 'João',
  state: null,
  consent_lgpd_at: '2026-01-01T00:00:00Z', // not first contact → no consent note
  awaiting: null as string | null,
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

function makeAdapter(): TransportAdapter & { send: ReturnType<typeof vi.fn> } {
  return {
    provider: 'test',
    isSync: false,
    verifySignature: async () => true,
    parseInbound: async () => null,
    send: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.upsertUser).mockResolvedValue({ ...USER });
  vi.mocked(db.claimInbound).mockResolvedValue(true);
  vi.mocked(db.countRecentInbound).mockResolvedValue(0);
  vi.mocked(db.getRecentTurns).mockResolvedValue([]);
  vi.mocked(db.getFarmProfile).mockResolvedValue({ uf: null, crop: null });
  vi.mocked(db.getFarm).mockResolvedValue(null);
  vi.mocked(db.getFarmLocation).mockResolvedValue(null);
  vi.mocked(db.getCachedNdvi).mockResolvedValue(null);
  vi.mocked(db.hasRecentReferral).mockResolvedValue(false);
  vi.mocked(db.getActivityLog).mockResolvedValue([]);
  vi.mocked(handleProspectInbound).mockResolvedValue({ handled: false, prospect: null } as never);
  vi.mocked(findPartnerByPhone).mockResolvedValue(null);
  vi.mocked(routeIntent).mockResolvedValue('general');
  vi.mocked(reason).mockResolvedValue('resposta padrão');
  vi.mocked(checkOutbound).mockImplementation((text: string) =>
    text.includes('##UNSAFE##')
      ? { safe: false, text: 'resposta segura no lugar', flags: ['teste'] }
      : { safe: true, text, flags: [] }
  );
});

describe('crop capture while awaiting=crop', () => {
  it('answers a question that merely names a crop (captures silently, never swallows)', async () => {
    vi.mocked(db.upsertUser).mockResolvedValue({ ...USER, awaiting: 'crop' });
    vi.mocked(routeIntent).mockResolvedValue('spray_window');
    vi.mocked(reason).mockResolvedValue('veredito delta-t ok');
    const adapter = makeAdapter();

    await handleInbound(adapter, msgFixture({ text: 'posso pulverizar na soja?' }));

    expect(db.setFarmCrops).toHaveBeenCalledWith('u1', ['soja']); // data still captured
    expect(reason).toHaveBeenCalledTimes(1); // the question reached the model
    expect(adapter.send).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'veredito delta-t ok' })
    );
  });

  it('still confirms a crops-only answer without invoking the model', async () => {
    vi.mocked(db.upsertUser).mockResolvedValue({ ...USER, awaiting: 'crop' });
    const adapter = makeAdapter();

    await handleInbound(adapter, msgFixture({ text: 'planto soja e milho' }));

    expect(db.setFarmCrops).toHaveBeenCalledWith('u1', ['soja', 'milho']);
    expect(reason).not.toHaveBeenCalled();
    const sentText = adapter.send.mock.calls[0][0].text as string;
    expect(sentText).toMatch(/^Anotado/);
  });

  it('never captures a negated crop mention', async () => {
    vi.mocked(db.upsertUser).mockResolvedValue({ ...USER, awaiting: 'crop' });
    const adapter = makeAdapter();

    await handleInbound(adapter, msgFixture({ text: 'não planto soja, parei ano passado' }));

    expect(db.setFarmCrops).not.toHaveBeenCalled();
    expect(reason).toHaveBeenCalledTimes(1); // routed to the model instead
  });
});

describe('captioned photo routing', () => {
  it('routes an image with a field-health caption through the router (pest triage wins)', async () => {
    vi.mocked(routeIntent).mockResolvedValue('pest_triage');
    const adapter = makeAdapter();

    await handleInbound(
      adapter,
      msgFixture({ kind: 'image', text: 'como está minha lavoura?', mediaUrl: 'https://x/img' })
    );

    expect(vi.mocked(reason).mock.calls[0][1]).toBe('pest_triage');
  });

  it('still fast-paths a plain-text field-health ask', async () => {
    const adapter = makeAdapter();
    await handleInbound(adapter, msgFixture({ text: 'como está minha lavoura?' }));
    expect(vi.mocked(reason).mock.calls[0][1]).toBe('field_health');
    expect(routeIntent).not.toHaveBeenCalled();
  });
});

describe('compliance gate vs pest card', () => {
  const pestReason = (replyText: string) =>
    vi.mocked(reason).mockImplementation(async (_msg, _intent, deps) => {
      deps.onPestCard?.({
        pest: 'ferrugem asiática',
        confidence: 'alta',
        crop: 'soja',
        evidence: 'pústulas',
        products: 12,
        groups: ['C3', 'G1'],
      });
      return replyText;
    });

  it('suppresses the pest card when the gate replaces the reply', async () => {
    pestReason('use 2 L/ha ##UNSAFE##');
    const adapter = makeAdapter();

    await handleInbound(adapter, msgFixture({ text: 'que praga é essa na soja' }));

    const sent = adapter.send.mock.calls[0][0];
    expect(sent.text).toBe('resposta segura no lugar');
    expect(sent.mediaUrl).toBeUndefined();
  });

  it('ships the pest card when the reply passes the gate', async () => {
    pestReason('triagem honesta sem dose');
    const adapter = makeAdapter();

    await handleInbound(adapter, msgFixture({ text: 'que praga é essa na soja' }));

    const sent = adapter.send.mock.calls[0][0];
    expect(sent.mediaUrl).toContain('type=pest');
  });
});

describe('fail-closed when the user row is unavailable', () => {
  it('sends one apology, keeps provider-id idempotency, and does no LLM work', async () => {
    vi.mocked(db.upsertUser).mockResolvedValue(null);
    const adapter = makeAdapter();

    await handleInbound(adapter, msgFixture({ text: 'posso pulverizar hoje?' }));

    expect(db.claimInbound).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ messageId: 'wamid-in-1' })
    );
    expect(adapter.send).toHaveBeenCalledTimes(1);
    expect(adapter.send.mock.calls[0][0].text).toMatch(/problema pra processar/);
    expect(reason).not.toHaveBeenCalled();
    expect(routeIntent).not.toHaveBeenCalled();
  });

  it('drops a provider redelivery silently (no second paid apology)', async () => {
    vi.mocked(db.upsertUser).mockResolvedValue(null);
    vi.mocked(db.claimInbound).mockResolvedValue(false);
    const adapter = makeAdapter();

    await handleInbound(adapter, msgFixture());

    expect(adapter.send).not.toHaveBeenCalled();
  });
});
