/**
 * Telemetria não pode matar a instância.
 *
 * `void algumaEscrita(...)` parece inofensivo e não é: se a promise rejeitar,
 * ninguém tem handler, e no Node 22 unhandled rejection derruba o processo por
 * padrão. No Fluid Compute a instância é REUSADA entre requisições concorrentes
 * — então uma gravação de telemetria falhando pode derrubar a resposta de OUTRO
 * produtor que estava em voo na mesma instância. O produtor pagaria o preço de
 * um dado que existe só pra nós.
 *
 * A regra: quem dispara sem esperar tem que segurar o erro.
 *
 * O helper recebe um thunk, não uma promise, de propósito: `getDb()` lança na
 * hora quando falta env, e um throw ao MONTAR a chamada escaparia de qualquer
 * catch que só olhasse a promise já pronta.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireAndForget } from '../api/_lib/fireAndForget';

/** Deixa o loop virar — unhandledRejection só dispara depois do microtask queue. */
const proximoTick = () => new Promise((r) => setImmediate(r));

/** Observa rejeições soltas de verdade, em vez de acreditar que não existem. */
async function rejeicoesSoltas(fn: () => void): Promise<unknown[]> {
  const soltas: unknown[] = [];
  const capturar = (e: unknown) => soltas.push(e);
  process.on('unhandledRejection', capturar);
  try {
    fn();
    await proximoTick();
    await proximoTick();
  } finally {
    process.off('unhandledRejection', capturar);
  }
  return soltas;
}

/** O logger escreve em stderr, não em console.error. */
function espiaStderr() {
  return vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
}

describe('fireAndForget', () => {
  it('promise que rejeita NÃO vira unhandled rejection', async () => {
    const stderr = espiaStderr();
    const soltas = await rejeicoesSoltas(() => {
      fireAndForget(() => Promise.reject(new Error('banco caiu')), 'triagem');
    });
    expect(soltas).toEqual([]);
    stderr.mockRestore();
  });

  it('sem o helper a rejeição escapa — a prova de que o teste acima mede algo', async () => {
    const soltas = await rejeicoesSoltas(() => {
      // Exatamente o padrão que estamos eliminando do código.
      void Promise.reject(new Error('banco caiu'));
    });
    expect(soltas).toHaveLength(1);
  });

  it('throw síncrono ao montar a chamada também é contido', async () => {
    const stderr = espiaStderr();
    const soltas = await rejeicoesSoltas(() => {
      // getDb() lança quando falta SUPABASE_URL — foi daí que nasceram as 4
      // rejeições soltas que o pipeline.test.ts reporta hoje.
      expect(() => fireAndForget(() => { throw new Error('sem env'); }, 'db')).not.toThrow();
    });
    expect(soltas).toEqual([]);
    stderr.mockRestore();
  });

  it('loga com escopo e motivo — falha silenciosa é pior que falha', async () => {
    const stderr = espiaStderr();
    await rejeicoesSoltas(() => {
      fireAndForget(() => Promise.reject(new Error('banco caiu')), 'triage_events');
    });
    const linhas = stderr.mock.calls.map((c) => String(c[0])).join('\n');
    expect(linhas).toContain('triage_events');
    expect(linhas).toContain('banco caiu');
    stderr.mockRestore();
  });

  it('promise que resolve não loga nada', async () => {
    const stderr = espiaStderr();
    await rejeicoesSoltas(() => {
      fireAndForget(() => Promise.resolve(), 'triagem');
    });
    expect(stderr).not.toHaveBeenCalled();
    stderr.mockRestore();
  });

  it('não espera a promise — o produtor não paga a latência da telemetria', async () => {
    let terminou = false;
    const lenta = new Promise<void>((r) => setTimeout(() => { terminou = true; r(); }, 50));
    fireAndForget(() => lenta, 'lenta');
    // Se o helper tivesse await, esta linha só rodaria depois dos 50ms.
    expect(terminou).toBe(false);
    await lenta;
  });
});
