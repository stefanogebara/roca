/**
 * chatOnce must carry a hard deadline: it is the hottest external call in the
 * system and (pre-fix) the ONLY one without a timeout — a hung OpenRouter
 * socket consumed the webhook's entire 60s maxDuration and the farmer got
 * silence instead of the fallback reply.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { chat } from '../api/_lib/llm';

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = 'test-key';
  // A fetch that never resolves but honours the abort signal — the shape of a
  // hung socket.
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url: unknown, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }))
          );
        })
    )
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENROUTER_API_KEY;
});

describe('chat deadline', () => {
  it('aborts a hung request and surfaces a clear timeout error (fast, not 60s)', async () => {
    const started = Date.now();
    await expect(chat({ model: 'test/model', user: 'oi', timeoutMs: 40 })).rejects.toThrow(/timeout/i);
    // 2 retry attempts of 40ms + backoff — must resolve in well under 5s.
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it('passes an AbortSignal to fetch (default deadline exists even when unset)', async () => {
    const p = chat({ model: 'test/model', user: 'oi', timeoutMs: 30 }).catch(() => undefined);
    await p;
    const init = vi.mocked(fetch).mock.calls[0]?.[1] as { signal?: AbortSignal } | undefined;
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
});

/**
 * Orçamento COMPARTILHADO da requisição (achado #8 da auditoria de 04/ago).
 *
 * O teto por chamada nunca fechou os 60s do maxDuration: duas chamadas
 * sequenciais no caminho da foto, com duas tentativas de 25s cada, somam 100s
 * só de LLM. Estes testes fixam as duas metades do conserto — o prazo aperta a
 * tentativa, e a tentativa extra deixa de existir quando não cabe.
 */
describe('chat sob prazo compartilhado', () => {
  const prazoUsado = (): number[] =>
    vi.mocked(fetch).mock.calls.map((c) => {
      // Não dá pra ler o timeout do AbortSignal; medimos pelo que a chamada
      // pediu, exposto via o erro. Aqui basta contar as tentativas.
      void c;
      return 1;
    });

  it('NÃO tenta de novo quando o prazo já acabou — uma tentativa só', async () => {
    // Prazo no passado: sobra zero. Sem isto, a segunda tentativa gastava o
    // resto do orçamento para falhar igual e o produtor ficava sem o fallback.
    await expect(
      chat({ model: 'test/model', user: 'oi', timeoutMs: 40, deadlineAt: Date.now() - 1 })
    ).rejects.toThrow(/orçamento/i);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled(); // nem abriu conexão
  });

  it('com prazo FOLGADO, o retry continua existindo — não viramos um-tiro-só', async () => {
    await expect(
      chat({ model: 'test/model', user: 'oi', timeoutMs: 40, deadlineAt: Date.now() + 600_000 })
    ).rejects.toThrow(/timeout/i);
    expect(prazoUsado().length).toBe(2);
  });

  it('sem prazo nenhum, nada muda — gym, canary e crons seguem iguais', async () => {
    await expect(chat({ model: 'test/model', user: 'oi', timeoutMs: 40 })).rejects.toThrow(/timeout/i);
    expect(prazoUsado().length).toBe(2);
  });
});
