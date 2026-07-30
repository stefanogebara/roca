/**
 * Juiz pareado. O relatório da Olímpia mediu que a nota absoluta 1-5 varia
 * ±1,4 no MESMO cenário — ruído demais para decidir promoção de prompt. A
 * comparação head-to-head troca "quão boa foi?" por "qual das duas foi
 * melhor?", que é a pergunta que a gente realmente precisa responder.
 *
 * O ponto de maior risco é o desembaralhamento: quando a posição é trocada, o
 * "primeiro" do juiz é a nossa versão B. Errar isso inverte TODA a conclusão
 * silenciosamente — por isso é o que este arquivo testa mais.
 */
import { describe, it, expect } from 'vitest';
import {
  posicaoTrocada,
  resolverVoto,
  apurarLentes,
  apurarCenarios,
  PAIRED_LENSES,
  parearCenarios,
  escolherPar,
  rodadaInvalida,
} from '../api/_lib/prospect/gymPaired';

describe('posicaoTrocada — embaralhar sem sorteio', () => {
  it('é determinística: mesma dupla (cenário, lente) dá sempre o mesmo lado', () => {
    const a = posicaoTrocada('dono_ocupado', 'naturalidade');
    for (let i = 0; i < 20; i++) {
      expect(posicaoTrocada('dono_ocupado', 'naturalidade')).toBe(a);
    }
  });

  it('varia entre lentes do mesmo cenário — senão o viés de posição não é cancelado', () => {
    const lados = PAIRED_LENSES.map((l) => posicaoTrocada('dono_ocupado', l.key));
    expect(new Set(lados).size).toBeGreaterThan(1);
  });

  it('varia entre cenários — um viés constante seria pior que sorteio', () => {
    const cenarios = ['dono_ocupado', 'cetico_preco', 'bot_detector', 'monossilabico', 'indicacao'];
    const lados = cenarios.map((c) => posicaoTrocada(c, 'naturalidade'));
    expect(new Set(lados).size).toBe(2);
  });
});

describe('resolverVoto — o desembaralhamento, onde um erro inverte tudo', () => {
  it('sem troca: primeiro = A, segundo = B', () => {
    expect(resolverVoto('primeiro', false)).toBe('A');
    expect(resolverVoto('segundo', false)).toBe('B');
  });

  it('COM troca: primeiro = B, segundo = A', () => {
    expect(resolverVoto('primeiro', true)).toBe('B');
    expect(resolverVoto('segundo', true)).toBe('A');
  });

  it('empate é empate dos dois lados', () => {
    expect(resolverVoto('empate', false)).toBe('empate');
    expect(resolverVoto('empate', true)).toBe('empate');
  });

  it('resposta fora do contrato vira empate, nunca uma vitória inventada', () => {
    expect(resolverVoto('sei la' as never, false)).toBe('empate');
    expect(resolverVoto('' as never, true)).toBe('empate');
  });
});

describe('apurarLentes — maioria simples entre as 3 lentes', () => {
  const voto = (vencedor: 'A' | 'B' | 'empate') => ({ lente: 'x', vencedor, motivo: '' });

  it('2 de 3 decide', () => {
    expect(apurarLentes([voto('A'), voto('A'), voto('B')])).toBe('A');
    expect(apurarLentes([voto('B'), voto('B'), voto('A')])).toBe('B');
  });

  it('unânime decide', () => {
    expect(apurarLentes([voto('B'), voto('B'), voto('B')])).toBe('B');
  });

  it('sem maioria é empate — não desempata no grito', () => {
    expect(apurarLentes([voto('A'), voto('B'), voto('empate')])).toBe('empate');
    expect(apurarLentes([voto('empate'), voto('empate'), voto('empate')])).toBe('empate');
  });

  it('empates não contam como voto para ninguém', () => {
    // 1 A, 2 empates: A tem mais votos que B, mas não tem maioria das lentes.
    expect(apurarLentes([voto('A'), voto('empate'), voto('empate')])).toBe('empate');
  });
});

describe('apurarCenarios — promoção por vitórias, não por média', () => {
  const r = (persona: string, vencedor: 'A' | 'B' | 'empate') => ({ persona, vencedor, votos: [] });

  it('conta vitórias de cada lado', () => {
    const t = apurarCenarios([r('p1', 'B'), r('p2', 'B'), r('p3', 'A'), r('p4', 'empate')]);
    expect(t).toMatchObject({ a: 1, b: 2, empates: 1, total: 4 });
  });

  it('vence quem ganhou mais cenários', () => {
    expect(apurarCenarios([r('p1', 'B'), r('p2', 'B'), r('p3', 'A')]).vencedor).toBe('B');
  });

  it('empate em cenários = empate geral: sem sinal, não promove', () => {
    expect(apurarCenarios([r('p1', 'A'), r('p2', 'B')]).vencedor).toBe('empate');
    expect(apurarCenarios([]).vencedor).toBe('empate');
  });
});

describe('PAIRED_LENSES — as três lentes', () => {
  it('inclui a lente de correção, que é a disciplina que falhou em 28/jul', () => {
    expect(PAIRED_LENSES.map((l) => l.key)).toContain('correcao');
  });
  it('são exatamente 3 — maioria simples precisa de número ímpar', () => {
    expect(PAIRED_LENSES).toHaveLength(3);
    expect(PAIRED_LENSES.length % 2).toBe(1);
  });
  it('cada lente diz ao juiz o que olhar', () => {
    for (const l of PAIRED_LENSES) {
      expect(l.pergunta.length, l.key).toBeGreaterThan(40);
    }
  });
});

describe('parearCenarios — casar duas rodadas persona a persona', () => {
  const run = (keys: string[]) => keys.map((k) => ({ persona: k, transcript: [{ role: 'vitoria', text: k }] }));

  it('casa só o que existe nos dois lados', () => {
    const pares = parearCenarios(run(['a', 'b', 'c']) as never, run(['b', 'c', 'd']) as never);
    expect(pares.map((p) => p.persona)).toEqual(['b', 'c']);
  });

  it('mantém a ordem da rodada A — leitura estável entre execuções', () => {
    const pares = parearCenarios(run(['c', 'a', 'b']) as never, run(['a', 'b', 'c']) as never);
    expect(pares.map((p) => p.persona)).toEqual(['c', 'a', 'b']);
  });

  it('cada par carrega as DUAS transcrições, e não as troca', () => {
    const [p] = parearCenarios(
      [{ persona: 'x', transcript: [{ role: 'vitoria', text: 'sou o A' }] }] as never,
      [{ persona: 'x', transcript: [{ role: 'vitoria', text: 'sou o B' }] }] as never
    );
    expect(p.a[0].text).toBe('sou o A');
    expect(p.b[0].text).toBe('sou o B');
  });

  it('sem interseção não inventa comparação', () => {
    expect(parearCenarios(run(['a']) as never, run(['z']) as never)).toEqual([]);
  });
});

/**
 * Rodada carimbada como inválida não serve de base de comparação.
 *
 * 29/jul o gym rodou sem crédito no OpenRouter: nenhuma conversa aconteceu,
 * nenhum juízo rodou, e a linha foi gravada com médias 0. Carimbei
 * `medias.invalida` e nada lia o carimbo — então `gym:vitoria:paired` sem
 * argumentos compararia a rodada nova contra o vazio, e o placar sairia com
 * cara de conclusão. É o padrão do dia inteiro: o dado existia e não estava
 * ligado na decisão.
 *
 * Recusar é melhor que comparar errado. Um placar 12×0 contra nada é pior que
 * nenhum placar, porque parece resposta.
 */
describe('escolherPar — rodada inválida nunca entra na comparação', () => {
  const r = (id: string, min: number, invalida?: string) => ({
    id,
    ran_at: new Date(Date.UTC(2026, 6, 29, 22, min)).toISOString(),
    medias: invalida ? { invalida } : { missao: 4 },
  });

  it('pula a inválida e pega as duas válidas mais recentes', () => {
    const [a, b] = escolherPar([r('nova', 47, 'sem credito'), r('boa2', 36), r('boa1', 15), r('velha', 5)]);
    expect([a.id, b.id]).toEqual(['boa1', 'boa2']);
  });

  it('A é a mais ANTIGA — inverter isso inverteria toda a conclusão', () => {
    const [a, b] = escolherPar([r('depois', 40), r('antes', 10)]);
    expect(a.id).toBe('antes');
    expect(b.id).toBe('depois');
  });

  it('recusa quando não sobram duas válidas, e diz que foi por inválida', () => {
    expect(() => escolherPar([r('nova', 47, 'sem credito'), r('boa', 36)])).toThrow(/inválida/i);
  });

  it('recusa a inválida mesmo quando pedida pelo id, e nomeia qual', () => {
    // Comparar contra uma rodada onde nada rodou não fica válido só porque
    // alguém digitou o id.
    expect(() => escolherPar([r('boa', 36), r('a5b46c09', 47, 'sem credito')])).toThrow(/a5b46c09/);
  });

  it('rodadaInvalida devolve o motivo carimbado', () => {
    expect(rodadaInvalida(r('x', 1, 'OpenRouter 402'))).toBe('OpenRouter 402');
    expect(rodadaInvalida(r('y', 1))).toBeNull();
  });
});
