/**
 * Proactive farmer alerts — the retention loop. v1: vazio sanitário transitions
 * (from the grounded calendar) pushed to soy growers in the affected UF, via
 * the daily monitor cron. Each farmer is alerted once per transition (DB-claimed
 * dedup), and alerts go ONLY to farmers — founder channels are not touched.
 *
 * Discipline: alerts are deterministic, grounded (portaria-cited), and never
 * prescriptive — the same triage-not-prescription line as replies. The referral
 * nudge is an offer, not a push.
 */

import type { CalendarTransition } from './tools/calendar';
import { listSojaFarmersByUf, claimFarmerAlert, releaseFarmerAlert } from './db';
import { withRetry } from './retry';
import { createLogger } from './logger';

const log = createLogger('alerts');

/** Stable per-transition identity — daysAway shrinks daily, the event doesn't. */
export function alertDedupKey(t: CalendarTransition): string {
  return `${t.kind}:${t.uf}:${t.date}`;
}

function dias(n: number): string {
  return n === 1 ? '1 dia' : `${n} dias`;
}

/** WhatsApp-ready PT-BR alert for a vazio transition. Pure — unit-tested. */
export function buildVazioAlertText(t: CalendarTransition): string {
  if (t.kind === 'vazio_start') {
    return (
      `⚠️ Atenção: o vazio sanitário da soja em ${t.uf} começa em ${dias(t.daysAway)} ` +
      `(Portaria SDA/MAPA nº 1.579/2026). A partir daí, nada de soja viva no campo — nem guaxa. ` +
      `Isso corta a ponte da ferrugem pra próxima safra.\n\n` +
      `Se quiser, te explico o que checar na sua área, ou te conecto com um agrônomo. 🌱`
    );
  }
  return (
    `📅 Boa notícia: o vazio sanitário da soja em ${t.uf} termina em ${dias(t.daysAway)} ` +
    `(Portaria SDA/MAPA nº 1.579/2026). Dá pra começar a planejar o plantio.\n\n` +
    `Quer o veredito da janela de pulverização ou uma olhada de satélite na sua área antes? É só pedir. 🌱`
  );
}

export interface AlertRunResult {
  transitions: number;
  candidates: number;
  sent: number;
  failed: number;
}

/**
 * Push vazio alerts for the given transitions. `send` is the farmer-facing
 * transport (adapter.send bound by the caller). Fail-soft per farmer; a claim
 * that fails (already alerted or DB error) skips the send — never double-pings.
 */
export async function runVazioAlerts(
  transitions: CalendarTransition[],
  send: (to: string, text: string) => Promise<void>
): Promise<AlertRunResult> {
  const result: AlertRunResult = { transitions: transitions.length, candidates: 0, sent: 0, failed: 0 };
  for (const t of transitions) {
    const farmers = await listSojaFarmersByUf(t.uf);
    result.candidates += farmers.length;
    const text = buildVazioAlertText(t);
    const key = alertDedupKey(t);
    for (const f of farmers) {
      const claimed = await claimFarmerAlert(f.userId, t.kind, key);
      if (!claimed) continue;
      try {
        await withRetry(() => send(f.waId, text), { attempts: 2 });
        result.sent++;
      } catch (e) {
        result.failed++;
        log.error(`vazio alert to user ${f.userId} failed:`, (e as Error).message);
        // Release the claim so tomorrow's run retries this farmer.
        await releaseFarmerAlert(f.userId, key);
      }
    }
  }
  return result;
}
