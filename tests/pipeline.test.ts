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
    adoptInbound: vi.fn(),
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
    insertTriageEvent: vi.fn(),
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
import { transcribeVoice } from '../api/_lib/transcribe';

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
  // Desde 04/ago (achado #18) o card só é anexado quando dá pra assiná-lo: sem
  // REPORT_URL_SECRET o /api/card recusaria a URL e o produtor receberia uma
  // imagem quebrada. Aqui o ambiente é o "configurado", que é o de produção;
  // a degradação tem caso próprio abaixo.
  process.env.REPORT_URL_SECRET = 'sk-teste-pipeline';
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
  vi.mocked(db.setFarmCrops).mockResolvedValue(true as never);
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

  it('ships the pest card when the reply passes the gate (as the 2nd message)', async () => {
    pestReason('triagem honesta sem dose');
    const adapter = makeAdapter();

    await handleInbound(adapter, msgFixture({ text: 'que praga é essa na soja' }));

    // Text-first contract: the diagnosis text lands first, the card follows.
    expect(adapter.send.mock.calls[0][0].mediaUrl).toBeUndefined();
    expect(adapter.send.mock.calls[1][0].mediaUrl).toContain('type=pest');
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

    // Text-first contract: the words land first, the farm card follows.
    expect(adapter.send.mock.calls[0][0].mediaUrl).toBeUndefined();
    expect(adapter.send.mock.calls[1][0].mediaUrl).toMatch(/type=farm/);
  });
});

/**
 * A escrita de telemetria da triagem é disparada sem await. Se ela rejeitar e
 * ninguém segurar, o Node 22 derruba o processo — e no Fluid Compute a instância
 * é reusada entre requisições concorrentes, então isso derruba a resposta de
 * OUTRO produtor em voo. Este arquivo já provava o bug sem afirmar nada: os
 * mocks não cobrem insertTriageEvent, o getDb() real explode por falta de
 * SUPABASE_URL, e a suíte reportava 4 "Unhandled Rejection" com 806 testes
 * verdes. Verde não é o mesmo que são.
 */
describe('o produtor nunca fica sem resposta', () => {
  // handleInbound rodava SEM nenhum try/catch: um throw em qualquer das 15
  // rotas, no buildRouteContext ou no finalizeAndSend subia até o webhook, que
  // logava, alertava os founders e dava ack(). O produtor recebia ZERO — o pior
  // desfecho possível do produto, e o único sem sinal nenhum pra ele.
  it('rota que estoura ainda entrega o fallback ao produtor', async () => {
    vi.mocked(checkOutbound).mockImplementation(() => {
      throw new Error('gate explodiu');
    });
    const adapter = makeAdapter();

    await handleInbound(adapter, msgFixture({ text: 'posso pulverizar hoje?' }));

    const textos = adapter.send.mock.calls.map((c) => c[0].text as string);
    expect(textos.some((t) => t?.includes('problema pra processar'))).toBe(true);
  });

  it('NÃO manda fallback se o produtor já tinha recebido resposta', async () => {
    // Um throw DEPOIS do envio não pode virar mensagem duplicada: a desculpa
    // chegando atrás de uma resposta boa confunde mais do que ajuda.
    const adapter = makeAdapter();
    adapter.send
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('segundo envio falhou'));
    vi.mocked(reason).mockImplementation(async (_m, _i, deps) => {
      deps.onPestCard?.({ pest: 'ferrugem', confidence: 'alta', crop: 'café', evidence: 'x', products: 3, groups: ['C3'] });
      return 'triagem honesta';
    });

    await handleInbound(adapter, msgFixture({ text: 'que praga é essa no café' }));

    const desculpas = adapter.send.mock.calls
      .map((c) => c[0].text as string)
      .filter((t) => t?.includes('problema pra processar'));
    expect(desculpas).toHaveLength(0);
  });
});

describe('opt-out por áudio', () => {
  // O comentário do guard dizia que o opt-out é honrado "immediately and
  // permanently, before any other handling". Não era: handleProspectInbound
  // recebia `msg.text ?? null` NOVE linhas antes da transcrição, então áudio
  // chegava com null, isOptOut não tinha o que ler, e a mensagem seguia pro
  // agente conversacional — o robô continuava falando com quem pediu pra parar.
  //
  // No agro brasileiro áudio é o canal de quem não digita. Isso não é borda.
  it('a transcrição chega no isOptOut — o pedido de parar é reconhecido', async () => {
    vi.mocked(transcribeVoice).mockResolvedValue('pode parar de mandar mensagem por favor');
    const adapter = makeAdapter();
    adapter.fetchMedia = vi.fn().mockResolvedValue({ base64: 'AAA', mime: 'audio/ogg' });

    await handleInbound(
      adapter,
      msgFixture({ kind: 'voice', text: null, mediaUrl: 'media-id-1', mediaMime: 'audio/ogg' })
    );

    expect(handleProspectInbound).toHaveBeenCalledWith(
      '+5511999990000',
      'pode parar de mandar mensagem por favor'
    );
  });

  it('texto continua chegando como antes', async () => {
    const adapter = makeAdapter();
    await handleInbound(adapter, msgFixture({ text: 'quero sair da lista' }));
    expect(handleProspectInbound).toHaveBeenCalledWith('+5511999990000', 'quero sair da lista');
  });
});

describe('telemetria não pode matar a instância', () => {
  it('escrita de triagem que falha não vira unhandled rejection', async () => {
    const soltas: unknown[] = [];
    const capturar = (e: unknown) => soltas.push(e);
    process.on('unhandledRejection', capturar);
    try {
      vi.mocked(routeIntent).mockResolvedValue('pest_triage');
      vi.mocked(reason).mockImplementation(async (_m, _i, deps) => {
        deps.onPestCard?.({ pest: 'ferrugem', confidence: 'alta', crop: 'café', evidence: 'x', products: 3, groups: ['C3'] });
        return 'triagem honesta';
      });

      await handleInbound(makeAdapter(), msgFixture({ text: 'que praga é essa no café' }));
      // A rejeição só chega no tick seguinte; sem isso o teste passa por engano.
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));
    } finally {
      process.off('unhandledRejection', capturar);
    }
    expect(soltas.map((e) => (e as Error)?.message)).toEqual([]);
  });
});

/**
 * Robô-espelho no lado do produtor (achado #3 da auditoria de 04/ago).
 *
 * 880 das 926 mensagens `out` de 03/ago foram `smalltalk`: um atendimento
 * automático trocou despedida com a Stevi por 25+ turnos, ~13s cada, cada turno
 * custando uma invocação e uma chamada de LLM. Estes testes fixam as duas
 * metades do contrato — o que o guard tem que calar, e o que ele NÃO pode.
 */
describe('guard de eco — robô que devolve a nossa própria frase', () => {
  it('silêncio: nem LLM nem envio quando devolvem nossa despedida verbatim', async () => {
    vi.mocked(db.getRecentTurns).mockResolvedValue([
      { role: 'produtor', text: 'valeu!' },
      { role: 'stevi', text: 'Até mais! Tamo junto. 🌱' },
    ]);
    const adapter = makeAdapter();

    await handleInbound(adapter, msgFixture({ text: 'Até mais! Tamo junto. 🌱' }));

    // A economia é ANTES do modelo: é a chamada de LLM que custa, não o envio.
    expect(routeIntent).not.toHaveBeenCalled();
    expect(reason).not.toHaveBeenCalled();
    expect(adapter.send).not.toHaveBeenCalled();
  });

  it('não lê o histórico duas vezes — o guard e a memória usam a mesma leitura', async () => {
    // A leitura subiu para antes do roteamento; se o reasonFallback voltasse a
    // buscar por conta própria, toda mensagem de texto pagaria dois SELECTs.
    vi.mocked(db.getRecentTurns).mockResolvedValue([{ role: 'stevi', text: 'oi de ontem' }]);
    await handleInbound(makeAdapter(), msgFixture({ text: 'e a ferrugem na soja?' }));

    expect(db.getRecentTurns).toHaveBeenCalledTimes(1);
    expect(reason).toHaveBeenCalledTimes(1);
  });

  it('produtor que INSISTE com a própria frase é respondido — insistir é humano', async () => {
    vi.mocked(db.getRecentTurns).mockResolvedValue([
      { role: 'produtor', text: 'alguém aí?' },
      { role: 'stevi', text: 'Oi! Como posso ajudar?' },
    ]);
    const adapter = makeAdapter();

    await handleInbound(adapter, msgFixture({ text: 'alguém aí?' }));

    expect(reason).toHaveBeenCalledTimes(1);
    expect(adapter.send).toHaveBeenCalled();
  });

  it('foto nunca é calada pelo guard — não tem texto para espelhar', async () => {
    vi.mocked(db.getRecentTurns).mockResolvedValue([{ role: 'stevi', text: 'Até mais! 🌱' }]);
    const adapter = makeAdapter();

    await handleInbound(
      adapter,
      msgFixture({ kind: 'image', text: null, mediaUrl: 'https://x/foto.jpg', mediaMime: 'image/jpeg' })
    );

    expect(adapter.send).toHaveBeenCalled();
  });
});

/**
 * Idempotência ANTES das guardas com efeito colateral (achado #14).
 *
 * `guardDeletionRequest` e `guardPartnerReply` rodavam antes de
 * `guardDuplicateInbound`. A Meta reentrega webhook — é o comportamento normal
 * dela, não uma anomalia — e reentrega significava mandar o dossiê ao parceiro
 * de novo, alertar os founders de novo, e reconfirmar uma exclusão já feita.
 *
 * A ordem antiga tinha razão de ser, e é por isso que o conserto não é só
 * trocar as linhas de lugar: a guarda de LGPD roda antes de resolver o usuário
 * DE PROPÓSITO (não se cria cadastro para quem está pedindo para sumir), e a de
 * parceiro também (parceiro não é produtor, não pode virar linha em `users`).
 *
 * Então a reivindicação passa a acontecer sem dono — `messages.user_id` é
 * nullable — e a linha é ADOTADA quando o usuário aparece. Custa um UPDATE por
 * mensagem recebida e compra a invariante inteira: nada com efeito colateral
 * roda duas vezes numa reentrega.
 */
describe('reentrega da Meta não repete efeito colateral', () => {
  it('mensagem repetida não apaga dados de novo nem responde de novo', async () => {
    vi.mocked(db.claimInbound).mockResolvedValue(false); // já vista
    const adapter = makeAdapter();

    await handleInbound(adapter, msgFixture({ text: 'apaga meus dados' }));

    expect(db.deleteUserData).not.toHaveBeenCalled();
    expect(adapter.send).not.toHaveBeenCalled();
  });

  it('mensagem repetida não manda o dossiê ao parceiro de novo', async () => {
    vi.mocked(db.claimInbound).mockResolvedValue(false);
    const adapter = makeAdapter();

    await handleInbound(adapter, msgFixture({ text: 'quero o dossiê' }));

    expect(findPartnerByPhone).not.toHaveBeenCalled();
    expect(adapter.send).not.toHaveBeenCalled();
  });

  it('a reivindicação acontece ANTES de resolver o usuário', async () => {
    // Se voltar a acontecer depois, a guarda de LGPD e a de parceiro rodam
    // primeiro e o teste acima deixa de significar alguma coisa.
    vi.mocked(db.claimInbound).mockResolvedValue(false);
    await handleInbound(makeAdapter(), msgFixture({ text: 'oi' }));
    expect(db.upsertUser).not.toHaveBeenCalled();
  });

  it('mensagem nova é reivindicada sem dono e depois adotada pelo usuário', async () => {
    const adapter = makeAdapter();
    await handleInbound(adapter, msgFixture({ text: 'e a ferrugem?' }));

    expect(db.claimInbound).toHaveBeenCalledWith(null, expect.objectContaining({ messageId: 'wamid-in-1' }));
    expect(db.adoptInbound).toHaveBeenCalledWith('wamid-in-1', 'u1');
    expect(adapter.send).toHaveBeenCalled(); // e o produtor recebe normalmente
  });
});

describe('sem REPORT_URL_SECRET a resposta sai só em texto', () => {
  it('não anexa card que o /api/card iria recusar', async () => {
    // A outra ponta do achado #18. Só endurecer a verificação transformaria
    // "guarda desligada" em "imagem quebrada no WhatsApp do produtor".
    delete process.env.REPORT_URL_SECRET;
    vi.mocked(routeIntent).mockResolvedValue('pest_triage');
    vi.mocked(reason).mockResolvedValue('parece ferrugem asiática');
    const adapter = makeAdapter();

    await handleInbound(adapter, msgFixture({ text: 'tem ferrugem na soja' }));

    expect(adapter.send).toHaveBeenCalledTimes(1); // o texto, e só ele
    expect(adapter.send.mock.calls[0][0].mediaUrl).toBeUndefined();
  });
});

/**
 * O moat registra a triagem INCERTA (achado #11).
 *
 * `triage_events` tinha ZERO linhas. A gravação estava presa ao card visual, e
 * o card só sai com praga identificada E confiança não-baixa — uma regra de
 * PRODUTO correta (não mostrar veredito fraco com cara de firme) que virou
 * regra de DADO sem ninguém decidir isso. O comentário no código descreve um
 * conjunto que "compounds"; ele estava vazio.
 *
 * A triagem incerta é justamente o dado de treino mais valioso: é onde a visão
 * erra, é o que o follow-up "resolveu?" vai carimbar depois.
 */
describe('triagem incerta deixa rastro', () => {
  const fotoDe = (v: object) =>
    vi.mocked(reason).mockImplementation(async (_m, _i, deps) => {
      deps.onTriage?.(v as never);
      return 'resposta';
    });

  it('confiança BAIXA é registrada — antes era exatamente o que sumia', async () => {
    fotoDe({ pest: 'algo parecido com ferrugem', cropVisto: 'soja', crop: 'soja', confidence: 'baixa', evidence: null });

    await handleInbound(makeAdapter(), msgFixture({ kind: 'image', text: null, mediaUrl: 'https://x/f.jpg' }));

    expect(db.insertTriageEvent).toHaveBeenCalledWith(
      expect.objectContaining({ pest: 'algo parecido com ferrugem', confidence: 'baixa' })
    );
  });

  it('SEM praga identificada também é registrada — "não deu" é dado', async () => {
    fotoDe({ pest: null, cropVisto: 'soja', crop: 'soja', confidence: 'baixa', evidence: 'folha borrada' });

    await handleInbound(makeAdapter(), msgFixture({ kind: 'image', text: null, mediaUrl: 'https://x/f.jpg' }));

    expect(db.insertTriageEvent).toHaveBeenCalledWith(expect.objectContaining({ pest: null }));
  });

  it('registra a cultura VISTA, mesmo fora do domínio', async () => {
    fotoDe({ pest: 'mancha', cropVisto: 'mamão', crop: null, confidence: 'media', evidence: null });

    await handleInbound(makeAdapter(), msgFixture({ kind: 'image', text: null, mediaUrl: 'https://x/f.jpg' }));

    expect(db.insertTriageEvent).toHaveBeenCalledWith(expect.objectContaining({ crop: 'mamão' }));
  });

  it('mensagem de texto não inventa triagem', async () => {
    await handleInbound(makeAdapter(), msgFixture({ text: 'bom dia' }));
    expect(db.insertTriageEvent).not.toHaveBeenCalled();
  });
});
