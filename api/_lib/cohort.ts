/**
 * Cohort math for the founder digest — pure. The questions these answer steer
 * the roadmap: is usage growing (WAU trend), do farmers come BACK (D7
 * retention), and which intent is becoming a habit (repeat use on distinct
 * days). Wrong math here steers the product quietly wrong, so it's all pure
 * and pinned by tests; digest.ts feeds it rows.
 */

const WEEK_MS = 7 * 86_400_000;
const DAY_MS = 86_400_000;

// Turn intents that are noise for habit purposes (not farmer value events).
const HABIT_EXCLUDE = new Set([
  'send_failed',
  'rate_limited',
  'prospect_optout',
  'prospect_agent',
  'partner_dossier',
]);

export interface CohortMsg {
  user_id: string | null;
  created_at: string;
  direction: 'in' | 'out';
  intent: string | null;
}

export interface D7Slice {
  size: number;
  retained: number;
  rate: number | null;
}

export interface CohortStats {
  wau: number;
  wauPrev: number;
  d7: D7Slice;
  /** The flight plan's gate variable: retention of farmers who arrived with a
   * source token (vouchados) vs. everyone else. */
  d7Vouched: D7Slice;
  d7Organic: D7Slice;
  /** New signups by source in the last 7 days ('orgânico' for none). */
  newSources: Array<{ source: string; count: number }>;
  /** Top intents by weekly users, with how many used them on ≥2 distinct days. */
  habits: Array<{ intent: string; users: number; repeaters: number }>;
}

/**
 * Compute weekly-active, D7 retention and habit-by-intent.
 * - WAU: distinct farmers with INBOUND in the last 7 days (prev week = trend).
 * - D7 cohort: users created 7–14 days ago; retained = an inbound ≥24h after
 *   signup and within 7 days of it (same-session chatter doesn't count as
 *   "came back"). Empty cohort → rate null: no evidence isn't bad evidence.
 * - Habits: outbound turns (intent lives on the reply row) in the last 7 days;
 *   a repeater used the intent on ≥2 DIFFERENT days.
 */
export function cohortStats(
  users: Array<{ id: string; created_at: string; source?: string | null }>,
  messages: CohortMsg[],
  now: Date
): CohortStats {
  const t = now.getTime();

  const inbound = messages.filter((m) => m.direction === 'in' && m.user_id);
  const inWindow = (m: CohortMsg, from: number, to: number) => {
    const ts = new Date(m.created_at).getTime();
    return ts >= from && ts < to;
  };
  const wau = new Set(inbound.filter((m) => inWindow(m, t - WEEK_MS, t)).map((m) => m.user_id)).size;
  const wauPrev = new Set(
    inbound.filter((m) => inWindow(m, t - 2 * WEEK_MS, t - WEEK_MS)).map((m) => m.user_id)
  ).size;

  const cohort = users.filter((u) => {
    const created = new Date(u.created_at).getTime();
    return created >= t - 2 * WEEK_MS && created < t - WEEK_MS;
  });
  const cameBack = (u: { id: string; created_at: string }): boolean => {
    const created = new Date(u.created_at).getTime();
    return inbound.some((m) => {
      if (m.user_id !== u.id) return false;
      const ts = new Date(m.created_at).getTime();
      return ts >= created + DAY_MS && ts <= created + WEEK_MS;
    });
  };
  const slice = (members: typeof cohort): D7Slice => {
    const retained = members.filter(cameBack).length;
    return { size: members.length, retained, rate: members.length ? retained / members.length : null };
  };
  const d7 = slice(cohort);
  const d7Vouched = slice(cohort.filter((u) => u.source));
  const d7Organic = slice(cohort.filter((u) => !u.source));

  const bySource = new Map<string, number>();
  for (const u of users) {
    const created = new Date(u.created_at).getTime();
    if (created < t - WEEK_MS || created >= t) continue;
    const s = u.source || 'orgânico';
    bySource.set(s, (bySource.get(s) ?? 0) + 1);
  }
  const newSources = [...bySource.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  const turns = messages.filter(
    (m) =>
      m.direction === 'out' &&
      m.user_id &&
      m.intent &&
      !HABIT_EXCLUDE.has(m.intent) &&
      inWindow(m, t - WEEK_MS, t)
  );
  const byIntent = new Map<string, Map<string, Set<string>>>(); // intent → user → days
  for (const m of turns) {
    const intent = m.intent as string;
    // Farmer-local (BRT, UTC-3, no DST) day: the UTC boundary falls at 21:00
    // local — peak usage — and would split one evening session into two
    // "distinct days" (false repeater) while merging late-night + next-morning.
    const day = new Date(new Date(m.created_at).getTime() - 3 * 3_600_000)
      .toISOString()
      .slice(0, 10);
    const users = byIntent.get(intent) ?? new Map<string, Set<string>>();
    const days = users.get(m.user_id as string) ?? new Set<string>();
    days.add(day);
    users.set(m.user_id as string, days);
    byIntent.set(intent, users);
  }
  const habits = [...byIntent.entries()]
    .map(([intent, userDays]) => ({
      intent,
      users: userDays.size,
      repeaters: [...userDays.values()].filter((days) => days.size >= 2).length,
    }))
    .sort((a, b) => b.users - a.users);

  return { wau, wauPrev, d7, d7Vouched, d7Organic, newSources, habits };
}

export interface PartnerScore {
  open: number;
  leads7d: number;
  closed: number;
  /** fechado / (contatado + fechado) — conversion-SO-FAR of forwarded leads.
   * 'contatado' means delivered-and-waiting, not lost (there is no terminal
   * negative status yet), so this number can only rise as leads resolve;
   * early low values mean "pending", not "failing". Null until anything has
   * been forwarded. */
  closeRate: number | null;
}

/** Lead-pipeline rollup for the partner side of the business. Pure. */
export function partnerScorecard(
  rows: Array<{ status: string | null; created_at: string }>,
  now: Date
): PartnerScore {
  const weekStart = now.getTime() - WEEK_MS;
  const open = rows.filter((r) => !r.status || r.status === 'novo' || r.status === 'new').length;
  const leads7d = rows.filter((r) => new Date(r.created_at).getTime() >= weekStart).length;
  const closed = rows.filter((r) => r.status === 'fechado').length;
  const decided = rows.filter((r) => r.status === 'contatado' || r.status === 'fechado').length;
  return { open, leads7d, closed, closeRate: decided ? closed / decided : null };
}
