/**
 * Cohort math for the founder digest — the "which habit loop is working"
 * numbers. Pure functions over user/message rows; the digest queries feed
 * them. Wrong retention math would steer the product wrong quietly, so the
 * edges (empty cohorts, same-day noise, single-day repeats) are pinned.
 */
import { describe, it, expect } from 'vitest';
import { cohortStats, partnerScorecard } from '../api/_lib/cohort';

const NOW = new Date('2026-07-20T12:00:00Z');
const daysAgo = (d: number, h = 0) =>
  new Date(NOW.getTime() - d * 86_400_000 - h * 3_600_000).toISOString();

const inbound = (user: string, at: string) => ({
  user_id: user,
  created_at: at,
  direction: 'in' as const,
  intent: null,
});
const turn = (user: string, at: string, intent: string) => ({
  user_id: user,
  created_at: at,
  direction: 'out' as const,
  intent,
});

describe('cohortStats', () => {
  it('WAU counts distinct farmers this week, with last week as the trend base', () => {
    const s = cohortStats(
      [],
      [
        inbound('a', daysAgo(1)),
        inbound('a', daysAgo(2)),
        inbound('b', daysAgo(3)),
        inbound('c', daysAgo(9)), // previous week only
      ],
      NOW
    );
    expect(s.wau).toBe(2);
    expect(s.wauPrev).toBe(1);
  });

  it('D7 retention: cohort = created 7–14d ago; retained = came back ≥24h after signup', () => {
    const users = [
      { id: 'u1', created_at: daysAgo(10) }, // returns on day +2 → retained
      { id: 'u2', created_at: daysAgo(10) }, // only signup-day messages → NOT retained
      { id: 'u3', created_at: daysAgo(9) }, // never returns → not retained
      { id: 'u4', created_at: daysAgo(3) }, // too recent — not in cohort
    ];
    const msgs = [
      inbound('u1', daysAgo(10)),
      inbound('u1', daysAgo(8)),
      inbound('u2', daysAgo(10)),
      inbound('u2', daysAgo(10, -2)), // 2h later, same signup window
      inbound('u4', daysAgo(1)),
    ];
    const s = cohortStats(users, msgs, NOW);
    expect(s.d7).toEqual({ size: 3, retained: 1, rate: 1 / 3 });
  });

  it('an empty cohort reports null rate (not 0% — no evidence is not bad evidence)', () => {
    const s = cohortStats([{ id: 'u', created_at: daysAgo(2) }], [], NOW);
    expect(s.d7.size).toBe(0);
    expect(s.d7.rate).toBeNull();
  });

  it('habit-by-intent: repeaters used the intent on ≥2 DIFFERENT days this week', () => {
    const msgs = [
      turn('a', daysAgo(1), 'prices'),
      turn('a', daysAgo(3), 'prices'), // a: 2 days → repeater
      turn('b', daysAgo(2), 'prices'),
      turn('b', daysAgo(2, -3), 'prices'), // b: twice same day → NOT a repeater
      turn('c', daysAgo(2), 'spray_window'),
      turn('a', daysAgo(9), 'prices'), // outside the week
      turn('a', daysAgo(1), 'send_failed'), // noise intents excluded
      turn('a', daysAgo(1), 'rate_limited'),
    ];
    const s = cohortStats([], msgs, NOW);
    const prices = s.habits.find((h) => h.intent === 'prices')!;
    expect(prices.users).toBe(2);
    expect(prices.repeaters).toBe(1);
    expect(s.habits.find((h) => h.intent === 'send_failed')).toBeUndefined();
    expect(s.habits.find((h) => h.intent === 'spray_window')).toMatchObject({ users: 1, repeaters: 0 });
  });
});

describe('partnerScorecard', () => {
  it('rolls up the lead pipeline and closes rate over DECIDED leads only', () => {
    const rows = [
      { status: 'novo', created_at: daysAgo(1) },
      { status: 'novo', created_at: daysAgo(20) },
      { status: 'contatado', created_at: daysAgo(2) },
      { status: 'fechado', created_at: daysAgo(3) },
      { status: 'fechado', created_at: daysAgo(30) },
      { status: null, created_at: daysAgo(4) }, // legacy null = novo
    ];
    const s = partnerScorecard(rows, NOW);
    expect(s.open).toBe(3);
    expect(s.leads7d).toBe(4);
    expect(s.closed).toBe(2);
    // decided = contatado+fechado = 3 → close rate 2/3
    expect(s.closeRate).toBeCloseTo(2 / 3);
  });

  it('no decided leads → null close rate', () => {
    expect(partnerScorecard([{ status: 'novo', created_at: daysAgo(1) }], NOW).closeRate).toBeNull();
  });
});
