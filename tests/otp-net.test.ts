/**
 * Retry contract for the OTP scripts' network layer.
 *
 * Pins the bug from 26/07: a single UND_ERR_CONNECT_TIMEOUT talking to Twilio
 * killed otp-capture AFTER Meta had already placed the verification call — the
 * code was in a recording nobody read, and the cooldown burned for nothing.
 */
import { describe, it, expect, vi } from 'vitest';
// @ts-expect-error — plain .mjs helper, no types
import { fetchJsonWithRetry, isRetriableError, isRetriableStatus } from '../scripts/otp-net.mjs';

const ok = (body: unknown) => ({ status: 200, json: async () => body });
const noSleep = async () => {};

describe('isRetriableError', () => {
  it('treats the failure that actually broke us as retriable', () => {
    const err = new TypeError('fetch failed');
    (err as unknown as { cause: { code: string } }).cause = { code: 'UND_ERR_CONNECT_TIMEOUT' };
    expect(isRetriableError(err)).toBe(true);
  });

  it('covers DNS and reset flavours too', () => {
    for (const code of ['ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', 'ETIMEDOUT']) {
      const e = new Error('boom');
      (e as unknown as { code: string }).code = code;
      expect(isRetriableError(e), code).toBe(true);
    }
    expect(isRetriableError(Object.assign(new Error('x'), { name: 'TimeoutError' }))).toBe(true);
  });

  it('does NOT retry a genuine bug', () => {
    expect(isRetriableError(new TypeError('opts.body is not iterable'))).toBe(false);
  });
});

describe('isRetriableStatus', () => {
  it('retries 429 and 5xx, not 4xx', () => {
    expect(isRetriableStatus(429)).toBe(true);
    expect(isRetriableStatus(503)).toBe(true);
    expect(isRetriableStatus(400)).toBe(false);
    expect(isRetriableStatus(404)).toBe(false);
  });
});

describe('fetchJsonWithRetry', () => {
  it('recovers from a transient connect timeout and returns the payload', async () => {
    const err = new TypeError('fetch failed');
    (err as unknown as { cause: { code: string } }).cause = { code: 'UND_ERR_CONNECT_TIMEOUT' };
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce(ok({ recordings: [{ sid: 'RE1' }] }));

    const out = await fetchJsonWithRetry('https://api.twilio.com/x', {}, { fetchImpl, sleepImpl: noSleep });

    expect(out).toEqual({ recordings: [{ sid: 'RE1' }] });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('retries 429/5xx then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({ status: 503, json: async () => ({}) })
      .mockResolvedValueOnce(ok({ done: true }));

    const out = await fetchJsonWithRetry('https://api.twilio.com/x', {}, { fetchImpl, sleepImpl: noSleep });

    expect(out).toEqual({ done: true });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('gives up only after exhausting attempts, with a message naming the cause', async () => {
    const err = new Error('nope');
    (err as unknown as { code: string }).code = 'ENOTFOUND';
    const fetchImpl = vi.fn().mockRejectedValue(err);

    await expect(
      fetchJsonWithRetry('https://x/y', {}, { fetchImpl, sleepImpl: noSleep, attempts: 3, label: 'twilio recordings' })
    ).rejects.toThrow(/twilio recordings failed after 3 attempt\(s\): ENOTFOUND/);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('does not waste attempts on a non-retriable error', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('bad init'));
    await expect(fetchJsonWithRetry('https://x/y', {}, { fetchImpl, sleepImpl: noSleep })).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('backs off progressively and reports each retry', async () => {
    const err = new Error('x');
    (err as unknown as { code: string }).code = 'ECONNRESET';
    const delays: number[] = [];
    const events: string[] = [];
    const fetchImpl = vi.fn().mockRejectedValueOnce(err).mockRejectedValueOnce(err).mockResolvedValueOnce(ok({}));

    await fetchJsonWithRetry(
      'https://x/y',
      {},
      {
        fetchImpl,
        sleepImpl: async (ms: number) => void delays.push(ms),
        baseDelayMs: 1000,
        onRetry: (e: { problem: string }) => void events.push(e.problem),
      }
    );

    expect(delays).toEqual([1000, 2000]); // linear, not constant
    expect(events).toEqual(['ECONNRESET', 'ECONNRESET']);
  });
});
