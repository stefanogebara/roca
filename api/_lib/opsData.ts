/**
 * Read models for the founder ops console. All reads go through the service
 * role (server-only). Phone numbers are masked to country code + last 4 — the
 * console honours the same "telefone nunca aparece por extenso" promise the
 * landing page makes to farmers.
 */

import { getDb } from './db';

/** +55…2121 — enough to recognise a farmer, not enough to be a full record. */
export function maskWa(wa: string | null): string {
  if (!wa) return '—';
  const digits = wa.replace(/\D/g, '');
  if (digits.length < 6) return '••••';
  return `+${digits.slice(0, 2)} ••••${digits.slice(-4)}`;
}

// A reply where Stevi couldn't help — distinct from the by-design agrônomo
// handoff. Mirrors the digest's failure heuristic.
const FAILURE_RE =
  /(não consegui|nao consegui|não sei te (responder|dizer)|me pegou|não entendi|nao entendi|tente de novo|tenta de novo|instabilidade)/i;

async function countRows(table: string, filters: (q: any) => any = (q) => q): Promise<number> {
  const db = getDb();
  const { count, error } = await filters(db.from(table).select('id', { count: 'exact', head: true }));
  if (error) return 0;
  return count ?? 0;
}

export interface OpsOverview {
  users: number;
  newUsers7d: number;
  inbound: number;
  outbound: number;
  inbound7d: number;
  referrals: number;
  digests: number;
  failures7d: number;
  activePack: number | null;
  byIntent: Record<string, number>;
}

export async function opsOverview(): Promise<OpsOverview> {
  const db = getDb();
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [users, newUsers7d, inbound, outbound, inbound7d, referrals, digests] = await Promise.all([
    countRows('users'),
    countRows('users', (q) => q.gte('created_at', since7)),
    countRows('messages', (q) => q.eq('direction', 'in')),
    countRows('messages', (q) => q.eq('direction', 'out')),
    countRows('messages', (q) => q.eq('direction', 'in').gte('created_at', since7)),
    countRows('referral_requests'),
    countRows('digests'),
  ]);

  // Intent mix + failures over the last 7 days (bounded fetch).
  const { data: recent } = await db
    .from('messages')
    .select('direction, intent, raw')
    .gte('created_at', since7)
    .limit(3000);
  const rows = (recent ?? []) as Array<{ direction: string; intent: string | null; raw: string | null }>;
  const byIntent: Record<string, number> = {};
  let failures7d = 0;
  for (const r of rows) {
    if (r.direction === 'in' && r.intent) byIntent[r.intent] = (byIntent[r.intent] ?? 0) + 1;
    if (r.direction === 'out' && r.raw && FAILURE_RE.test(r.raw)) failures7d++;
  }

  const { data: pack } = await db
    .from('style_packs')
    .select('version')
    .eq('active', true)
    .maybeSingle();

  return {
    users,
    newUsers7d,
    inbound,
    outbound,
    inbound7d,
    referrals,
    digests,
    failures7d,
    activePack: (pack as { version: number } | null)?.version ?? null,
    byIntent,
  };
}

export interface ConversationRow {
  userId: string;
  phone: string;
  name: string | null;
  uf: string | null;
  crop: string[] | null;
  lastAt: string | null;
  messages: number;
}

/** Recent conversations: one row per farmer, newest activity first. */
export async function opsConversations(limit = 60): Promise<ConversationRow[]> {
  const db = getDb();
  const { data: users } = await db
    .from('users')
    .select('id, wa_id, name, state, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  const list = (users ?? []) as Array<{ id: string; wa_id: string; name: string | null; state: string | null }>;
  if (!list.length) return [];

  const ids = list.map((u) => u.id);
  const [{ data: msgs }, { data: farms }] = await Promise.all([
    db.from('messages').select('user_id, created_at').in('user_id', ids),
    db.from('farms').select('user_id, crop').in('user_id', ids),
  ]);
  const agg = new Map<string, { count: number; last: string | null }>();
  for (const m of (msgs ?? []) as Array<{ user_id: string; created_at: string }>) {
    const a = agg.get(m.user_id) ?? { count: 0, last: null };
    a.count++;
    if (!a.last || m.created_at > a.last) a.last = m.created_at;
    agg.set(m.user_id, a);
  }
  const cropOf = new Map<string, string[] | null>();
  for (const f of (farms ?? []) as Array<{ user_id: string; crop: string[] | null }>) {
    cropOf.set(f.user_id, f.crop);
  }

  return list
    .map((u) => ({
      userId: u.id,
      phone: maskWa(u.wa_id),
      name: u.name,
      uf: u.state,
      crop: cropOf.get(u.id) ?? null,
      lastAt: agg.get(u.id)?.last ?? null,
      messages: agg.get(u.id)?.count ?? 0,
    }))
    .sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));
}

export interface ThreadMessage {
  direction: 'in' | 'out';
  kind: string;
  text: string | null;
  intent: string | null;
  at: string;
}

/** Full message thread for one farmer, oldest first. */
export async function opsThread(userId: string): Promise<ThreadMessage[]> {
  const db = getDb();
  const { data } = await db
    .from('messages')
    .select('direction, kind, raw, transcript, intent, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(400);
  return ((data ?? []) as Array<{
    direction: 'in' | 'out';
    kind: string;
    raw: string | null;
    transcript: string | null;
    intent: string | null;
    created_at: string;
  }>).map((m) => ({
    direction: m.direction,
    kind: m.kind,
    text: m.transcript ?? m.raw,
    intent: m.intent,
    at: m.created_at,
  }));
}

export interface StylePackRow {
  version: number;
  active: boolean;
  notes: string | null;
  chars: number;
  createdAt: string;
  body?: string;
}

export async function opsStylePacks(withBody = false): Promise<StylePackRow[]> {
  const db = getDb();
  const { data } = await db
    .from('style_packs')
    .select('version, active, notes, body, created_at')
    .order('version', { ascending: false });
  return ((data ?? []) as Array<{
    version: number;
    active: boolean;
    notes: string | null;
    body: string;
    created_at: string;
  }>).map((p) => ({
    version: p.version,
    active: p.active,
    notes: p.notes,
    chars: (p.body ?? '').length,
    createdAt: p.created_at,
    ...(withBody ? { body: p.body } : {}),
  }));
}

/** Activate a style-pack version (deactivates the rest). Returns ok. */
export async function opsActivatePack(version: number): Promise<boolean> {
  const db = getDb();
  const { error: e1 } = await db.from('style_packs').update({ active: false }).eq('active', true);
  if (e1) return false;
  const { error: e2 } = await db.from('style_packs').update({ active: true }).eq('version', version);
  return !e2;
}

export interface DigestRow {
  ranAt: string;
  text: string | null;
  stats: unknown;
}

export async function opsDigests(limit = 30): Promise<DigestRow[]> {
  const db = getDb();
  const { data } = await db
    .from('digests')
    .select('ran_at, text, stats')
    .order('ran_at', { ascending: false })
    .limit(limit);
  return ((data ?? []) as Array<{ ran_at: string; text: string | null; stats: unknown }>).map((d) => ({
    ranAt: d.ran_at,
    text: d.text,
    stats: d.stats,
  }));
}
