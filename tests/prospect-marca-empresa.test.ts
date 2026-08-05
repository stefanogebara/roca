/**
 * Prospect que responde ganha o carimbo `users.kind='empresa'` NA HORA.
 *
 * Por quê: o usuário é resolvido antes do ramo de prospect em
 * handleInboundComPrazo (de propósito — idempotência e rate limit precisam da
 * linha), então TODO prospect que responde ganha linha em `users` com o default
 * 'produtor'. A marcação retroativa foi feita duas vezes em 05/ago e vazou de
 * novo no mesmo dia (Minas Cafeeira, Pró Solo). O digest já filtra por kind
 * (tests/digest-empresas.test.ts); este teste pinça a outra metade: a linha
 * nasce e é carimbada no mesmo webhook, sem depender de faxina.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api/_lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/_lib/db')>();
  return {
    ...actual,
    upsertUser: vi.fn(),
    setUserSource: vi.fn(),
    markUserEmpresa: vi.fn(),
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
  recordProspectOutbound: vi.fn(),
  deleteProspectData: vi.fn(),
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
vi.mock('../api/_lib/transcribe', () => ({ transcribeVoice: vi.fn() }));
vi.mock('../api/_lib/llm', () => ({ describeImage: vi.fn() }));

import { handleInbound } from '../api/_lib/pipeline';
import type { InboundMessage, TransportAdapter } from '../api/_lib/transport/types';
import * as db from '../api/_lib/db';
import { reason } from '../api/_lib/reason';
import { routeIntent } from '../api/_lib/router';
import { handleProspectInbound, respondAsProspectAgent } from '../api/_lib/prospect/inbound';
import { findPartnerByPhone } from '../api/_lib/partners';
import { checkOutbound } from '../api/_lib/compliance';

const USER = {
  id: 'u1',
  wa_id: '+5511999990000',
  name: 'Minas Cafeeira',
  state: null,
  consent_lgpd_at: '2026-01-01T00:00:00Z',
  awaiting: null as string | null,
  source: null as string | null,
  referral_prompted_at: null as string | null,
};

const PROSPECT = {
  id: 'p1',
  phone: '11999990000',
  name: 'Minas Cafeeira',
  kind: 'revenda',
  city: 'Varginha',
  uf: 'MG',
  status: 'replied',
} as never;

const msgFixture = (over: Partial<InboundMessage> = {}): InboundMessage => ({
  from: '+5511999990000',
  messageId: 'wamid-in-1',
  kind: 'text',
  text: 'oi, me conta mais',
  mediaUrl: null,
  mediaMime: null,
  location: null,
  profileName: 'Minas Cafeeira',
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
  vi.mocked(respondAsProspectAgent).mockResolvedValue('resposta da Vitória');
  vi.mocked(findPartnerByPhone).mockResolvedValue(null);
  vi.mocked(routeIntent).mockResolvedValue('general');
  vi.mocked(reason).mockResolvedValue('resposta padrão');
  vi.mocked(checkOutbound).mockImplementation((text: string) => ({ safe: true, text, flags: [] }));
});

describe('prospect que responde é carimbado empresa na hora', () => {
  it('resposta livre de prospect → linha marcada empresa antes do agente responder', async () => {
    vi.mocked(handleProspectInbound).mockResolvedValue({
      handled: false,
      prospect: PROSPECT,
    } as never);
    const adapter = makeAdapter();

    await handleInbound(adapter, msgFixture());

    expect(db.markUserEmpresa).toHaveBeenCalledWith('u1');
    expect(reason).not.toHaveBeenCalled(); // prospect nunca cai no fluxo de produtor
  });

  it('opt-out de prospect também carimba — a linha já nasceu, o desfecho não muda isso', async () => {
    vi.mocked(handleProspectInbound).mockResolvedValue({
      handled: true,
      reply: 'Perfeito, não mando mais mensagens.',
      prospect: PROSPECT,
    } as never);
    const adapter = makeAdapter();

    await handleInbound(adapter, msgFixture({ text: 'sair' }));

    expect(db.markUserEmpresa).toHaveBeenCalledWith('u1');
  });

  it('produtor normal segue produtor — nada de carimbo', async () => {
    const adapter = makeAdapter();

    await handleInbound(adapter, msgFixture({ text: 'como está minha lavoura?' }));

    expect(db.markUserEmpresa).not.toHaveBeenCalled();
    expect(reason).toHaveBeenCalledTimes(1); // e a mensagem seguiu o fluxo de sempre
  });
});
