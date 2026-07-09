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
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw new Error(`recordSend failed for ${id} (wamid ${fields.wamid}): ${error.message}`);
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
