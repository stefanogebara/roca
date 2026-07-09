/**
 * Agrônomo leads for the ops console — the monetization signal. Every explicit
 * "quero um agrônomo" opt-in lands in referral_requests; this surfaces them as
 * an actionable list for the founders (stefano + vitoria) with the phone masked
 * (LGPD). Kept in its own module so it doesn't touch the churny opsData.ts.
 */

import { getDb } from './db';
import { maskWa } from './opsData';
import { createLogger } from './logger';

const log = createLogger('ops-leads');

/** Lead pipeline states (the mini-CRM). Legacy 'new' rows read as 'novo'. */
export const LEAD_STATUSES = ['novo', 'contatado', 'fechado'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export function isLeadStatus(s: unknown): s is LeadStatus {
  return typeof s === 'string' && (LEAD_STATUSES as readonly string[]).includes(s);
}

/** Normalise stored status (older rows may hold 'new') to a display value. */
function normStatus(s: string | null): LeadStatus {
  if (s === 'contatado' || s === 'fechado') return s;
  return 'novo';
}

/** Update a lead's pipeline status. Returns whether the write succeeded. */
export async function setLeadStatus(id: string, status: LeadStatus): Promise<boolean> {
  const db = getDb();
  const { error } = await db.from('referral_requests').update({ status }).eq('id', id);
  if (error) {
    log.error('setLeadStatus failed:', error.message);
    return false;
  }
  return true;
}

export interface LeadRow {
  id: string;
  /** Masked phone, e.g. "+55 ••••2121". */
  phone: string;
  uf: string | null;
  crop: string[] | null;
  topic: string | null;
  status: LeadStatus;
  at: string;
}

/** Recent agrônomo-referral opt-ins, newest first, phone masked. */
export async function opsLeads(): Promise<LeadRow[]> {
  const db = getDb();
  const { data: reqs, error } = await db
    .from('referral_requests')
    .select('id, user_id, uf, crop, topic, status, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    log.error('opsLeads failed:', error.message);
    return [];
  }
  const rows = (reqs ?? []) as Array<{
    id: string;
    user_id: string | null;
    uf: string | null;
    crop: string[] | null;
    topic: string | null;
    status: string | null;
    created_at: string;
  }>;

  // Resolve masked phones in one batch (same pattern as opsData conversations).
  const ids = [...new Set(rows.map((r) => r.user_id).filter((v): v is string => !!v))];
  const phoneById = new Map<string, string>();
  if (ids.length) {
    const { data: users } = await db.from('users').select('id, wa_id').in('id', ids);
    for (const u of (users ?? []) as Array<{ id: string; wa_id: string }>) {
      phoneById.set(u.id, u.wa_id);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    phone: maskWa(r.user_id ? phoneById.get(r.user_id) ?? null : null),
    uf: r.uf,
    crop: r.crop,
    topic: r.topic,
    status: normStatus(r.status),
    at: r.created_at,
  }));
}
