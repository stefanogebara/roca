/**
 * Duas invocações concorrentes do webhook, UMA fala só.
 *
 * Caso real, ACAFEG em 06/ago — o melhor lead do dia respondendo "Sim":
 *
 *   19:42:55.696 in  "Sim"
 *   19:42:57.560 in  "Oi"
 *   19:43:02.397 out "Que bom falar com vocês! Hoje como chega a vocês um..."
 *   19:43:08.919 out "Que bom! Como costuma chegar cliente novo pra vocês..."
 *
 * Os logs confirmam duas invocações do webhook respondendo com 2s de intervalo
 * (19:42:50 e 19:42:52), ambas do agente. A mesma pergunta, duas vezes, para
 * quem tinha acabado de dizer sim.
 *
 * `MIN_GAP_MS`/`podeFalarDeNovo` existiam para isso e não seguraram, porque a
 * checagem é lê-e-depois-escreve: as duas invocações leram a thread ANTES de
 * qualquer uma gravar sua saída, e as duas viram "última fala nossa: 40 min
 * atrás". Nenhum freio puramente calculado resolve isso — precisa de um
 * árbitro, e o único árbitro compartilhado é o banco.
 *
 * `claimAgentTurn` é esse árbitro, no mesmo padrão que `claimProspectForSend`
 * já usa no disparo: UPDATE condicional numa instrução, quem consegue fala.
 *
 * O que este teste fixa, e por que cada um:
 *   1. a primeira reivindicação ganha e a segunda perde DENTRO da janela;
 *   2. passada a janela, o turno volta (senão a conversa morre em 20s);
 *   3. prospect que nunca falou (coluna nula) consegue falar;
 *   4. erro do banco NÃO cala a agente — perder resposta a lead quente é pior
 *      que arriscar uma duplicata, e é a mesma direção que o resto do módulo
 *      escolhe (fail-soft no que é acessório).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

interface Linha { id: string; last_agent_out_at: string | null }
let tabela: Linha[] = [];
let erroDoBanco: string | null = null;

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from() {
      const filtros: Array<(r: Linha) => boolean> = [];
      let patch: Partial<Linha> = {};
      const q: Record<string, unknown> = {
        update(p: Partial<Linha>) { patch = p; return q; },
        eq(col: string, val: unknown) { filtros.push((r) => (r as never as Record<string, unknown>)[col] === val); return q; },
        is(col: string, val: unknown) { filtros.push((r) => (r as never as Record<string, unknown>)[col] === val); return q; },
        or(expr: string) {
          // `last_agent_out_at.is.null,last_agent_out_at.lt.<iso>`
          const lt = /lt\.([^,)]+)/.exec(expr)?.[1];
          filtros.push((r) => r.last_agent_out_at === null || (!!lt && r.last_agent_out_at < lt));
          return q;
        },
        select() { return q; },
        then(res: (v: unknown) => void) {
          if (erroDoBanco) return res({ data: null, error: { message: erroDoBanco } });
          const alvo = tabela.filter((r) => filtros.every((f) => f(r)));
          for (const r of alvo) Object.assign(r, patch);
          return res({ data: alvo.map((r) => ({ id: r.id })), error: null });
        },
      };
      return q;
    },
  }),
}));

import { claimAgentTurn } from '../api/_lib/prospect/db';

const GAP = 20_000;

beforeEach(() => {
  erroDoBanco = null;
  process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave';
  tabela = [{ id: 'p1', last_agent_out_at: null }];
});

describe('claimAgentTurn', () => {
  it('prospect que nunca falou consegue o turno', async () => {
    expect(await claimAgentTurn('p1', GAP)).toBe(true);
  });

  it('DUAS invocações concorrentes: só uma fala', async () => {
    // É o caso da ACAFEG. Disparadas juntas, sem await entre elas.
    const [a, b] = await Promise.all([claimAgentTurn('p1', GAP), claimAgentTurn('p1', GAP)]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });

  it('passada a janela, o turno volta — senão a conversa morre', async () => {
    tabela[0].last_agent_out_at = new Date(Date.now() - GAP - 1000).toISOString();
    expect(await claimAgentTurn('p1', GAP)).toBe(true);
  });

  it('dentro da janela, não fala de novo', async () => {
    tabela[0].last_agent_out_at = new Date(Date.now() - 2000).toISOString();
    expect(await claimAgentTurn('p1', GAP)).toBe(false);
  });

  it('banco fora NÃO cala a agente', async () => {
    // Fail-soft deliberado: uma duplicata eventual é recuperável; silêncio
    // para um lead quente por causa de hiccup de banco, não.
    erroDoBanco = 'connection reset';
    expect(await claimAgentTurn('p1', GAP)).toBe(true);
  });
});

/**
 * A LIGAÇÃO, não só a função.
 *
 * Descoberto ao verificar: neutralizando a chamada no `respondAsProspectAgent`
 * (trocando a condição por `if (false)`), a suíte inteira seguiu verde — o
 * unitário acima cobre `claimAgentTurn`, e ninguém cobria o fio que a usa. Um
 * conserto que o teste não vê é um conserto que a próxima refatoração apaga.
 */
describe('respondAsProspectAgent respeita a reivindicação', () => {
  it('perdeu o turno → cala, e NÃO gasta chamada de LLM', async () => {
    vi.resetModules();
    const buildAgentReply = vi.fn();
    vi.doMock('../api/_lib/prospect/db', () => ({
      logProspectMessage: vi.fn(async () => undefined),
      getProspectThread: vi.fn(async () => []),
      mergeProspectQualification: vi.fn(async () => undefined),
      setProspectAgentEnabled: vi.fn(async () => undefined),
      bumpPorteiroTentativas: vi.fn(async () => undefined),
      claimAgentTurn: vi.fn(async () => false), // outra invocação está falando
    }));
    vi.doMock('../api/_lib/prospect/agent', async (orig) => ({
      ...(await orig<typeof import('../api/_lib/prospect/agent')>()),
      buildAgentReply,
      extractQualification: vi.fn(async () => null),
    }));
    vi.doMock('../api/_lib/alert', () => ({ alertFounders: vi.fn() }));
    vi.doMock('../api/_lib/notify', () => ({
      sendProspectReplyNotification: vi.fn(),
      sendLeadContactNotification: vi.fn(),
    }));

    const { respondAsProspectAgent } = await import('../api/_lib/prospect/inbound');
    const r = await respondAsProspectAgent(
      { id: 'p1', name: 'ACAFEG', porteiro_tentativas: 0, agent_enabled: true } as never,
      'Sim',
      'text'
    );

    expect(r).toBeNull();
    expect(buildAgentReply).not.toHaveBeenCalled();
    vi.doUnmock('../api/_lib/prospect/db');
    vi.doUnmock('../api/_lib/prospect/agent');
  });
});
