/**
 * Orçamento de tempo da requisição (achado #8 da auditoria de 04/ago).
 *
 * O caminho da foto não fechava nos 60s de `maxDuration`:
 *
 *   fetchMedia (8s meta + 12s bytes)          20s
 *   identifyFromPhoto  25s × 2 tentativas     50s
 *   composição         25s × 2 tentativas     50s
 *                                            ----
 *                                            120s
 *
 * E o docstring do `llm.ts` dizia que 25s "leaves room for one retry inside the
 * budget" — 25×2 já é 50s sozinho. Mais um caso de comentário descrevendo o
 * comportamento correto enquanto o código faz outro.
 *
 * Apertar cada timeout não resolve: duas chamadas com duas tentativas cada
 * sempre estouram. O que resolve é um prazo COMPARTILHADO — cada chamada só
 * pode gastar o que sobrou, e a tentativa extra só existe se couber.
 *
 * Estourar o maxDuration é o pior desfecho do produto: a função morre, não há
 * throw para o catch de topo pegar, e o produtor não recebe nem o fallback.
 * Melhor uma resposta pior dentro do prazo do que a resposta certa em 90s que
 * ninguém vai ler.
 */
import { describe, it, expect } from 'vitest';
import {
  restanteMs,
  prazoDaTentativa,
  cabeOutraTentativa,
  comPrazo,
  prazoAtual,
  MARGEM_MS,
} from '../api/_lib/orcamento';

const T0 = 1_000_000;

describe('restanteMs', () => {
  it('desconta a margem — o que sobra tem que dar pra responder e persistir', () => {
    expect(restanteMs(T0 + 30_000, T0)).toBe(30_000 - MARGEM_MS);
  });

  it('sem prazo devolve null — é o comportamento de hoje, preservado', () => {
    // Todo call site que não passa deadline (gym, canary, crons) segue igual.
    expect(restanteMs(undefined, T0)).toBeNull();
  });

  it('nunca é negativo', () => {
    expect(restanteMs(T0 - 60_000, T0)).toBe(0);
  });

  it('prazo já dentro da margem vira zero, não um resto minúsculo', () => {
    expect(restanteMs(T0 + MARGEM_MS - 1, T0)).toBe(0);
  });
});

describe('prazoDaTentativa', () => {
  it('sem prazo, o pedido vale como está', () => {
    expect(prazoDaTentativa(25_000, null)).toBe(25_000);
  });

  it('com folga de sobra, o pedido vale como está — o prazo é teto, não meta', () => {
    expect(prazoDaTentativa(25_000, 40_000)).toBe(25_000);
  });

  it('aperta para o que sobrou quando o pedido não cabe', () => {
    expect(prazoDaTentativa(25_000, 9_000)).toBe(9_000);
  });
});

describe('cabeOutraTentativa', () => {
  it('sem prazo, sempre cabe — retry de hoje inalterado fora do webhook', () => {
    expect(cabeOutraTentativa(null)).toBe(true);
  });

  it('não cabe quando o resto não paga nem uma tentativa útil', () => {
    // Repetir com 1s é queimar o que sobrou para falhar de novo: o produtor
    // fica sem o fallback, que é o pior desfecho.
    expect(cabeOutraTentativa(1_000)).toBe(false);
    expect(cabeOutraTentativa(0)).toBe(false);
  });

  it('cabe quando ainda há tempo real', () => {
    expect(cabeOutraTentativa(20_000)).toBe(true);
  });
});

describe('o caminho da foto agora fecha nos 60s', () => {
  it('duas chamadas sequenciais nunca somam mais que o orçamento', () => {
    // Simula o pior caso: identify e compose, cada uma pedindo 25s, com o
    // relógio andando o máximo permitido a cada etapa.
    const ORCAMENTO = 60_000;
    const inicio = T0;
    const prazoFinal = inicio + ORCAMENTO;
    let agora = inicio + 20_000; // fetchMedia consumiu o pior caso dela

    let gastoTotal = 20_000;
    for (const _etapa of ['identify', 'compose']) {
      let restante = restanteMs(prazoFinal, agora);
      // Tentativa 1
      let prazo = prazoDaTentativa(25_000, restante);
      agora += prazo;
      gastoTotal += prazo;
      // Tentativa 2, só se couber
      restante = restanteMs(prazoFinal, agora);
      if (cabeOutraTentativa(restante)) {
        prazo = prazoDaTentativa(25_000, restante);
        agora += prazo;
        gastoTotal += prazo;
      }
    }

    expect(gastoTotal).toBeLessThanOrEqual(ORCAMENTO - MARGEM_MS);
  });
});

/**
 * Isolamento por requisição.
 *
 * No Fluid Compute a MESMA instância atende requisições concorrentes. Com o
 * prazo numa variável de módulo, o produtor que chegou depois herdaria o prazo
 * de quem chegou antes — já vencido — e levaria silêncio por causa do relógio
 * de outra pessoa. É a mesma família do bug da rejeição não tratada, que
 * derrubava requisições de terceiros. Este teste é o que separa as duas
 * implementações: com estado de módulo ele falha.
 */
describe('comPrazo — um prazo por cadeia assíncrona', () => {
  it('duas requisições concorrentes não trocam prazo entre si', async () => {
    const visto: Record<string, number | undefined> = {};

    const requisicao = (nome: string, prazo: number, espera: number) =>
      comPrazo(prazo, async () => {
        await new Promise((r) => setTimeout(r, espera));
        visto[nome] = prazoAtual(); // lido DEPOIS do await, com a outra em voo
      });

    // A "b" começa depois e termina antes: se houvesse estado compartilhado, a
    // "a" acordaria enxergando o prazo da "b".
    await Promise.all([requisicao('a', 111, 30), requisicao('b', 222, 5)]);

    expect(visto.a).toBe(111);
    expect(visto.b).toBe(222);
  });

  it('fora de qualquer requisição não há prazo — crons e scripts seguem livres', () => {
    expect(prazoAtual()).toBeUndefined();
  });
});
