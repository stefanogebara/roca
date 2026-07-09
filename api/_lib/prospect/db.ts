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

/** The opt-out blocklist as a set of E.164 numbers. */
export async function loadOptouts(): Promise<Set<string>> {
  const db = getDb();
  const { data, error } = await db.from('prospect_optouts').select('phone');
  if (error) {
    log.error('loadOptouts failed:', error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r) => (r as { phone: string }).phone));
}

/** How many prospects were already contacted since a given instant (daily cap). */
export async function countSentSince(sinceIso: string): Promise<number> {
  const db = getDb();
  const { count, error } = await db
    .from('prospects')
    .select('id', { count: 'exact', head: true })
    .gte('sent_at', sinceIso);
  if (error) {
    log.error('countSentSince failed:', error.message);
    return 0;
  }
  return count ?? 0;
}

/** Mark a prospect contacted after a successful template send. */
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
  if (error) log.error('recordSend failed:', error.message);
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

/** Add a phone to the hard opt-out blocklist (idempotent on the unique index). */
export async function addOptout(phone: string, reason: string): Promise<void> {
  const db = getDb();
  const { error } = await db.from('prospect_optouts').upsert({ phone, reason }, { onConflict: 'phone' });
  if (error) log.error('addOptout failed:', error.message);
}
