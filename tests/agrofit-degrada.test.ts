/**
 * Faltar o Agrofit degrada a resposta. Não derruba o webhook (achado #13).
 *
 * `loadAgrofit()` lançava na INICIALIZAÇÃO do módulo, e `tools/agrofit` está na
 * cadeia estática de import do webhook. Um throw ali não é erro de uma
 * requisição: é o módulo inteiro falhando ao carregar, e nenhuma requisição
 * chega a rodar. Não há try/catch a jusante que salve — os que existem estão
 * DENTRO de código que nunca é atingido.
 *
 * É exatamente a forma do apagão de 29/jul, que custou 24h de webhook fora.
 *
 * E o vizinho já ensinava o certo: `compliance.ts` carrega um arquivo igual, do
 * mesmo diretório, gerado pelo mesmo script, e quando não acha registra em log
 * alto e segue com o gate mais fraco — "a weaker gate must not take the whole
 * webhook down". Duas políticas opostas para o mesmo risco, no mesmo repo.
 *
 * A escolha aqui é a mesma: sem o registro, o `groundedHit` não acha nada, a
 * resposta sai sem o bloco do Agrofit e o produtor recebe orientação de manejo.
 * Pior que o normal, incomparavelmente melhor que silêncio.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ERROS: string[] = [];

beforeEach(() => {
  ERROS.length = 0;
  // `doMock` registrado num teste sobrevive ao próximo; sem o unmock o caso do
  // "arquivo no lugar" herdava o fs quebrado do caso anterior e passava a
  // testar a mesma coisa duas vezes.
  vi.doUnmock('node:fs');
  vi.resetModules();
});
afterEach(() => vi.restoreAllMocks());

/** Carrega o módulo com TODOS os caminhos de arquivo falhando. */
async function comArquivoAusente(): Promise<typeof import('../api/_lib/tools/agrofit')> {
  vi.doMock('node:fs', async (orig) => {
    const real = await orig<typeof import('node:fs')>();
    return {
      ...real,
      readFileSync: (p: string, ...rest: unknown[]) => {
        if (String(p).includes('agrofit.json')) throw new Error('ENOENT');
        return (real.readFileSync as (...a: unknown[]) => unknown)(p, ...rest);
      },
    };
  });
  vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => void ERROS.push(a.join(' ')));
  return import('../api/_lib/tools/agrofit');
}

describe('agrofit.json ausente', () => {
  it('o módulo CARREGA — importar não pode ser o que derruba o webhook', async () => {
    // Se voltar a lançar na init, este import rejeita e o teste falha aqui.
    await expect(comArquivoAusente()).resolves.toBeDefined();
  });

  it('grita no log — degradar calado é como um gate cego passa meses sem ninguém ver', async () => {
    await comArquivoAusente();
    expect(ERROS.join('\n')).toMatch(/agrofit/i);
  });

  it('groundedHit devolve null em vez de explodir', async () => {
    const m = await comArquivoAusente();
    expect(m.groundedHit('soja', 'ferrugem asiática', null)).toBeNull();
  });

  it('allActiveIngredients devolve lista vazia — o gate fica mais fraco, não quebrado', async () => {
    const m = await comArquivoAusente();
    expect(m.allActiveIngredients()).toEqual([]);
  });

  it('a idade vira desconhecida, e desconhecida não é "fresca"', async () => {
    // O canário precisa conseguir distinguir "não sei" de "está em dia", senão
    // o arquivo sumido passa como saudável.
    const m = await comArquivoAusente();
    expect(m.AGROFIT_GENERATED_AT).toBeNull();
    expect(m.agrofitAgeDays(new Date())).toBeNull();
  });
});

describe('com o arquivo no lugar (o caminho normal segue igual)', () => {
  it('acha a ferrugem da soja e lista ativos', async () => {
    const m = await import('../api/_lib/tools/agrofit');
    expect(m.groundedHit('soja', 'ferrugem asiática', null)).not.toBeNull();
    expect(m.allActiveIngredients().length).toBeGreaterThan(0);
  });
});
