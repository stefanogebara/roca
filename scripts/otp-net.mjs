// Network helper for the OTP scripts: a JSON fetch that survives the flaky
// link this actually runs over.
//
// Why it exists: otp-capture.mjs used bare fetch() for the Twilio polls. On
// 26/07 a single UND_ERR_CONNECT_TIMEOUT (undici's 10s connect deadline) threw
// out of the poll loop and killed the process — AFTER Meta had already placed
// the verification call. The code was sitting in a recording nobody read, and
// the next attempt had to wait out Meta's request_code cooldown for nothing.
//
// Once the call is placed, giving up on a network hiccup is the one thing the
// script must never do.
//
// Dependencies are injectable so the retry behaviour is unit-testable without
// real sockets (see tests/otp-net.test.ts).

/** Retry-worthy transport failures: DNS, connect/read timeouts, resets. */
export function isRetriableError(err) {
  const code = err?.cause?.code ?? err?.code ?? '';
  const name = err?.name ?? '';
  return (
    name === 'TimeoutError' ||
    name === 'AbortError' ||
    /^(UND_ERR_CONNECT_TIMEOUT|UND_ERR_SOCKET|UND_ERR_HEADERS_TIMEOUT|UND_ERR_BODY_TIMEOUT|ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE)$/.test(
      String(code)
    ) ||
    /fetch failed|network|socket hang up/i.test(String(err?.message ?? ''))
  );
}

/** Server-side statuses worth another shot (rate limit / transient 5xx). */
export function isRetriableStatus(status) {
  return status === 429 || (status >= 500 && status <= 599);
}

/**
 * GET/POST returning parsed JSON, retrying transport errors, 429s and 5xxs
 * with linear backoff. Throws only after every attempt is spent.
 *
 * opts: standard fetch init. cfg: { attempts, timeoutMs, baseDelayMs,
 * fetchImpl, sleepImpl, onRetry, label }.
 */
export async function fetchJsonWithRetry(url, opts = {}, cfg = {}) {
  const {
    attempts = 4,
    timeoutMs = 25000,
    baseDelayMs = 2000,
    fetchImpl = fetch,
    sleepImpl = (ms) => new Promise((r) => setTimeout(r, ms)),
    onRetry = () => {},
    label = 'fetch',
  } = cfg;

  let lastProblem = 'unknown';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetchImpl(url, { ...opts, signal: AbortSignal.timeout(timeoutMs) });
      if (isRetriableStatus(res.status) && attempt < attempts) {
        lastProblem = `HTTP ${res.status}`;
        onRetry({ label, attempt, attempts, problem: lastProblem });
        await sleepImpl(baseDelayMs * attempt);
        continue;
      }
      return await res.json();
    } catch (err) {
      // Same precedence as isRetriableError: undici hides the real code under
      // `cause`, plain node errors put it on `code`. Missing `code` here made a
      // DNS failure report as a useless bare "Error".
      lastProblem = err?.cause?.code ?? err?.code ?? err?.name ?? err?.message ?? 'error';
      if (!isRetriableError(err) || attempt === attempts) {
        throw new Error(`${label} failed after ${attempt} attempt(s): ${lastProblem}`);
      }
      onRetry({ label, attempt, attempts, problem: String(lastProblem) });
      await sleepImpl(baseDelayMs * attempt);
    }
  }
  throw new Error(`${label} failed after ${attempts} attempt(s): ${lastProblem}`);
}
