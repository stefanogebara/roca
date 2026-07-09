/**
 * Prospecting safety core — pure, deterministic, and the part that (if wrong)
 * gets our fresh WhatsApp number banned. No I/O here: phone validation,
 * send-eligibility, opt-out/dedup gating, and conservative pacing (daily cap,
 * business hours, batch sizing). Everything downstream (the dispatch engine)
 * MUST route through these. Heavily unit-tested.
 */

// Fresh-number-safe pacing. Deliberately below Olívia's (cap 40/ceiling 80): our
// number is new with an UNKNOWN quality rating, so we ramp gently.
export const DAILY_CAP_DEFAULT = 20;
export const DAILY_CAP_CEILING = 60;
export const BATCH_SIZE = 8;
export const BATCH_DELAY_MS = 45_000;

// Business hours in BRT (UTC−3, no DST in Brazil since 2019). Mon–Fri 09–18.
const BRT_OFFSET_MIN = -180;
const HOURS_START = 9;
const HOURS_END = 18; // exclusive upper bound (last send-hour is 17:xx)
const DAYS = new Set([1, 2, 3, 4, 5]); // Mon–Fri (JS getUTCDay: 0=Sun)

export type WaStatus = 'pending' | 'valid' | 'invalid';
export type ProspectStatus =
  | 'discovered'
  | 'ready'
  | 'contacted'
  | 'replied'
  | 'discarded';

export interface ProspectLike {
  phone: string | null;
  wa_status: WaStatus;
  status: ProspectStatus;
  send_status: string | null;
}

/**
 * Normalize a raw phone to Brazilian E.164 ("+55DDDNUMBER"), or null if it isn't
 * a valid BR number. NEVER fabricates or guesses — invalid input returns null so
 * the caller marks the prospect `invalid` and never sends. Accepts numbers with
 * or without the +55 country code, common punctuation, and both mobile (9-digit
 * subscriber) and landline (8-digit) forms.
 */
export function normalizePhoneBR(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  // Strip a leading country code if present.
  if (digits.length === 13 && digits.startsWith('55')) digits = digits.slice(2);
  else if (digits.length === 12 && digits.startsWith('55')) digits = digits.slice(2);
  // Now expect a national number: 11 digits (mobile) or 10 (landline).
  if (digits.length !== 10 && digits.length !== 11) return null;
  const ddd = Number(digits.slice(0, 2));
  if (!Number.isInteger(ddd) || ddd < 11 || ddd > 99) return null;
  const sub = digits.slice(2);
  if (sub.length === 9) {
    if (sub[0] !== '9') return null; // BR mobile subscriber starts with 9
  } else if (sub.length === 8) {
    // Landline: first digit 2–5 (loosely). Reject obvious junk like all-zeros.
    if (!/^[2-5]/.test(sub)) return null;
  } else {
    return null;
  }
  return `+55${digits}`;
}

/** UTC ISO for the start of the current BRT calendar day (for the daily cap). */
export function brtDayStartIso(now: Date): string {
  const shifted = new Date(now.getTime() + BRT_OFFSET_MIN * 60_000);
  const midnightBrtUtc = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
    3, // 00:00 BRT == 03:00 UTC
    0,
    0
  );
  return new Date(midnightBrtUtc).toISOString();
}

/** BRT wall-clock parts for a given instant (pure; no local-tz dependence). */
function brtParts(now: Date): { day: number; hour: number } {
  const shifted = new Date(now.getTime() + BRT_OFFSET_MIN * 60_000);
  return { day: shifted.getUTCDay(), hour: shifted.getUTCHours() };
}

/** True only inside the allowed outreach window (BRT Mon–Fri 09:00–17:59). */
export function isBusinessHours(now: Date): boolean {
  const { day, hour } = brtParts(now);
  return DAYS.has(day) && hour >= HOURS_START && hour < HOURS_END;
}

/**
 * Can we send a first-touch to this prospect right now? Requires: reviewed & ready,
 * a validated WhatsApp number, not opted out, and never contacted before (dedup).
 * `optouts` is the set of opted-out E.164 numbers.
 */
export function eligibleToSend(p: ProspectLike, optouts: Set<string>): boolean {
  if (p.status !== 'ready') return false;
  if (p.wa_status !== 'valid' || !p.phone) return false;
  if (optouts.has(p.phone)) return false;
  if (p.send_status != null) return false; // already sent/delivered/failed — never re-blast
  return true;
}

/** Clamp a requested daily cap into [0, ceiling]. */
export function clampDailyCap(requested: number): number {
  if (!Number.isFinite(requested) || requested < 0) return 0;
  return Math.min(Math.floor(requested), DAILY_CAP_CEILING);
}

/**
 * Decide how many to send in this run and return the slice. Honours the daily cap
 * (minus what already went out today) and the per-batch size. Pure — the engine
 * handles the actual send + inter-batch delay.
 */
export function planBatch<T>(
  eligible: T[],
  opts: { dailyCap?: number; sentToday?: number; batchSize?: number } = {}
): T[] {
  const cap = clampDailyCap(opts.dailyCap ?? DAILY_CAP_DEFAULT);
  const sentToday = Math.max(0, Math.floor(opts.sentToday ?? 0));
  const remaining = Math.max(0, cap - sentToday);
  const batch = Math.max(0, Math.min(opts.batchSize ?? BATCH_SIZE, remaining));
  return eligible.slice(0, batch);
}

export interface ParsedProspect {
  name: string;
  phone: string | null;
  wa_status: WaStatus;
  kind: string;
  city: string | null;
  uf: string | null;
}

const VALID_KINDS = new Set(['coop', 'revenda', 'sindicato', 'agronomo']);

/**
 * Parse pasted import lines → prospects. One per line, comma-separated:
 * `nome, telefone[, cidade, uf, tipo]`. Name + phone required. Phones run through
 * normalizePhoneBR — an unparseable number keeps the row but marks it `invalid`
 * (phone null) so ops sees it and it can NEVER be sent. Blank/`#` lines skipped.
 */
export function parseProspectLines(text: string): ParsedProspect[] {
  const out: ParsedProspect[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const parts = t.split(',').map((s) => s.trim());
    const name = parts[0];
    if (!name || parts.length < 2) continue;
    const phone = normalizePhoneBR(parts[1]);
    const kindRaw = (parts[4] ?? '').toLowerCase();
    out.push({
      name,
      phone,
      wa_status: phone ? 'valid' : 'invalid',
      kind: VALID_KINDS.has(kindRaw) ? kindRaw : 'revenda',
      city: parts[2] || null,
      uf: (parts[3] || null)?.toUpperCase() ?? null,
    });
  }
  return out;
}

// Inbound opt-out phrases from a prospect ("parar", "sair", "não quero", "remover").
const OPTOUT_RE = /\b(parar|sair|descadastr\w*|remover?|n[ãa]o\s+quero|cancelar?|stop)\b/i;

/** Whether an inbound message from a prospect is an opt-out request. */
export function isOptOut(text: string | null | undefined): boolean {
  return !!text && OPTOUT_RE.test(text);
}
