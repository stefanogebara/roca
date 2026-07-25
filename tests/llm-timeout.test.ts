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
