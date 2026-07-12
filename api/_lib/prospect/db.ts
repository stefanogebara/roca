/**
 * Prospect persistence — kept out of the big (and busy) _lib/db.ts. Reuses the
 * shared service-role client. All reads/writes for the prospecting engine + ops.
 */

import { getDb } from '../db';
import { createLogger } from '../logger';
import type { ProspectStatus, WaStatus } from './core';

const log = createLogger('prospect-db');

export interface ProspectRow {
  id: string;
  name: string;
  kind: string;
  city: string | null;
  uf: string | null;
  phone: string | null;
  wa_status: WaStatus;
  source: string;
  status: ProspectStatus;
  notes: string | null;
  sent_at: string | null;
  send_status: string | null;
  wamid: string | null;
  template_used: string | null;
  touches: number;
  created_at: string;
  updated_at: string;
}

/** Prospects marked ready with a validated number and not yet contacted. */
export async function loadReadyProspects(limit = 200): Promise<ProspectRow[]> {
  const db = getDb();
  const { data, error } = await db
    .from('prospects')
    .select('*')
    .eq('status', 'ready')
    .eq('wa_status', 'valid')
    .is('send_status', null)
    .not('phone', 'is', null)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) {
    log.error('loadReadyProspects failed:', error.message);
    return [];
  }
  return (data ?? []) as ProspectRow[];
}

/**
 * The opt-out blocklist as a set of E.164 numbers. FAILS CLOSED: if we can't
 * read the blocklist we must NOT send (sending to an opted-out number is an LGPD
 * violation + a ban risk), so this throws and the dispatch aborts. A null result
 * with no error is also treated as unverifiable → throw.
 */
export async function loadOptouts(): Promise<Set<string>> {
  const db = getDb();
  const { data, error } = await db.from('prospect_optouts').select('phone');
  if (error || data == null) {
    throw new Error(`loadOptouts unavailable: ${error?.message ?? 'null result'}`);
  }
  return new Set((data as Array<{ phone: string }>).map((r) => r.phone));
}

/**
 * How many prospects were already contacted since a given instant (daily cap).
 * FAILS CLOSED: on error we throw so the run aborts rather than resetting the cap
 * to 0 and over-sending from a fresh number.
 */
export async function countSentSince(sinceIso: string): Promise<number> {
  const db = getDb();
  const { count, error } = await db
    .from('prospects')
    .select('id', { count: 'exact', head: true })
    .gte('sent_at', sinceIso);
  if (error || count == null) {
    throw new Error(`countSentSince unavailable: ${error?.message ?? 'null count'}`);
  }
  return count;
}

/**
 * Atomically claim a prospect for the intro send (send_status null → 'sending',
 * one SQL statement). Two dispatch runs can overlap — the cron firing while a
 * founder presses "Disparar" in the painel — and both read the same eligible
 * rows; whoever claims a row first owns it, the other MUST skip. Re-checks
 * status='ready' so a founder discarding the prospect mid-run (pacing makes a
 * run span minutes) also voids the claim. The claim stamps sent_at NOW: the
 * daily cap counts sent_at, so cap is consumed at claim time and an overlapping
 * run's recount sees it (recordSend refreshes the timestamp; a failed attempt
 * keeps counting toward the cap — deliberately conservative pacing). Returns
 * false when the row was already claimed/changed. FAILS CLOSED on error (a row
 * we can't claim is a row we don't send). A crash after claiming strands the
 * row at 'sending' — surfaced in the painel with a "Liberar reenvio" reset —
 * because a lost send is recoverable and a double send is not.
 */
export async function claimProspectForSend(id: string): Promise<boolean> {
  const db = getDb();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from('prospects')
    .update({ send_status: 'sending', sent_at: now, updated_at: now })
    .eq('id', id)
    .eq('status', 'ready')
    .is('send_status', null)
    .select('id');
  if (error) {
    log.error('claimProspectForSend failed (treated as not claimed):', error.message);
    return false;
  }
  return (data ?? []).length > 0;
}

/**
 * Atomically claim a prospect for the D+3 bump (touches 1 → 2, conditional on
 * the still-bumpable state). Same overlap scenario as claimProspectForSend;
 * sent_at is stamped at claim time for the same cap-consumption reason (it also
 * drops the row out of loadBumpDueProspects' window immediately). If the send
 * then fails, touches stays 2 and the prospect simply never gets re-bumped —
 * a missed follow-up is the safe failure direction.
 */
export async function claimProspectForBump(id: string): Promise<boolean> {
  const db = getDb();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from('prospects')
    .update({ touches: 2, sent_at: now, updated_at: now })
    .eq('id', id)
    .eq('status', 'contacted')
    .eq('send_status', 'sent')
    .eq('touches', 1)
    .select('id');
  if (error) {
    log.error('claimProspectForBump failed (treated as not claimed):', error.message);
    return false;
  }
  return (data ?? []).length > 0;
}

// Give-up window: a contacted prospect whose last touch (intro or D+3 bump —
// both stamp sent_at) got no reply for this many days is dead, not "waiting".
// Clamped: a misparsed env must neither detonate (0/NaN would stale everything
// or throw) nor silently disable the sweep.
const STALE_DAYS_RAW = Number(process.env.PROSPECT_STALE_AFTER_DAYS || '14');
const STALE_AFTER_DAYS = Number.isFinite(STALE_DAYS_RAW) && STALE_DAYS_RAW >= 3 ? STALE_DAYS_RAW : 14;

/**
 * Terminal state for never-repliers: 'contacted' with no reply since the last
 * touch → 'stale'. Keeps the funnel stats honest and the painel free of
 * zombies; a founder can still reactivate from the painel (stale → discovered).
 * A reply arriving later still works — markProspectReplied matches by phone,
 * not status. Returns how many rows transitioned.
 */
export async function markStaleProspects(
  days = STALE_AFTER_DAYS,
  now = new Date()
): Promise<number> {
  const db = getDb();
  const cutoff = new Date(now.getTime() - days * 86_400_000).toISOString();
  const { data, error } = await db
    .from('prospects')
    .update({ status: 'stale', updated_at: now.toISOString() })
    .eq('status', 'contacted')
    .lt('sent_at', cutoff)
    .select('id');
  if (error) {
    log.error('markStaleProspects failed:', error.message);
    return 0;
  }
  return (data ?? []).length;
}

/**
 * Founder-clicked return of a stale/discarded prospect to the review queue.
 * Clears the send tracking (send_status + touches) so an approved row is
 * genuinely re-sendable — without this a once-contacted row re-enters the
 * funnel as an un-dispatchable zombie that renders as "contatado". The
 * deliberate re-outreach decision is gated by the painel confirm.
 */
export async function reactivateProspect(id: string): Promise<boolean> {
  const db = getDb();
  const { data, error } = await db
    .from('prospects')
    .update({ status: 'discovered', send_status: null, touches: 0, updated_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['stale', 'discarded'])
    .select('id');
  if (error) {
    log.error('reactivateProspect failed:', error.message);
    return false;
  }
  return (data ?? []).length > 0;
}

/**
 * Ops recovery for a stuck claim ('sending' after a crash) or a failed send:
 * clears send_status so the prospect re-enters the dispatch queue. Guarded to
 * those two states only — resetting a 'sent' row would re-blast the number.
 */
export async function resetProspectSend(id: string): Promise<boolean> {
  const db = getDb();
  const { data, error } = await db
    .from('prospects')
    .update({ send_status: null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .in('send_status', ['sending', 'failed'])
    .select('id');
  if (error) {
    log.error('resetProspectSend failed:', error.message);
    return false;
  }
  return (data ?? []).length > 0;
}

/**
 * Mark a prospect contacted after a successful template send. THROWS on failure:
 * the message already went out, so an unrecorded send is a duplicate-send hazard
 * next run — the caller must stop the batch and page ops to reconcile the wamid,
 * not silently continue.
 */
export async function recordSend(
  id: string,
  fields: { wamid: string; template: string }
): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('prospects')
    .update({
      send_status: 'sent',
      status: 'contacted',
      sent_at: new Date().toISOString(),
      wamid: fields.wamid,
      template_used: fields.template,
      touches: 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw new Error(`recordSend failed for ${id} (wamid ${fields.wamid}): ${error.message}`);
}

/**
 * Prospects due a D+3 bump: intro sent, never replied (status still
 * 'contacted' — any inbound flips it to 'replied'), exactly one touch so far.
 */
export async function loadBumpDueProspects(days = 3, limit = 50): Promise<ProspectRow[]> {
  const db = getDb();
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await db
    .from('prospects')
    .select('*')
    .eq('status', 'contacted')
    .eq('send_status', 'sent')
    .eq('touches', 1)
    .not('phone', 'is', null)
    .lt('sent_at', cutoff)
    .order('sent_at', { ascending: true })
    .limit(limit);
  if (error) {
    log.error('loadBumpDueProspects failed:', error.message);
    return [];
  }
  return (data ?? []) as ProspectRow[];
}

/** Record a bump send: second touch, refresh sent_at (feeds the daily cap). */
export async function recordBump(id: string, fields: { wamid: string; template: string }): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('prospects')
    .update({
      touches: 2,
      sent_at: new Date().toISOString(),
      wamid: fields.wamid,
      template_used: fields.template,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw new Error(`recordBump failed for ${id} (wamid ${fields.wamid}): ${error.message}`);
}

/** Mark a prospect's send as failed (surfaced in ops; never silently dropped). */
export async function recordSendFailed(id: string): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('prospects')
    .update({ send_status: 'failed', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) log.error('recordSendFailed failed:', error.message);
}

/** All prospects for the ops table, newest first. */
export async function listProspects(limit = 500): Promise<ProspectRow[]> {
  const db = getDb();
  const { data, error } = await db
    .from('prospects')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    log.error('listProspects failed:', error.message);
    return [];
  }
  return (data ?? []) as ProspectRow[];
}

export interface ProspectInput {
  name: string;
  phone: string | null;
  wa_status: WaStatus;
  kind: string;
  city: string | null;
  uf: string | null;
  source: string;
}

/**
 * Bulk-insert prospects, skipping phones that already exist. We dedup explicitly
 * (rather than ON CONFLICT) because the phone unique index is partial
 * (`where phone is not null`), which ON CONFLICT can't target. Rows without a
 * phone (invalid) are always inserted so ops can see and fix them. Returns the
 * number of rows newly inserted.
 */
export async function importProspects(rows: ProspectInput[]): Promise<number> {
  if (!rows.length) return 0;
  const db = getDb();

  const phones = [...new Set(rows.map((r) => r.phone).filter((v): v is string => !!v))];
  const existing = new Set<string>();
  if (phones.length) {
    const { data, error } = await db.from('prospects').select('phone').in('phone', phones);
    if (error) throw new Error(`importProspects dedup query failed: ${error.message}`);
    for (const r of (data ?? []) as Array<{ phone: string | null }>) if (r.phone) existing.add(r.phone);
  }

  const seen = new Set<string>();
  const toInsert = rows.filter((r) => {
    if (!r.phone) return true; // invalid — always keep for review
    if (existing.has(r.phone) || seen.has(r.phone)) return false; // dedup vs DB + within batch
    seen.add(r.phone);
    return true;
  });
  if (!toInsert.length) return 0;

  const { data, error } = await db.from('prospects').insert(toInsert).select('id');
  if (error) {
    log.error('importProspects failed:', error.message);
    throw new Error(error.message);
  }
  return (data ?? []).length;
}

/** Set a prospect's pipeline status (e.g. ready / discarded) from the ops console. */
export async function setProspectStatus(id: string, status: ProspectStatus): Promise<boolean> {
  const db = getDb();
  const { error } = await db
    .from('prospects')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    log.error('setProspectStatus failed:', error.message);
    return false;
  }
  // Promotion to 'ready' IS the review act: a sourced number ('pending', i.e.
  // format-validated but scraped) becomes 'valid'. Never resurrects 'invalid'.
  if (status === 'ready') {
    const { error: waErr } = await db
      .from('prospects')
      .update({ wa_status: 'valid' })
      .eq('id', id)
      .eq('wa_status', 'pending');
    if (waErr) log.error('wa_status promotion failed:', waErr.message);
  }
  return true;
}

/** Find a prospect by its E.164 phone (to recognise inbound replies from prospects). */
export async function findProspectByPhone(phone: string): Promise<ProspectRow | null> {
  const db = getDb();
  const { data, error } = await db.from('prospects').select('*').eq('phone', phone).maybeSingle();
  if (error) {
    log.error('findProspectByPhone failed:', error.message);
    return null;
  }
  return (data as ProspectRow) ?? null;
}

/** Mark a prospect as having replied (engagement signal for ops). */
export async function markProspectReplied(id: string): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('prospects')
    .update({ status: 'replied', send_status: 'replied', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) log.error('markProspectReplied failed:', error.message);
}

/** Add a phone to the hard opt-out blocklist (idempotent on the unique index). */
export async function addOptout(phone: string, reason: string): Promise<void> {
  const db = getDb();
  const { error } = await db.from('prospect_optouts').upsert({ phone, reason }, { onConflict: 'phone' });
  if (error) log.error('addOptout failed:', error.message);
}

// ── Conversation agent support (prospect_messages + agent toggle) ────────────

export interface ProspectMessage {
  direction: 'in' | 'out';
  kind: string;
  text: string | null;
  created_at: string;
}

/** Append a message to a prospect's thread (best-effort). */
export async function logProspectMessage(
  prospectId: string,
  direction: 'in' | 'out',
  kind: string,
  text: string | null
): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('prospect_messages')
    .insert({ prospect_id: prospectId, direction, kind, text });
  if (error) log.error('logProspectMessage failed:', error.message);
}

/** Load a prospect's thread, oldest first (bounded). */
export async function getProspectThread(
  prospectId: string,
  limit = 30
): Promise<ProspectMessage[]> {
  const db = getDb();
  const { data, error } = await db
    .from('prospect_messages')
    .select('direction, kind, text, created_at')
    .eq('prospect_id', prospectId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) {
    log.error('getProspectThread failed:', error.message);
    return [];
  }
  return (data ?? []) as ProspectMessage[];
}

/** Founder takeover switch: enable/disable the conversation agent. */
export async function setProspectAgentEnabled(prospectId: string, enabled: boolean): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('prospects')
    .update({ agent_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('id', prospectId);
  if (error) log.error('setProspectAgentEnabled failed:', error.message);
}

/** Merge extracted qualification into the prospect row (nulls don't overwrite). */
export async function mergeProspectQualification(
  prospectId: string,
  q: Record<string, unknown>
): Promise<void> {
  const db = getDb();
  const { data } = await db.from('prospects').select('qualification').eq('id', prospectId).maybeSingle();
  const current = ((data as { qualification: Record<string, unknown> | null } | null)?.qualification) ?? {};
  const merged: Record<string, unknown> = { ...current };
  for (const [k, v] of Object.entries(q)) {
    if (v !== null && v !== undefined) merged[k] = v;
  }
  const { error } = await db
    .from('prospects')
    .update({ qualification: merged, updated_at: new Date().toISOString() })
    .eq('id', prospectId);
  if (error) log.error('mergeProspectQualification failed:', error.message);
}
