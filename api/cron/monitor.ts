/**
 * Daily monitor (dossier Part 9.3) — the legitimate "24/7": one scheduled
 * function, one digest. Watches genuinely fast-moving, decision-relevant items
 * so the knowledge base stays fresh, without a swarm of agents.
 *
 * v1 (robust, grounded, no fragile scraping):
 *  - upcoming vazio sanitário transitions (next 7 days) from the grounded table
 *  - portaria staleness heuristic (are the 2026/27 windows past their season?)
 * Each run is recorded in monitor_runs for an audit trail. Cost: 1 invocation/day.
 *
 * Auth: CRON_SECRET bearer (Vercel cron sends it). maxDuration kept low.
 * Extension path (Stage 3): diff EMBRAPA/MAPA advisory feeds, notify the founder.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { upcomingTransitions, isCalendarStale } from '../_lib/tools/calendar';
import { runVazioAlerts, runFrostAlerts, type AlertRunResult } from '../_lib/alerts';
import { TwilioAdapter } from '../_lib/transport/twilio';
import { getDb } from '../_lib/db';
import { createLogger } from '../_lib/logger';

const log = createLogger('monitor');

function authorized(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
  const auth = req.headers['authorization'];
  return auth === `Bearer ${secret}`;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (!authorized(req)) {
    res.status(401).json({ success: false, error: 'unauthorized' });
    return;
  }

  const now = new Date();
  const transitions = upcomingTransitions(now, 7);
  const stale = isCalendarStale(now);

  const findings: string[] = [];
  for (const t of transitions) {
    const verb = t.kind === 'vazio_start' ? 'começa' : 'termina';
    findings.push(
      `Vazio sanitário ${verb} em ${t.uf} em ${t.daysAway} dia(s) (${t.date}).`
    );
  }
  if (stale) {
    findings.push(
      'Calendário de vazio sanitário 2026/27 provavelmente vencido — buscar a nova portaria MAPA e rodar scripts/agrofit-extract + atualizar calendar.ts.'
    );
  }

  // Proactive farmer alerts: soy growers in a transitioning UF get one
  // WhatsApp heads-up per transition (DB-claimed dedup — the same transition
  // showing up 7 days in a row alerts each farmer once). Fail-soft: an alert
  // problem never fails the monitoring run itself.
  let alerts: AlertRunResult | null = null;
  let frost: AlertRunResult | null = null;
  try {
    const adapter = new TwilioAdapter();
    alerts = await runVazioAlerts(transitions, (to, text) => adapter.send({ to, text }));
    if (alerts.sent > 0 || alerts.failed > 0) {
      findings.push(`Alertas de vazio: ${alerts.sent} enviado(s), ${alerts.failed} falha(s).`);
    }
    // Frost (geada) alerts — daily min forecast per farm pin, July–Aug matters
    // most for MG coffee. Same dedup discipline as vazio.
    frost = await runFrostAlerts((to, text) => adapter.send({ to, text }));
    if (frost.sent > 0 || frost.failed > 0) {
      findings.push(`Alertas de geada: ${frost.sent} enviado(s), ${frost.failed} falha(s).`);
    }
  } catch (e) {
    log.error('alerts run failed:', (e as Error).message);
  }

  // Record the run (best-effort; a DB hiccup shouldn't fail the cron).
  try {
    const db = getDb();
    const { error } = await db.from('monitor_runs').insert({
      ran_at: now.toISOString(),
      transitions_count: transitions.length,
      stale,
      findings,
    });
    if (error) log.error('monitor_runs insert failed:', error.message);
  } catch (e) {
    log.error('monitor persistence failed:', (e as Error).message);
  }

  res.status(200).json({
    success: true,
    data: { ran_at: now.toISOString(), stale, transitions, findings, alerts, frost },
  });
}
