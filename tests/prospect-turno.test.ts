/**
 * A decisão de turno, separada dos efeitos.
 *
 * Por que existe: o gym chamava `buildAgentReply` DIRETO, sem passar pelo
 * `respondAsProspectAgent` — onde moram o porteiro, o teto de cadência e o
 * gate de agente desligado. Resultado: rodei o pareado duas vezes sobre
 * mudanças que o harness não exercitava, e ele devolveu vereditos confiantes
 * sobre nada ("reverta a mudança", num par de rodadas comportamentalmente
 * idênticas).
 *
 * A nota absoluta era ruidosa; o pareado era ruidoso E convincente. Pior.
 *
 * `decidirTurno` é pura: recebe o estado, devolve o que fazer. O caminho de
 * produção soma os efeitos (gravar, alertar, contar tentativa); o gym usa a
 * mesma decisão sem efeito nenhum. Um harness que não passa pelos freios
 * testa o cérebro sem os freios.
 */
import { describe, it, expect } from 'vitest';
import { decidirTurno, PORTEIRO_MAX, MIN_GAP_MS } from '../api/_lib/prospect/agent';

const AGORA = new Date('2026-07-29T15:00:00Z');
const base = { thread: [], inboundText: 'oi, tudo bem?', tentativas: 0, agenteLigado: true, agora: AGORA };
const MENU = 'Bem-vindo(a) à Agro.com! Por favor, digite a opção desejada para continuar: 1 Vendas 2 Financeiro';

describe('decidirTurno — humano comum', () => {
  it('responde, sem dica de robô', () => {
    const d = decidirTurno(base);
    expect(d.acao).toBe('responder');
    if (d.acao === 'responder') expect(d.turno).toEqual({ robo: false, tentativa: 0 });
  });
});

describe('decidirTurno — agente desligado (fundador assumiu)', () => {
  it('cala, e diz que é takeover humano', () => {
    const d = decidirTurno({ ...base, agenteLigado: false });
    expect(d.acao).toBe('humano-assumiu');
  });

  it('takeover vence tudo — nem porteiro nem cadência importam', () => {
    const d = decidirTurno({ ...base, agenteLigado: false, inboundText: MENU });
    expect(d.acao).toBe('humano-assumiu');
  });
});

describe('decidirTurno — porteiro', () => {
  it('robô com tentativa sobrando: responde COM a dica', () => {
    const d = decidirTurno({ ...base, inboundText: MENU, tentativas: 0 });
    expect(d.acao).toBe('responder');
    if (d.acao === 'responder') expect(d.turno).toEqual({ robo: true, tentativa: 0 });
  });

  it('robô com tentativas esgotadas: parqueia', () => {
    const d = decidirTurno({ ...base, inboundText: MENU, tentativas: PORTEIRO_MAX });
    expect(d.acao).toBe('porteiro-esgotado');
  });

  it('eco literal também conta como robô', () => {
    const d = decidirTurno({
      ...base,
      thread: [{ direction: 'in', text: MENU, created_at: '2026-07-29T14:00:00Z' }] as never,
      inboundText: MENU,
    });
    expect(d.acao).toBe('responder');
    if (d.acao === 'responder') expect(d.turno.robo).toBe(true);
  });
});

describe('decidirTurno — teto de cadência', () => {
  const recem = [{ direction: 'out', text: 'acabei de falar', created_at: '2026-07-29T14:59:55Z' }];
  const antigo = [{ direction: 'out', text: 'falei há um tempo', created_at: '2026-07-29T14:58:00Z' }];

  it('segura quando a gente acabou de falar', () => {
    const d = decidirTurno({ ...base, thread: recem as never });
    expect(d.acao).toBe('segurar-cadencia');
  });

  it('libera passado o intervalo', () => {
    expect(decidirTurno({ ...base, thread: antigo as never }).acao).toBe('responder');
  });

  it('o intervalo é o MIN_GAP_MS declarado, não um número solto', () => {
    const limite = new Date(AGORA.getTime() - MIN_GAP_MS);
    const noLimite = [{ direction: 'out', text: 'x', created_at: limite.toISOString() }];
    expect(decidirTurno({ ...base, thread: noLimite as never }).acao).toBe('responder');
  });

  it('cadência NÃO segura quando é robô — parquear é mais importante que esperar', () => {
    const d = decidirTurno({ ...base, thread: recem as never, inboundText: MENU, tentativas: PORTEIRO_MAX });
    expect(d.acao).toBe('porteiro-esgotado');
  });
});

describe('decidirTurno — ordem de precedência é explícita', () => {
  it('takeover > porteiro > cadência > responder', () => {
    const menuRecente = {
      ...base,
      agenteLigado: false,
      inboundText: MENU,
      tentativas: PORTEIRO_MAX,
      thread: [{ direction: 'out', text: 'x', created_at: '2026-07-29T14:59:59Z' }] as never,
    };
    expect(decidirTurno(menuRecente).acao).toBe('humano-assumiu');
    expect(decidirTurno({ ...menuRecente, agenteLigado: true }).acao).toBe('porteiro-esgotado');
  });
});
