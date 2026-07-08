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
  awaiting: string | null;
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

/** Persist the latest known farm location; returns the farm id for caching. */
export async function setFarmLocation(
  userId: string,
  lat: number,
  lon: number
): Promise<string | null> {
  const db = getDb();
  const { data, error } = await db
    .from('farms')
    .upsert({ user_id: userId, lat, lon }, { onConflict: 'user_id' })
    .select('id')
    .single();
  if (error) {
    log.error('setFarmLocation failed:', error.message);
    return null;
  }
  return (data as { id: string }).id;
}

/** Store the derived UF on the user (drives vazio sanitário awareness). */
export async function setUserState(userId: string, uf: string): Promise<void> {
  const db = getDb();
  const { error } = await db.from('users').update({ state: uf }).eq('id', userId);
  if (error) log.error('setUserState failed:', error.message);
}

/** Set/clear what Stevi is waiting for from this user (e.g. 'crop'). */
export async function setAwaiting(userId: string, awaiting: string | null): Promise<void> {
  const db = getDb();
  const { error } = await db.from('users').update({ awaiting }).eq('id', userId);
  if (error) log.error('setAwaiting failed:', error.message);
}

/** Persist the crops a farmer grows (upsert the farm row if needed). */
export async function setFarmCrops(userId: string, crops: string[]): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('farms')
    .upsert({ user_id: userId, crop: crops }, { onConflict: 'user_id' });
  if (error) log.error('setFarmCrops failed:', error.message);
}

/** Read the user's stored UF, if known. */
export async function getUserState(userId: string): Promise<string | null> {
  const db = getDb();
  const { data, error } = await db
    .from('users')
    .select('state')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    log.error('getUserState failed:', error.message);
    return null;
  }
  return (data as { state: string | null } | null)?.state ?? null;
}

/** Cache derived soil data per farm (soil is effectively static). */
export async function setCachedSoil(farmId: string, soil: unknown): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('farm_derived')
    .upsert({ farm_id: farmId, soil_json: soil, fetched_at: new Date().toISOString() });
  if (error) log.error('setCachedSoil failed:', error.message);
}

export async function getCachedSoil<T>(farmId: string): Promise<T | null> {
  const db = getDb();
  const { data, error } = await db
    .from('farm_derived')
    .select('soil_json')
    .eq('farm_id', farmId)
    .maybeSingle();
  if (error) {
    log.error('getCachedSoil failed:', error.message);
    return null;
  }
  return ((data as { soil_json: T | null } | null)?.soil_json as T) ?? null;
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
  msg: {
    kind: string;
    text: string | null;
    intent?: string | null;
    messageId?: string;
    transcript?: string | null;
  }
): Promise<void> {
  const db = getDb();
  const { error } = await db.from('messages').insert({
    user_id: userId,
    direction,
    kind: msg.kind,
    raw: msg.text,
    transcript: msg.transcript ?? null,
    intent: msg.intent ?? null,
    provider_message_id: msg.messageId ?? null,
  });
  if (error) log.error('logMessage failed:', error.message);
}

/**
 * Record that the LGPD consent note was delivered. Until the user objects (or
 * asks for deletion), continued use after being informed is the working basis;
 * this timestamp is what stops the note repeating on every message.
 */
export async function markConsentNotified(userId: string): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('users')
    .update({ consent_lgpd_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) log.error('markConsentNotified failed:', error.message);
}

/**
 * Count a user's inbound messages since a timestamp — the rate-limit signal.
 * Serverless is stateless, so we count in the (indexed) messages table rather
 * than hold an in-memory window. Returns 0 on error (fail-open: a DB hiccup
 * shouldn't lock a farmer out).
 */
export async function countRecentInbound(userId: string, sinceIso: string): Promise<number> {
  const db = getDb();
  const { count, error } = await db
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('direction', 'in')
    .gte('created_at', sinceIso);
  if (error) {
    log.error('countRecentInbound failed:', error.message);
    return 0;
  }
  return count ?? 0;
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
