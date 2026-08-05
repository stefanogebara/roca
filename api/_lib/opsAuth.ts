/**
 * Auth for the founder ops console (/painel). Two founders, one shared
 * password — a signed, expiring HttpOnly cookie is plenty and avoids standing
 * up a full identity provider. The password check is constant-time; the session
 * cookie is HMAC-signed so it can't be forged.
 *
 * Env: OPS_PASSWORD (the shared login), OPS_SESSION_SECRET (HMAC key; falls back
 * to CRON_SECRET so there's one fewer var to set). All /api/ops/* data endpoints
 * call requireOps() before touching data.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
import { createLogger } from './logger';

const log = createLogger('ops-auth');

const COOKIE = 'stevi_ops';
const TTL_MS = 12 * 60 * 60 * 1000; // 12h sessions

let warnedFallback = false;

function signingKey(): string {
  const dedicated = process.env.OPS_SESSION_SECRET;
  if (dedicated) return dedicated;
  const fallback = process.env.CRON_SECRET;
  if (!fallback) throw new Error('OPS_SESSION_SECRET (or CRON_SECRET) not configured');
  if (!warnedFallback) {
    warnedFallback = true;
    log.error(
      'OPS_SESSION_SECRET not set — signing painel sessions with CRON_SECRET. ' +
        'Set a dedicated secret: rotating one for security should never disturb the other.'
    );
  }
  return fallback;
}

/** Session generation. Bump OPS_TOKEN_VERSION to any new value to revoke every
 * outstanding painel session at once (cheaper than rotating the signing key,
 * and it can't disturb anything else). */
function tokenVersion(): string {
  return process.env.OPS_TOKEN_VERSION || '1';
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Constant-time equality that also resists length leaks (compare hashes). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Check the submitted password against OPS_PASSWORD (constant-time). */
export function passwordOk(submitted: string): boolean {
  const expected = process.env.OPS_PASSWORD;
  if (!expected) return false;
  return typeof submitted === 'string' && submitted.length > 0 && safeEqual(submitted, expected);
}

// Login throttling policy. Counts come from ops_login_attempts (DB-backed —
// serverless has no memory between invocations). The global cap defends
// against per-IP limits being sidestepped by IP rotation.
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_FAILS_PER_IP = 5;
export const LOGIN_MAX_FAILS_GLOBAL = 20;

/** Decide whether a login attempt may proceed. `null` means the count query
 * failed — fail CLOSED: a login we can't throttle is a login we don't accept. */
export function loginThrottled(ipFails: number | null, globalFails: number | null): boolean {
  if (ipFails === null || globalFails === null) return true;
  return ipFails >= LOGIN_MAX_FAILS_PER_IP || globalFails >= LOGIN_MAX_FAILS_GLOBAL;
}

/** Mint a signed session token: base64url(payloadJson).hmac. `now` injectable. */
export function mintToken(now: number = Date.now()): string {
  const payload = b64url(
    Buffer.from(JSON.stringify({ sub: 'ops', v: tokenVersion(), exp: now + TTL_MS }))
  );
  const sig = b64url(createHmac('sha256', signingKey()).update(payload).digest());
  return `${payload}.${sig}`;
}

/** Verify a session token: signature valid, not expired, AND minted under the
 * current OPS_TOKEN_VERSION (the revocation lever). `now` injectable. */
export function verifyToken(token: string | undefined, now: number = Date.now()): boolean {
  if (!token || !token.includes('.')) return false;
  const [payload, sig] = token.split('.', 2);
  const expected = b64url(createHmac('sha256', signingKey()).update(payload).digest());
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return false;
  }
  try {
    const { exp, v } = JSON.parse(
      Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
    );
    return typeof exp === 'number' && now < exp && v === tokenVersion();
  } catch {
    return false;
  }
}

/** Set the session cookie on a response (HttpOnly, Secure, Lax). */
export function setSessionCookie(res: VercelResponse, token: string): void {
  const maxAge = Math.floor(TTL_MS / 1000);
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
  );
}

/** Expire the session cookie (server-side logout). The cookie is HttpOnly, so
 * client JS cannot delete it — before this existed, "Sair" was a no-op. */
export function clearSessionCookie(res: VercelResponse): void {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
  );
}

function readCookie(req: VercelRequest, name: string): string | undefined {
  const raw = req.headers['cookie'];
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return undefined;
}

/**
 * Guard for /api/ops/* endpoints. Returns true if authorized; otherwise writes
 * 401 and returns false (caller should stop). Keeps every data endpoint one
 * line away from being locked down.
 */
/**
 * Tamanho mínimo do OPS_TOKEN.
 *
 * Um segredo fraco configurado por pressa é indistinguível de um forte para o
 * código — a não ser que ele meça. 32 chars é o que `openssl rand -hex 16`
 * produz; abaixo disso a porta é adivinhável e é melhor não existir.
 */
export const OPS_TOKEN_MIN_LEN = 32;

/**
 * Autenticação de AUTOMAÇÃO: `Authorization: Bearer <OPS_TOKEN>`.
 *
 * O painel entra por cookie assinado, emitido pela senha do Stefano. Isso trava
 * a automação, porque rodar sourcing ou backfill de fora exigiria manipular a
 * senha — a credencial que abre tudo e que uma pessoa digita. Credencial de
 * gente não deve virar credencial de robô: perde-se a capacidade de revogar uma
 * sem derrubar a outra.
 *
 * Este é o análogo do CRON_SECRET que os crons já usam. Duas travas, e as duas
 * existem por bugs que esta base já pagou:
 *
 * - SEM A ENV, O CAMINHO NÃO EXISTE. Env ausente jamais pode virar "entra
 *   qualquer um" — é exatamente o fusível de vidro do `verifyCardQuery`,
 *   consertado ontem. Não se comete o mesmo erro na mesma semana.
 * - Token curto é recusado mesmo batendo (ver OPS_TOKEN_MIN_LEN).
 */
function bearerOk(req: VercelRequest): boolean {
  const esperado = process.env.OPS_TOKEN;
  if (!esperado || esperado.length < OPS_TOKEN_MIN_LEN) return false;
  const raw = req.headers['authorization'];
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (!header) return false;
  const m = /^Bearer (.+)$/.exec(header);
  if (!m) return false;
  return safeEqual(m[1], esperado);
}

/**
 * Guard for /api/ops/* endpoints. Returns true if authorized; otherwise writes
 * 401 and returns false (caller should stop). Keeps every data endpoint one
 * line away from being locked down.
 */
export function requireOps(req: VercelRequest, res: VercelResponse): boolean {
  if (verifyToken(readCookie(req, COOKIE))) return true;
  if (bearerOk(req)) return true;
  res.status(401).json({ success: false, error: 'unauthorized' });
  return false;
}
