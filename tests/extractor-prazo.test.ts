/**
 * Todo extractor barato pede prazo curto.
 *
 * O docstring do `timeoutMs` no `llm.ts` sempre pediu que "cheap
 * router/extraction calls" passassem algo mais apertado (~10s). Na auditoria de
 * 04/ago a contagem deu ZERO: nenhum call site do repositório passava
 * `timeoutMs`. Mais um caso da família que já custou caro aqui — o comentário
 * descreve o comportamento correto e o código faz outro.
 *
 * O default de 25s numa extração que devolve 12 tokens não é generosidade: é
 * orçamento roubado da composição, que é a chamada que de fato precisa dele.
 *
 * Este teste lê o FONTE de propósito. Um teste de comportamento passaria a
 * cobrir só os extractors que alguém lembrou de exercitar; o que apodreceu aqui
 * foi justamente a chamada nova que ninguém ligou ao teste. A regra é
 * topológica, então a verificação também é.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/** Arquivos com chamada de LLM no caminho de uma requisição (fora gym/canary,
 * que rodam sem orçamento de webhook e podem esperar). */
const EXTRACTORS = [
  'api/_lib/router.ts',
  'api/_lib/location.ts',
  'api/_lib/reason.ts',
  'api/_lib/brief.ts',
  'api/_lib/tools/applicationParse.ts',
  'api/_lib/prospect/agent.ts',
];

/** Um bloco `chat({ ... })`, do abre-chaves ao fecha correspondente. */
function blocosDeChat(fonte: string): string[] {
  const blocos: string[] = [];
  for (let i = fonte.indexOf('chat({'); i !== -1; i = fonte.indexOf('chat({', i + 1)) {
    let nivel = 0;
    let j = fonte.indexOf('{', i);
    const inicio = j;
    for (; j < fonte.length; j++) {
      if (fonte[j] === '{') nivel++;
      else if (fonte[j] === '}' && --nivel === 0) break;
    }
    blocos.push(fonte.slice(inicio, j + 1));
  }
  return blocos;
}

describe('prazo dos extractors baratos', () => {
  for (const arquivo of EXTRACTORS) {
    it(`${arquivo}: toda chamada barata (router tier) passa timeoutMs`, () => {
      const blocos = blocosDeChat(readFileSync(arquivo, 'utf8'));
      expect(blocos.length).toBeGreaterThan(0); // o parser não pode ficar mudo
      const baratos = blocos.filter((b) => b.includes('MODELS.router()'));
      for (const b of baratos) {
        expect(b, `chat() do tier barato sem timeoutMs em ${arquivo}`).toMatch(/timeoutMs:/);
      }
    });
  }

  it('o prazo pedido é curto de verdade — 10s, não 25s disfarçado', () => {
    for (const arquivo of EXTRACTORS) {
      for (const b of blocosDeChat(readFileSync(arquivo, 'utf8'))) {
        const m = b.match(/timeoutMs:\s*([\d_]+)/);
        if (m) expect(Number(m[1].replace(/_/g, ''))).toBeLessThanOrEqual(12_000);
      }
    }
  });
});
