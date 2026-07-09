import { describe, it, expect } from 'vitest';
import { withRetry, isTransient } from '../api/_lib/retry';

const noSleep = async (): Promise<void> => {};

describe('withRetry', () => {
  it('returns the first success without retrying', async () => {
    let calls = 0;
    const r = await withRetry(
      async () => {
        calls++;
        return 'ok';
      },
      { sleep: noSleep }
    );
    expect(r).toBe('ok');
    expect(calls).toBe(1);
  });

  it('retries a transient failure and succeeds, backing off between tries', async () => {
    let calls = 0;
    const delays: number[] = [];
    const r = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new Error('service 503: unavailable');
        return 'ok';
      },
      { attempts: 3, baseDelayMs: 100, sleep: async (ms) => void delays.push(ms) }
    );
    expect(r).toBe('ok');
    expect(calls).toBe(3);
    expect(delays.length).toBe(2);
    expect(delays[1]).toBeGreaterThan(delays[0]); // exponential
  });

  it('gives up after `attempts` and rethrows the last error', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new Error('fetch failed');
        },
        { attempts: 3, sleep: noSleep }
      )
    ).rejects.toThrow('fetch failed');
    expect(calls).toBe(3);
  });

  it('does not retry a non-transient error', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new Error('Twilio send failed 401: bad credentials');
        },
        { attempts: 3, sleep: noSleep }
      )
    ).rejects.toThrow('401');
    expect(calls).toBe(1);
  });

  it('honors a custom shouldRetry', async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw new Error('custom-fatal');
        },
        { attempts: 3, sleep: noSleep, shouldRetry: () => false }
      )
    ).rejects.toThrow('custom-fatal');
    expect(calls).toBe(1);
  });
});

describe('isTransient', () => {
  it('treats 429 and 5xx as transient', () => {
    expect(isTransient(new Error('OpenRouter 429: slow down'))).toBe(true);
    expect(isTransient(new Error('Twilio send failed 500: oops'))).toBe(true);
    expect(isTransient(new Error('upstream 503'))).toBe(true);
  });

  it('treats network-level failures as transient', () => {
    expect(isTransient(new Error('fetch failed'))).toBe(true);
    expect(isTransient(new Error('read ECONNRESET'))).toBe(true);
    expect(isTransient(new Error('connect ETIMEDOUT 1.2.3.4:443'))).toBe(true);
    expect(isTransient(new Error('The operation was aborted'))).toBe(true);
  });

  it('treats auth/client errors as permanent', () => {
    expect(isTransient(new Error('OpenRouter 401: bad key'))).toBe(false);
    expect(isTransient(new Error('Twilio send failed 400: invalid To'))).toBe(false);
    expect(isTransient(new Error('credentials not configured'))).toBe(false);
  });

  it('does not read a 5xx out of an unrelated number', () => {
    expect(isTransient(new Error('user sent 500 photos'))).toBe(false);
  });
});
