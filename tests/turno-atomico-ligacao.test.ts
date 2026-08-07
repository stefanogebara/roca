/**
 * A LIGAÇÃO da reivindicação de turno, não só a função.
 *
 * Descoberto ao verificar o conserto de 07/ago: neutralizando a chamada dentro
 * de `respondAsProspectAgent` (trocando a condição por `if (false)`), a suíte
 * inteira seguia VERDE. O unitário cobria `claimAgentTurn` e ninguém cobria o
 * fio que a usa — um conserto que o teste não vê é um conserto que a próxima
 * refatoração apaga sem ninguém notar.
 *
 * Arquivo separado de propósito: `turno-atomico.test.ts` mocka o cliente do
 * Supabase no topo para exercitar o UPDATE condicional de verdade. Misturar os
 * dois cenários no mesmo arquivo exigia `resetModules` no meio do teste, o que
 * passava isolado e quebrava na suíte completa (registro de módulos
 * compartilhado). Um arquivo, um regime de mock.
 */
import { describe, it, expect, vi } from 'vitest';

// vi.hoisted porque vi.mock e ICADO pro topo do arquivo: uma const comum
// ainda nao existe quando a fabrica do mock roda (ReferenceError).
const { buildAgentReply } = vi.hoisted(() => ({ buildAgentReply: vi.fn() }));

vi.mock('../api/_lib/prospect/db', () => ({
  logProspectMessage: vi.fn(async () => undefined),
  getProspectThread: vi.fn(async () => []),
  mergeProspectQualification: vi.fn(async () => undefined),
  setProspectAgentEnabled: vi.fn(async () => undefined),
  bumpPorteiroTentativas: vi.fn(async () => undefined),
  // Perdeu a corrida: outra invocação do webhook já está falando.
  claimAgentTurn: vi.fn(async () => false),
}));
vi.mock('../api/_lib/prospect/agent', async (orig) => ({
  ...(await orig<typeof import('../api/_lib/prospect/agent')>()),
  buildAgentReply,
  extractQualification: vi.fn(async () => null),
}));
vi.mock('../api/_lib/alert', () => ({ alertFounders: vi.fn() }));
vi.mock('../api/_lib/notify', () => ({
  sendProspectReplyNotification: vi.fn(),
  sendLeadContactNotification: vi.fn(),
}));

import { respondAsProspectAgent } from '../api/_lib/prospect/inbound';

describe('respondAsProspectAgent respeita a reivindicação', () => {
  it('perdeu o turno → cala, e NÃO gasta chamada de LLM', async () => {
    const r = await respondAsProspectAgent(
      { id: 'p1', name: 'ACAFEG', porteiro_tentativas: 0, agent_enabled: true } as never,
      'Sim',
      'text'
    );

    expect(r).toBeNull();
    // O claim vem ANTES do buildAgentReply justamente para a perdedora não
    // pagar o modelo. Se alguém inverter a ordem, este expect cai.
    expect(buildAgentReply).not.toHaveBeenCalled();
  });
});
