/**
 * HMAC signing for /api/card URLs. The card endpoint renders arbitrary query
 * content as an official-looking Stevi image — unsigned, anyone could forge a
 * "GEADA PROVÁVEL −5°C" or a fake pest card on our domain and spread it in
 * rural groups (brand forgery, the audit's HIGH finding). Every card URL the
 * pipeline builds gets a short signature; the endpoint rejects the rest.
 *
 * Canonicalization: params are sorted by key before signing, so key order in
 * the URL never matters. Secret: REPORT_URL_SECRET (same one the applications
 * report already uses). Without a secret (dev), signing is a no-op and the
 * endpoint accepts unsigned URLs — configure the secret in prod.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const SIG_PARAM = 'sig';
const SIG_LEN = 16; // hex chars — 64 bits, plenty against forgery-by-guess

function secret(): string {
  return process.env.REPORT_URL_SECRET ?? '';
}

/** Sorted `k=v&k2=v2` canonical form of a query (sig param excluded). */
function canonical(params: URLSearchParams): string {
  const pairs: Array<[string, string]> = [];
  params.forEach((v, k) => {
    if (k !== SIG_PARAM) pairs.push([k, v]);
  });
  pairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

function hmac(canon: string): string {
  return createHmac('sha256', secret()).update(canon).digest('hex').slice(0, SIG_LEN);
}

/** Append `sig` to a /api/card URL. No secret configured → URL unchanged. */
export function appendCardSig(url: string): string {
  if (!secret()) return url;
  const qIdx = url.indexOf('?');
  if (qIdx < 0) return url;
  const params = new URLSearchParams(url.slice(qIdx + 1));
  const sig = hmac(canonical(params));
  return `${url}${url.endsWith('?') ? '' : '&'}${SIG_PARAM}=${sig}`;
}

/** Verify a card request's query. No secret → accept (dev). With a secret,
 * a missing or wrong sig fails closed. */
export function verifyCardQuery(query: Record<string, unknown> | URLSearchParams): boolean {
  if (!secret()) return true;
  const params =
    query instanceof URLSearchParams
      ? query
      : new URLSearchParams(
          Object.entries(query).flatMap(([k, v]) =>
            v == null ? [] : [[k, String(Array.isArray(v) ? v[0] : v)] as [string, string]]
          )
        );
  const sig = params.get(SIG_PARAM);
  if (!sig || sig.length !== SIG_LEN) return false;
  const expected = hmac(canonical(params));
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Round a coordinate to 3 decimals (~110 m) for card URLs: enough precision
 * for km-scale weather/soil grids, kills CDN-cache cardinality, and degrades
 * the exact-pin leak the schema marks as sensitive. */
export function roundCoord(n: number): number {
  return Math.round(n * 1000) / 1000;
}
