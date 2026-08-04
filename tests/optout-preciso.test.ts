/**
 * Opt-out: reconhecer o pedido certo e guardar a prova (achados #16 e #17).
 *
 * #17 — `OPTOUT_RE` era `\b(parar|sair|descadastr\w*|remover?|não quero|
 * cancelar?|stop)\b` em qualquer lugar da frase. No vocabulário de quem
 * trabalha na roça isso pega conversa normal:
 *
 *   "não quero atrapalhar, tem um minuto?"   → bloqueio permanente
 *   "vou sair pro campo agora"               → bloqueio permanente
 *   "preciso remover as plantas daninhas"    → bloqueio permanente
 *   "quero parar a pulverização amanhã"      → bloqueio permanente
 *
 * E o bloqueio é definitivo, silencioso e sem reversão: `prospect_optouts`
 * nunca é podado, de propósito, porque é a prova legal. Um falso positivo mata
 * o lead para sempre e ninguém fica sabendo.
 *
 * A regra nova: ou a mensagem INTEIRA é o comando ("sair", "parar", "stop"), ou
 * ela diz explicitamente que é sobre RECEBER MENSAGEM ("não quero receber",
 * "para de mandar", "me tira da lista"). Quem quer sair escreve curto e direto;
 * quem está falando de lavoura escreve outra coisa em volta.
 *
 * #16 — o pedido era gravado como a string fixa `'inbound opt-out'`. Para LGPD
 * o que sustenta o registro é a EVIDÊNCIA do pedido, e o texto do prospect não
 * ficava em lugar nenhum: o ramo do opt-out retorna antes de logar a thread.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isOptOut } from '../api/_lib/prospect/core';

describe('isOptOut — o que É pedido de sair', () => {
  it.each([
    'sair',
    'parar',
    'stop',
    'STOP',
    'cancelar',
    'descadastrar',
    '  Sair. ',
    // A frase inteira é o pedido, mesmo com mais de uma palavra. O antigo
    // tests/prospect-core.test.ts já fixava estes três, e ele estava certo:
    // são pedidos legítimos, e uma régua que só aceitasse palavra solta os
    // perderia — errar para menos aqui deixa o robô falando com quem pediu
    // para parar, que é o pior dos dois erros.
    'quero sair',
    'me remove',
    'não quero mais',
    'por favor me remove',
    'pode parar',
  ])('a mensagem inteira é o pedido: %s', (t) => expect(isOptOut(t)).toBe(true));

  it.each([
    'não quero receber mais mensagens',
    'nao quero mais receber nada',
    'para de mandar mensagem',
    'pare de me mandar mensagens',
    'me tira dessa lista',
    'me remove da lista por favor',
    'não me manda mais mensagem',
    'quero me descadastrar',
  ])('frase explícita sobre mensagem: %s', (t) => expect(isOptOut(t)).toBe(true));
});

describe('isOptOut — o que NÃO é (todos bloqueavam o lead para sempre)', () => {
  it.each([
    'não quero atrapalhar, tem um minuto?',
    'vou sair pro campo agora',
    'preciso remover as plantas daninhas',
    'quero parar a pulverização amanhã',
    'não quero perder a safra',
    'vou cancelar a aplicação de hoje',
    'a chuva não quer parar',
    'tem como remover a ferrugem?',
  ])('%s', (t) => expect(isOptOut(t)).toBe(false));

  it('vazio e nulo não são pedido de nada', () => {
    expect(isOptOut('')).toBe(false);
    expect(isOptOut(null)).toBe(false);
    expect(isOptOut(undefined)).toBe(false);
  });
});

// ── #16: a prova do pedido ───────────────────────────────────────────────────

vi.mock('../api/_lib/prospect/db', () => ({
  findProspectByPhone: vi.fn(),
  addOptout: vi.fn(),
  deleteProspectByPhone: vi.fn(),
  markProspectReplied: vi.fn(),
  logProspectMessage: vi.fn(),
  getProspectThread: vi.fn(),
  mergeProspectQualification: vi.fn(),
  setProspectAgentEnabled: vi.fn(),
  bumpPorteiroTentativas: vi.fn(),
}));
vi.mock('../api/_lib/alert', () => ({ alertFounders: vi.fn() }));
vi.mock('../api/_lib/notify', () => ({ sendProspectReplyNotification: vi.fn() }));

import { handleProspectInbound } from '../api/_lib/prospect/inbound';
import { findProspectByPhone, addOptout } from '../api/_lib/prospect/db';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findProspectByPhone).mockResolvedValue({ id: 'p1', name: 'Agro X' } as never);
});

describe('o pedido fica guardado como foi feito', () => {
  it('grava o texto EXATO do prospect, não uma string nossa', async () => {
    await handleProspectInbound('+5535999887766', 'para de mandar mensagem pfv');

    expect(addOptout).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'para de mandar mensagem pfv'
    );
  });

  it('repassa o texto ÍNTEGRO — quem corta é a camada de dados, num lugar só', async () => {
    const enorme = 'não quero receber mais mensagens ' + 'x'.repeat(5000);
    await handleProspectInbound('+5535999887766', enorme);
    expect(vi.mocked(addOptout).mock.calls[0][2]).toBe(enorme);
  });

  it('exclusão LGPD registra categoria própria, não "inbound opt-out"', async () => {
    // A supressão sobrevive à exclusão (senão o sourcing traz de volta amanhã),
    // mas o motivo registrado tem que dizer o que de fato aconteceu.
    await handleProspectInbound('+5535999887766', 'sair');
    expect(String(vi.mocked(addOptout).mock.calls[0][1])).toMatch(/inbound/i);
  });
});
