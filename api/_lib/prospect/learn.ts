/**
 * Market learning loop — Vitória gets better from real conversations. A weekly
 * job (monitor cron, Mondays BRT) computes funnel stats and mines recent
 * prospect threads for durable learnings (common objections, phrasings that
 * moved conversations forward). The latest playbook is injected into the
 * agent prompt as an INFORMATIONAL block — the hard rules (no prices, no
 * invented claims, escalation) always win over anything learned.
 */

import { getDb } from '../db';
import { chat } from '../llm';
import { MODELS } from '../env';
import { createLogger } from '../logger';

const log = createLogger('prospect-learn');

export interface FunnelStats {
  total: number;
  contacted: number;
  replied: number;
  /** Converted: prospects promoted to active partners (terminal, happy). */
  partners: number;
  optedOut: number;
  replyRateByKind: Record<string, string>;
}

// Statuses that imply a first touch went out. 'partner' matters here because
// promotion overwrites both status and send_status — without it the funnel
// would "lose" its best outcomes from the reply rate.
const POST_CONTACT = new Set(['contacted', 'replied', 'partner', 'stale']);
const REPLIED = new Set(['replied', 'partner']);
// Status webhooks progress send_status past 'sent' — all of these mean a
// first touch went out.
const SENT_LIKE = new Set(['sent', 'delivered', 'read']);

/** Pure rollup of the prospect funnel. */
export function computeFunnelStats(
  prospects: Array<{ kind: string | null; status: string; send_status: string | null }>,
  optouts: number
): FunnelStats {
  const contacted = prospects.filter(
    (p) => (p.send_status != null && SENT_LIKE.has(p.send_status)) || POST_CONTACT.has(p.status)
  );
  const replied = prospects.filter((p) => REPLIED.has(p.status));
  const partners = prospects.filter((p) => p.status === 'partner');
  const byKind: Record<string, { c: number; r: number }> = {};
  for (const p of contacted) {
    const k = p.kind ?? 'outro';
    byKind[k] = byKind[k] ?? { c: 0, r: 0 };
    byKind[k].c++;
    if (REPLIED.has(p.status)) byKind[k].r++;
  }
  const replyRateByKind: Record<string, string> = {};
  for (const [k, v] of Object.entries(byKind)) {
    replyRateByKind[k] = `${v.r}/${v.c}`;
  }
  return {
    total: prospects.length,
    contacted: contacted.length,
    replied: replied.length,
    partners: partners.length,
    optedOut: optouts,
    replyRateByKind,
  };
}

const MAX_LEARNINGS = 6;
const MAX_BLOCK_CHARS = 700;

/** The bounded prompt block. Informational by construction. */
export function playbookBlock(learnings: string[]): string | null {
  if (!learnings.length) return null;
  const lines = learnings.slice(0, MAX_LEARNINGS).map((l) => `- ${l.replace(/\s+/g, ' ').slice(0, 110)}`);
  const block =
    `APRENDIZADOS DO MERCADO (informativo — as REGRAS DURAS acima sempre prevalecem):\n` +
    lines.join('\n');
  return block.slice(0, MAX_BLOCK_CHARS);
}

/** Latest playbook learnings, or [] when none yet. */
export async function loadPlaybook(): Promise<string[]> {
  const db = getDb();
  const { data, error } = await db
    .from('prospect_playbook')
    .select('learnings')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    log.error('loadPlaybook failed:', error.message);
    return [];
  }
  return ((data as { learnings: string[] } | null)?.learnings ?? []).filter(
    (l): l is string => typeof l === 'string'
  );
}

/**
 * Weekly learning run: funnel stats + LLM-mined learnings from recent threads.
 * Persists a new playbook row; returns it for the cron report.
 */
export async function runProspectLearning(): Promise<{ stats: FunnelStats; learnings: string[] }> {
  const db = getDb();
  const [{ data: prospects }, { count: optouts }, { data: msgs }] = await Promise.all([
    db.from('prospects').select('kind, status, send_status'),
    db.from('prospect_optouts').select('phone', { count: 'exact', head: true }),
    db
      .from('prospect_messages')
      .select('prospect_id, direction, text, created_at')
      .gte('created_at', new Date(Date.now() - 14 * 86_400_000).toISOString())
      .order('created_at', { ascending: true })
      .limit(400),
  ]);

  const stats = computeFunnelStats(
    (prospects ?? []) as Array<{ kind: string | null; status: string; send_status: string | null }>,
    optouts ?? 0
  );

  let learnings: string[] = [];
  const rows = (msgs ?? []) as Array<{ prospect_id: string; direction: string; text: string | null }>;
  if (rows.length >= 4) {
    const convo = rows
      .map((m) => `${m.direction === 'in' ? 'PROSPECT' : 'VITÓRIA'}: ${(m.text ?? '').slice(0, 200)}`)
      .join('\n')
      .slice(-8000);
    try {
      const raw = await chat({
        model: MODELS.reasoning(),
        maxTokens: 400,
        system:
          'Você analisa conversas de prospecção B2B (parcerias com agrônomos/revendas/coops no interior de MG). ' +
          'Extraia até 6 aprendizados ACIONÁVEIS e duráveis: objeções recorrentes, o que gerou resposta positiva, ' +
          'vocabulário que funciona, horários/padrões. Nada de conclusões sem base no texto. ' +
          'Responda SÓ um array JSON de strings curtas (máx 110 caracteres cada).',
        user: convo,
      });
      const json = raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1);
      learnings = (JSON.parse(json) as unknown[])
        .filter((l): l is string => typeof l === 'string')
        .slice(0, MAX_LEARNINGS);
    } catch (e) {
      log.error('learning extraction failed:', (e as Error).message);
    }
  }

  // Persist even an empty learnings run — the stats history is itself signal.
  const { error } = await db.from('prospect_playbook').insert({ learnings, stats });
  if (error) log.error('playbook insert failed:', error.message);

  log.info(`learning run: ${learnings.length} learnings, stats ${JSON.stringify(stats)}`);
  return { stats, learnings };
}
