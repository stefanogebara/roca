/**
 * Supabase persistence. Stateless-per-message, stateful-in-DB (dossier Part 6).
 * Uses the service-role key (server-only). All functions fail soft where a DB
 * hiccup shouldn't block the farmer's reply, but log via the returned error.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from './logger';
import { requireEnv } from './env';

const log = createLogger('db');
let cached: SupabaseClient | null = null;

export function getDb(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } }
  );
  return cached;
}

export interface UserRow {
  id: string;
  wa_id: string;
  name: string | null;
  state: string | null;
  consent_lgpd_at: string | null;
}

/** Upsert a user by WhatsApp id, returning the row. */
export async function upsertUser(
  waId: string,
  name: string | null
): Promise<UserRow | null> {
  const db = getDb();
  const { data, error } = await db
    .from('users')
    .upsert({ wa_id: waId, name }, { onConflict: 'wa_id' })
    .select()
    .single();
  if (error) {
    log.error('upsertUser failed:', error.message);
    return null;
  }
  return data as UserRow;
}

/** Persist the latest known farm location so weather/soil can be derived. */
export async function setFarmLocation(
  userId: string,
  lat: number,
  lon: number
): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('farms')
    .upsert({ user_id: userId, lat, lon }, { onConflict: 'user_id' });
  if (error) log.error('setFarmLocation failed:', error.message);
}

/** Fetch a user's most recent farm location, if any. */
export async function getFarmLocation(
  userId: string
): Promise<{ lat: number; lon: number } | null> {
  const db = getDb();
  const { data, error } = await db
    .from('farms')
    .select('lat,lon')
    .eq('user_id', userId)
    .not('lat', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    log.error('getFarmLocation failed:', error.message);
    return null;
  }
  if (!data || data.lat == null || data.lon == null) return null;
  return { lat: data.lat as number, lon: data.lon as number };
}

export async function logMessage(
  userId: string | null,
  direction: 'in' | 'out',
  msg: { kind: string; text: string | null; intent?: string | null; messageId?: string }
): Promise<void> {
  const db = getDb();
  const { error } = await db.from('messages').insert({
    user_id: userId,
    direction,
    kind: msg.kind,
    raw: msg.text,
    intent: msg.intent ?? null,
    provider_message_id: msg.messageId ?? null,
  });
  if (error) log.error('logMessage failed:', error.message);
}

/** LGPD deletion: wipe a user's data on request. */
export async function deleteUserData(waId: string): Promise<boolean> {
  const db = getDb();
  const { data: user } = await db
    .from('users')
    .select('id')
    .eq('wa_id', waId)
    .maybeSingle();
  if (!user) return true;
  const userId = (user as { id: string }).id;
  await db.from('messages').delete().eq('user_id', userId);
  await db.from('farms').delete().eq('user_id', userId);
  const { error } = await db.from('users').delete().eq('id', userId);
  if (error) {
    log.error('deleteUserData failed:', error.message);
    return false;
  }
  return true;
}
