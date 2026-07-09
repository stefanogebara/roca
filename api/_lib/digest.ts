/**
 * Founder daily digest — turns the message log into validation signal.
 *
 * Stevi records every conversation but nothing surfaced it. This computes a
 * 24h rollup (volume, intent mix, media kinds, referrals, failures, sample
 * questions) so the founder can SEE what farmers actually ask — and where Stevi
 * fell short. `formatDigest` is pure (unit-tested); `computeDigestStats` queries.
 */

import { getDb } from './db';
import { createLogger } from './logger';

const log = createLogger('digest');

export interface DigestStats {
  since: string;
  until: string;
  inboundTotal: number;
  uniqueUsers: number;
  newUsers: number;
  byIntent: Record<string, number>;
  byKind: Record<string, number>;
  referrals: number;
  failures: number;
  sampleQuestions: string[];
}

// Outbound replies that mean Stevi couldn't help — real gaps worth the founder's
// attention (distinct from the receituário handoff, which is by design).
const FAILURE_RE =
  /não consegui|nao consegui|tive um problema|não deu pra|nao deu pra|não entendi|nao entendi/i;

interface MsgRow {
  direction: 'in' | 'out';
  kind: string | null;
  intent: string | null;
  raw: string | null;
  user_id: string | null;
  created_at: string;
}

/** Query the message log for a period and roll it up. */
export async function computeDigestStats(since: string, until: string): Promise<DigestStats> {
  const db = getDb();

  const { data: msgs, error } = await db
    .from('messages')
    .select('direction, kind, intent, raw, user_id, created_at')
    .gte('created_at', since)
    .lt('created_at', until)
    .order('created_at', { ascending: false });
  if (error) log.error('digest messages query failed:', error.message);
  const rows = (msgs ?? []) as MsgRow[];

  const inbound = rows.filter((r) => r.direction === 'in');
  const outbound = rows.filter((r) => r.direction === 'out');

  const uniqueUsers = new Set(inbound.map((r) => r.user_id).filter(Boolean)).size;

  const byIntent: Record<string, number> = {};
  for (const r of outbound) {
    const k = r.intent || 'desconhecido';
    byIntent[k] = (byIntent[k] ?? 0) + 1;
  }

  const byKind: Record<string, number> = {};
  for (const r of inbound) {
    const k = r.kind || 'desconhecido';
    byKind[k] = (byKind[k] ?? 0) + 1;
  }

  // Failure = a couldn't-help reply, or a reply the farmer never received
  // (send exhausted its retries; pipeline records it as intent 'send_failed').
  const failures = outbound.filter(
    (r) => r.intent === 'send_failed' || (r.raw && FAILURE_RE.test(r.raw))
  ).length;

  const sampleQuestions = inbound
    .filter((r) => r.raw && r.raw.trim().length > 0)
    .slice(0, 6)
    .map((r) => (r.raw as string).replace(/\s+/g, ' ').slice(0, 90));

  const [{ count: newUsers }, { count: referrals }] = await Promise.all([
    db
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since)
      .lt('created_at', until),
    db
      .from('referral_requests')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since)
      .lt('created_at', until),
  ]);

  return {
    since,
    until,
    inboundTotal: inbound.length,
    uniqueUsers,
    newUsers: newUsers ?? 0,
    byIntent,
    byKind,
    referrals: referrals ?? 0,
    failures,
    sampleQuestions,
  };
}

function dm(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}

function topEntries(rec: Record<string, number>): string {
  const entries = Object.entries(rec).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return '—';
  return entries.map(([k, v]) => `${k} ${v}`).join(' · ');
}

/** Format the digest as a compact, WhatsApp-friendly PT-BR message. Pure. */
export function formatDigest(s: DigestStats): string {
  const lines: string[] = [];
  lines.push(`🌱 *Stevi — resumo do dia* (${dm(s.since)}→${dm(s.until)})`);
  lines.push('');
  lines.push(`👥 ${s.inboundTotal} mensagens de ${s.uniqueUsers} produtor(es) · ${s.newUsers} novo(s)`);
  if (s.inboundTotal === 0) {
    lines.push('');
    lines.push('Nenhuma conversa no período. 🤙');
    return lines.join('\n');
  }
  lines.push(`🎯 Intenções: ${topEntries(s.byIntent)}`);
  lines.push(`📎 Tipos: ${topEntries(s.byKind)}`);
  if (s.referrals > 0) lines.push(`🤝 Pedidos de agrônomo: ${s.referrals}`);
  lines.push(`${s.failures > 0 ? '⚠️' : '✅'} Falhas (não ajudou): ${s.failures}`);
  if (s.sampleQuestions.length > 0) {
    lines.push('');
    lines.push('💬 Amostras do que perguntaram:');
    for (const q of s.sampleQuestions) lines.push(`• ${q}`);
  }
  return lines.join('\n');
}
