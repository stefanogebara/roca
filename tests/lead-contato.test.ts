/**
 * Contato citado numa conversa de prospecção → email pros fundadores com botão
 * que abre o WhatsApp já com a mensagem pronta (pedido do Stefano, 06/ago).
 *
 * O momento "fala com o Roberto nesse número" é o handoff mais quente do funil
 * depois da primeira resposta — e morria no painel: o fundador precisava achar
 * o número no thread, copiar, abrir o WhatsApp, escrever do zero. Agora o email
 * chega com o botão wa.me pronto pra tocar.
 *
 * Diferença DELIBERADA de postura: este email carrega o número COMPLETO (o
 * botão é o número), ao contrário dos avisos de referral/primeira-resposta, que
 * mascaram. Quem recebe é o próprio controlador do dado, e o botão é o produto.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api/_lib/prospect/db', () => ({
  // Reivindicação atômica do turno (07/ago): sem o mock ela vem undefined e
  // o fluxo quebra. Sempre `true` aqui — a corrida em si tem teste próprio
  // em turno-atomico.test.ts, com um banco simulado de verdade.
  claimAgentTurn: vi.fn(async () => true),
  getProspectThread: vi.fn(),
  logProspectMessage: vi.fn(),
  mergeProspectQualification: vi.fn(),
  setProspectAgentEnabled: vi.fn(async () => {}),
  bumpPorteiroTentativas: vi.fn(async () => {}),
  findProspectByPhone: vi.fn(),
  addOptout: vi.fn(),
  deleteProspectByPhone: vi.fn(),
  markProspectReplied: vi.fn(),
}));
vi.mock('../api/_lib/prospect/agent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/_lib/prospect/agent')>();
  return {
    ...actual,
    buildAgentReply: vi.fn(async () => ({ tipo: 'responder', texto: 'combinado!' })),
    extractQualification: vi.fn(async () => null),
  };
});
vi.mock('../api/_lib/alert', () => ({ alertFounders: vi.fn() }));
vi.mock('../api/_lib/notify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/_lib/notify')>();
  return {
    ...actual,
    sendLeadContactNotification: vi.fn(),
    sendProspectReplyNotification: vi.fn(),
  };
});

import { extrairNumerosCitados } from '../api/_lib/prospect/core';
import { formatLeadContactEmail, sendLeadContactNotification } from '../api/_lib/notify';
import { respondAsProspectAgent } from '../api/_lib/prospect/inbound';
import { getProspectThread } from '../api/_lib/prospect/db';

const PROSPECT = {
  id: 'p1',
  name: 'Coopercafé',
  kind: 'cooperativa',
  city: 'Varginha',
  uf: 'MG',
  phone: '+5535999887766',
  porteiro_tentativas: 0,
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getProspectThread).mockResolvedValue([] as never);
});

describe('extrairNumerosCitados — números BR em texto livre', () => {
  it('acha os formatos que gente digita no WhatsApp', () => {
    expect(extrairNumerosCitados('fala com ele no (35) 99999-1234')).toEqual(['+5535999991234']);
    expect(extrairNumerosCitados('liga no +55 35 3222-1111')).toEqual(['+553532221111']);
    // Celular sem o nono dígito (JID antigo) — mesma regra do normalizePhoneBR.
    expect(extrairNumerosCitados('o zap dele é 35 9750-6635')).toEqual(['+5535997506635']);
  });

  it('não inventa telefone em número que não é telefone', () => {
    expect(extrairNumerosCitados('pedido nº 123456, R$ 1.500,00 em 06/08/2026')).toEqual([]);
    expect(extrairNumerosCitados('meu CPF é 123.456.789-01')).toEqual([]);
    expect(extrairNumerosCitados(null)).toEqual([]);
    expect(extrairNumerosCitados('')).toEqual([]);
  });

  it('deduplica e devolve todos os distintos', () => {
    const dois = extrairNumerosCitados(
      'anota: (35) 98888-7777 ou (35) 98888-7777, e o fixo (35) 3222-1111'
    );
    expect(dois).toEqual(['+5535988887777', '+553532221111']);
  });
});

describe('formatLeadContactEmail — o botão é o produto', () => {
  const notice = {
    prospectName: 'Coopercafé',
    kind: 'cooperativa',
    city: 'Varginha',
    uf: 'MG',
    citedPhones: ['+5535988887777'],
    replyText: 'melhor falar com o Roberto, o número dele é (35) 98888-7777',
  };

  it('html traz o link wa.me com a mensagem pré-preenchida', () => {
    const { subject, body, html } = formatLeadContactEmail(notice);
    expect(subject).toContain('Coopercafé');
    expect(subject).toMatch(/contato/i);
    expect(html).toContain('https://wa.me/5535988887777?text=');
    // A mensagem pronta cita a empresa que indicou (urlencoded no link).
    expect(html).toContain(encodeURIComponent('Coopercafé'));
    // Texto-fallback carrega o mesmo link pra cliente de email sem html.
    expect(body).toContain('https://wa.me/5535988887777?text=');
    expect(body).toContain('/painel');
    expect(body).toContain('melhor falar com o Roberto');
  });

  it('um botão por número quando o lead passa mais de um', () => {
    const { html } = formatLeadContactEmail({
      ...notice,
      citedPhones: ['+5535988887777', '+553532221111'],
    });
    expect(html).toContain('wa.me/5535988887777');
    expect(html).toContain('wa.me/553532221111');
  });

  it('sobrevive a prospect sem nome e trunca resposta longa', () => {
    const { subject, body } = formatLeadContactEmail({
      ...notice,
      prospectName: null,
      replyText: 'x'.repeat(500),
    });
    expect(subject).toMatch(/contato/i);
    expect(body).toContain('…');
  });
});

describe('respondAsProspectAgent — contato citado dispara o email', () => {
  it('número novo citado por gente → notificação com o número extraído', async () => {
    const reply = await respondAsProspectAgent(
      PROSPECT,
      'melhor falar com o Roberto: (35) 98888-7777',
      'text'
    );
    expect(reply).toBe('combinado!');
    expect(sendLeadContactNotification).toHaveBeenCalledTimes(1);
    const notice = vi.mocked(sendLeadContactNotification).mock.calls[0][0];
    expect(notice.citedPhones).toEqual(['+5535988887777']);
    expect(notice.prospectName).toBe('Coopercafé');
  });

  it('o próprio número do prospect NÃO é um contato novo', async () => {
    await respondAsProspectAgent(PROSPECT, 'me chama nesse número aqui (35) 99988-7766', 'text');
    expect(sendLeadContactNotification).not.toHaveBeenCalled();
  });

  it('número já citado antes na thread não re-dispara', async () => {
    vi.mocked(getProspectThread).mockResolvedValue([
      { direction: 'in', text: 'anota aí: 35 98888-7777' },
    ] as never);
    await respondAsProspectAgent(PROSPECT, 'consegue falar com ele no (35) 98888-7777?', 'text');
    expect(sendLeadContactNotification).not.toHaveBeenCalled();
  });

  it('robô institucional citando 0800/ramal não vira lead', async () => {
    await respondAsProspectAgent(
      PROSPECT,
      'Agradecemos seu contato! Digite 1 para comercial, 2 para técnico, ou ligue (35) 3222-1111.',
      'text'
    );
    expect(sendLeadContactNotification).not.toHaveBeenCalled();
  });

  it('falha na notificação nunca derruba a resposta', async () => {
    vi.mocked(sendLeadContactNotification).mockRejectedValue(new Error('smtp down'));
    const reply = await respondAsProspectAgent(
      PROSPECT,
      'fala com o Roberto: (35) 98888-7777',
      'text'
    );
    expect(reply).toBe('combinado!');
  });
});
