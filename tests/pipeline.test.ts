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
  return { ...actual, buildFarmCard: vi.fn() }; // real isFarmConfirmYes, stubbed card builder
});
vi.mock('../api/_lib/location', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/_lib/location')>();
  return { ...actual, resolveStatedLocation: vi.fn() }; // real regex/copy, stubbed geocode
});
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
import { resolveStatedLocation } from '../api/_lib/location';
import { buildFarmCard } from '../api/_lib/farmcard';

const USER = {
  id: 'u1',
  wa_id: '+5511999990000',
  name: 'João',
  state: null,
  consent_lgpd_at: '2026-01-01T00:00:00Z', // not first contact → no consent note
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
  vi.mocked(db.setFarmLocation).mockResolvedValue('farm-1');
  vi.mocked(resolveStatedLocation).mockResolvedValue({ kind: 'no_place' });
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

describe('growth loops', () => {
  it('captures the source token from a vouched first message', async () => {
    vi.mocked(db.upsertUser).mockResolvedValue({ ...USER, consent_lgpd_at: null }); // first contact
    const adapter = makeAdapter();

    await handleInbound(adapter, msgFixture({ text: 'Oi! Vim pelo José da Cooxupé' }));

    expect(db.setUserSource).toHaveBeenCalledWith('u1', expect.stringContaining('josé'));
  });

  it('ordinary first messages set no source', async () => {
    vi.mocked(db.upsertUser).mockResolvedValue({ ...USER, consent_lgpd_at: null });
    const adapter = makeAdapter();
    await handleInbound(adapter, msgFixture({ text: 'oi' }));
    expect(db.setUserSource).not.toHaveBeenCalled();
  });

  it('appends the self-attributing referral nudge after a delivered pest-card victory', async () => {
    vi.mocked(routeIntent).mockResolvedValue('pest_triage');
    vi.mocked(reason).mockImplementation(async (_m, _i, deps) => {
      deps.onPestCard?.({ pest: 'ferrugem', confidence: 'alta', crop: 'café', evidence: 'x', products: 3, groups: ['C3'] });
      return 'triagem honesta';
    });
    const adapter = makeAdapter();

    await handleInbound(adapter, msgFixture({ text: 'que praga é essa no café' }));

    const sent = adapter.send.mock.calls[0][0].text as string;
    expect(sent).toContain('wa.me/');
    expect(sent).toContain(encodeURIComponent('Vim pelo(a) João'));
    expect(db.markReferralPrompted).toHaveBeenCalledWith('u1');
  });

  it('the nudge respects the 14-day cooldown', async () => {
    vi.mocked(routeIntent).mockResolvedValue('pest_triage');
    vi.mocked(db.upsertUser).mockResolvedValue({
      ...USER,
      referral_prompted_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    });
    vi.mocked(reason).mockImplementation(async (_m, _i, deps) => {
      deps.onPestCard?.({ pest: 'ferrugem', confidence: 'alta', crop: 'café', evidence: 'x', products: 3, groups: ['C3'] });
      return 'triagem honesta';
    });
    const adapter = makeAdapter();

    await handleInbound(adapter, msgFixture({ text: 'que praga é essa no café' }));

    expect((adapter.send.mock.calls[0][0].text as string)).not.toContain('wa.me/');
    expect(db.markReferralPrompted).not.toHaveBeenCalled();
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

describe('farm_confirm (pin had no vegetation — awaiting the farmer’s confirm)', () => {
  it('an affirmative keeps the pin and moves to the crop question, no model call', async () => {
    vi.mocked(db.upsertUser).mockResolvedValue({ ...USER, awaiting: 'farm_confirm' });
    const adapter = makeAdapter();

    await handleInbound(adapter, msgFixture({ text: 'é aí mesmo, tá em pousio' }));

    expect(db.setAwaiting).toHaveBeenCalledWith('u1', 'crop');
    expect(reason).not.toHaveBeenCalled();
    expect(adapter.send.mock.calls[0][0].text).toMatch(/o que você planta/i);
  });

  it('an unrelated question clears the stuck state and answers normally', async () => {
    vi.mocked(db.upsertUser).mockResolvedValue({ ...USER, awaiting: 'farm_confirm' });
    vi.mocked(routeIntent).mockResolvedValue('general');
    vi.mocked(reason).mockResolvedValue('resposta agronômica');
    const adapter = makeAdapter();

    await handleInbound(adapter, msgFixture({ text: 'qual o melhor adubo pro café?' }));

    expect(db.setAwaiting).toHaveBeenCalledWith('u1', null); // no longer stuck
    expect(reason).toHaveBeenCalledTimes(1);
    expect(adapter.send.mock.calls[0][0].text).toBe('resposta agronômica');
  });
});

describe('stated location (naming the field instead of dropping a pin)', () => {
  it('geocodes a named city, stores it as approximate, and asks for the pin', async () => {
    vi.mocked(resolveStatedLocation).mockResolvedValue({
      kind: 'resolved', lat: -18.94, lon: -46.99, city: 'Patrocínio', uf: 'MG',
    });
    const adapter = makeAdapter();

    await handleInbound(adapter, msgFixture({ text: 'minha lavoura fica em Patrocínio-MG' }));

    expect(db.setFarmLocation).toHaveBeenCalledWith('u1', -18.94, -46.99, 'city');
    expect(db.setUserState).toHaveBeenCalledWith('u1', 'MG');
    expect(db.setAwaiting).toHaveBeenCalledWith('u1', 'crop');
    expect(reason).not.toHaveBeenCalled(); // deterministic path, no model
    const sent = adapter.send.mock.calls[0][0].text as string;
    expect(sent).toContain('Patrocínio-MG');
    expect(sent).toMatch(/pin/i);
  });

  it('a spray question naming a city is NOT treated as a location statement', async () => {
    vi.mocked(routeIntent).mockResolvedValue('spray_window');
    vi.mocked(reason).mockResolvedValue('veredito delta-t');
    const adapter = makeAdapter();

    await handleInbound(adapter, msgFixture({ text: 'posso pulverizar em Patrocínio hoje?' }));

    expect(resolveStatedLocation).not.toHaveBeenCalled(); // gate didn't fire
    expect(db.setFarmLocation).not.toHaveBeenCalled();
    expect(reason).toHaveBeenCalledTimes(1); // answered as a spray question
  });

  it('a named-but-ungeocodable place asks for city+UF or a pin', async () => {
    vi.mocked(resolveStatedLocation).mockResolvedValue({ kind: 'ungeocodable', city: 'Cidade Inventada' });
    const adapter = makeAdapter();

    await handleInbound(adapter, msgFixture({ text: 'minha fazenda fica em Cidade Inventada' }));

    expect(db.setFarmLocation).not.toHaveBeenCalled();
    expect(reason).not.toHaveBeenCalled();
    expect(adapter.send.mock.calls[0][0].text).toMatch(/não consegui achar/i);
  });

  it('a message that named no place (referral intro) falls through — never a false "não achei"', async () => {
    // "sou do João" matches the gate but extracts no city → no_place → normal handling.
    vi.mocked(resolveStatedLocation).mockResolvedValue({ kind: 'no_place' });
    vi.mocked(routeIntent).mockResolvedValue('smalltalk');
    vi.mocked(reason).mockResolvedValue('oi! como posso ajudar?');
    const adapter = makeAdapter();

    await handleInbound(adapter, msgFixture({ text: 'oi, sou do João, ele me indicou' }));

    expect(db.setFarmLocation).not.toHaveBeenCalled();
    expect(reason).toHaveBeenCalledTimes(1); // answered normally, not "não achei essa cidade"
    expect(adapter.send.mock.calls[0][0].text).not.toMatch(/não consegui achar/i);
  });
});

describe('non-field pin never ships a "SUA LAVOURA" card image', () => {
  it('suppresses the card when buildFarmCard held for farm_confirm', async () => {
    vi.mocked(buildFarmCard).mockResolvedValue({ text: 'não achei vegetação aí, é aí mesmo?', card: false });
    const adapter = makeAdapter();

    await handleInbound(
      adapter,
      msgFixture({ kind: 'location', text: null, location: { lat: -23.55, lon: -46.63 } })
    );

    expect(adapter.send.mock.calls[0][0].mediaUrl).toBeUndefined();
    expect(adapter.send.mock.calls[0][0].text).toMatch(/não achei vegetação/i);
  });

  it('a confirmed field ships the card as before', async () => {
    vi.mocked(buildFarmCard).mockResolvedValue({ text: 'guardei sua lavoura 📍', card: true });
    const adapter = makeAdapter();

    await handleInbound(
      adapter,
      msgFixture({ kind: 'location', text: null, location: { lat: -21.2, lon: -45.0 } })
    );

    expect(adapter.send.mock.calls[0][0].mediaUrl).toMatch(/type=farm/);
  });
});
