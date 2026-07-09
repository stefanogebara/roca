/**
 * Retry with exponential backoff for external calls (OpenRouter, WhatsApp
 * sends, tool fetches). Single-shot fetches were the norm here — meaning one
 * transient 503 could cost a farmer their reply. Retries are short and few:
 * everything runs inside a webhook with a hard maxDuration budget.
 */

export interface RetryOptions {
  /** Total attempts including the first (default 3). */
  attempts?: number;
  /** First backoff delay; doubles each retry, with jitter (default 400ms). */
  baseDelayMs?: number;
  /** Which errors are worth retrying (default: isTransient). */
  shouldRetry?: (e: unknown) => boolean;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Transient = worth retrying: rate limits (429), upstream 5xx, and
 * network-level failures. Status codes are matched in the positions this
 * codebase's error messages put them ("OpenRouter 429: ...", "... failed 503")
 * so an unrelated number in a message can't look like a status.
 */
export function isTransient(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  if (/\b(429|5\d\d):/.test(msg) || /\b(429|5\d\d)$/.test(msg)) return true;
  return /fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket hang up|network|aborted/i.test(
    msg
  );
}

/** Run `fn`, retrying transient failures with exponential backoff + jitter. */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const base = opts.baseDelayMs ?? 400;
  const shouldRetry = opts.shouldRetry ?? isTransient;
  const sleep = opts.sleep ?? defaultSleep;

  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (i === attempts - 1 || !shouldRetry(e)) throw e;
      await sleep(base * 2 ** i + Math.floor(Math.random() * 100));
    }
  }
  throw lastError; // unreachable, satisfies the compiler
}
