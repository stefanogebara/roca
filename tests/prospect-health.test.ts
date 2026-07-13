/**
 * Number-health machinery — the graded cap ramp's pure core. Three parts:
 * the monotonic send-status machine (Meta callbacks arrive late, duplicated
 * and out of order; a reply must never regress to 'read'), the trailing-week
 * health aggregation, and the cap ladder (trust earned in numbers: volume +
 * health raise the cap 20→60; degradation drops to a trickle; severe pauses).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  nextSendStatus,
  computeHealth,
  gradeCap,
  envCapOverride,
  isLatchedFrom,
  HEALTH,
} from '../api/_lib/prospect/health';
import { parseCloudStatuses } from '../api/_lib/transport/cloud';

const NOW = new Date('2026-07-20T15:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

describe('nextSendStatus (monotonic machine)', () => {
  it('progresses forward: sending→sent→delivered→read', () => {
    expect(nextSendStatus('sending', 'sent')).toBe('sent');
    expect(nextSendStatus('sent', 'delivered')).toBe('delivered');
    expect(nextSendStatus('delivered', 'read')).toBe('read');
    expect(nextSendStatus('sent', 'read')).toBe('read'); // skipped 'delivered' is fine
  });

  it('a stranded claim heals when Meta confirms the send left', () => {
    expect(nextSendStatus('sending', 'delivered')).toBe('delivered');
    expect(nextSendStatus('sending', 'read')).toBe('read');
  });

  it('never regresses: replied and read are sticky', () => {
    expect(nextSendStatus('replied', 'read')).toBeNull();
    expect(nextSendStatus('replied', 'delivered')).toBeNull();
    expect(nextSendStatus('read', 'delivered')).toBeNull();
    expect(nextSendStatus('delivered', 'sent')).toBeNull();
  });

  it('duplicates are ignored', () => {
    expect(nextSendStatus('delivered', 'delivered')).toBeNull();
    expect(nextSendStatus('sent', 'sent')).toBeNull();
  });

  it('failed only lands from sending/sent — a delivered message cannot "fail"', () => {
    expect(nextSendStatus('sending', 'failed')).toBe('failed');
    expect(nextSendStatus('sent', 'failed')).toBe('failed');
    expect(nextSendStatus('delivered', 'failed')).toBeNull();
    expect(nextSendStatus('replied', 'failed')).toBeNull();
  });

  it('a deliberately reset row (null) ignores late callbacks', () => {
    expect(nextSendStatus(null, 'delivered')).toBeNull();
    expect(nextSendStatus(null, 'failed')).toBeNull();
  });
});

describe('computeHealth', () => {
  it('aggregates the window, excluding too-recent sends and stranded claims', () => {
    const sends = [
      { sent_at: hoursAgo(30), send_status: 'delivered' },
      { sent_at: hoursAgo(30), send_status: 'read' },
      { sent_at: hoursAgo(30), send_status: 'replied' }, // replied implies delivered
      { sent_at: hoursAgo(30), send_status: 'sent' }, // 30h without delivery = presumed undelivered
      { sent_at: hoursAgo(30), send_status: 'failed' },
      { sent_at: hoursAgo(1), send_status: 'sent' }, // too recent — grace period
      { sent_at: hoursAgo(30), send_status: 'sending' }, // stranded claim — ops issue, not number health
    ];
    const h = computeHealth(sends, 1, NOW);
    expect(h.windowSends).toBe(5);
    expect(h.delivered).toBe(3);
    expect(h.failed).toBe(1);
    expect(h.deliveredRate).toBeCloseTo(3 / 5);
    expect(h.failRate).toBeCloseTo(1 / 5);
    expect(h.optoutRate).toBeCloseTo(1 / 5);
  });

  it('an empty window is all zeros, no NaN', () => {
    const h = computeHealth([], 0, NOW);
    expect(h.windowSends).toBe(0);
    expect(h.deliveredRate).toBe(0);
    expect(h.optoutRate).toBe(0);
  });

  it('sends from BEFORE status tracking went live are not graded — they can never become delivered', () => {
    // Launch trap caught pre-Monday: 20 legacy 'sent' rows (no callbacks ever
    // arrived for them) would read as 0% delivery and pause dispatch on
    // phantom evidence.
    const legacy = { sent_at: '2026-07-10T12:00:00Z', send_status: 'sent' }; // pre-floor
    const fresh = { sent_at: hoursAgo(30), send_status: 'delivered' };
    const h = computeHealth(
      [legacy, legacy, legacy, fresh],
      0,
      NOW,
      '2026-07-13T03:00:00Z' // tracking floor
    );
    expect(h.windowSends).toBe(1);
    expect(h.deliveredRate).toBe(1);
  });
});

const healthy = (over: Partial<ReturnType<typeof computeHealth>> = {}) => ({
  windowSends: 40,
  delivered: 39,
  failed: 0,
  deliveredRate: 0.975,
  failRate: 0,
  optoutRate: 0.02,
  ...over,
});

describe('gradeCap (the ladder)', () => {
  it('warming: not enough evidence keeps the base cap', () => {
    const g = gradeCap(healthy({ windowSends: 5 }), 10);
    expect(g).toMatchObject({ cap: 20, grade: 'warming' });
  });

  it('healthy volume climbs the ladder: 20 → 30 → 45 → 60', () => {
    expect(gradeCap(healthy(), 50).cap).toBe(20);
    expect(gradeCap(healthy(), 80).cap).toBe(30);
    expect(gradeCap(healthy(), 200).cap).toBe(45);
    expect(gradeCap(healthy(), 400).cap).toBe(60);
    expect(gradeCap(healthy(), 400).grade).toBe('healthy');
  });

  it('degradation drops to a trickle regardless of volume', () => {
    const g = gradeCap(healthy({ deliveredRate: 0.75 }), 400);
    expect(g).toMatchObject({ cap: 10, grade: 'degraded' });
    expect(gradeCap(healthy({ optoutRate: 0.09 }), 400).grade).toBe('degraded');
    expect(gradeCap(healthy({ failRate: 0.12 }), 400).grade).toBe('degraded');
  });

  it('severe damage pauses dispatch entirely', () => {
    expect(gradeCap(healthy({ deliveredRate: 0.4 }), 400)).toMatchObject({ cap: 0, grade: 'paused' });
    expect(gradeCap(healthy({ failRate: 0.3 }), 400).grade).toBe('paused');
    expect(gradeCap(healthy({ optoutRate: 0.2 }), 400).grade).toBe('paused');
  });

  it('boundary values sit on the healthy side (≥0.80 delivered is not degraded)', () => {
    expect(gradeCap(healthy({ deliveredRate: HEALTH.degradedBelowDelivered }), 400).grade).toBe('healthy');
  });

  it('reasons name what triggered a downgrade', () => {
    const g = gradeCap(healthy({ deliveredRate: 0.6, optoutRate: 0.09 }), 400);
    expect(g.reasons.join(' ')).toMatch(/entrega/i);
  });
});

describe('isLatchedFrom (pause oscillation latch)', () => {
  const d = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString();

  it('two pause episodes inside 21 days engage the latch', () => {
    expect(isLatchedFrom([d(10), d(2)], NOW)).toBe(true);
  });
  it('one pause, or old pauses outside the window, do not', () => {
    expect(isLatchedFrom([d(2)], NOW)).toBe(false);
    expect(isLatchedFrom([d(30), d(2)], NOW)).toBe(false);
    expect(isLatchedFrom([], NOW)).toBe(false);
  });
});

describe('envCapOverride (the founder lever)', () => {
  beforeEach(() => {
    delete process.env.PROSPECT_DAILY_CAP;
  });
  afterEach(() => {
    delete process.env.PROSPECT_DAILY_CAP;
  });

  it('zero is the emergency stop — never silently ignored', () => {
    process.env.PROSPECT_DAILY_CAP = '0';
    expect(envCapOverride()).toBe(0);
  });

  it('clamps to the ceiling, rejects junk loudly-as-null, absent means graded', () => {
    process.env.PROSPECT_DAILY_CAP = '75';
    expect(envCapOverride()).toBe(60);
    process.env.PROSPECT_DAILY_CAP = '-5';
    expect(envCapOverride()).toBeNull();
    process.env.PROSPECT_DAILY_CAP = 'tudo';
    expect(envCapOverride()).toBeNull();
    delete process.env.PROSPECT_DAILY_CAP;
    expect(envCapOverride()).toBeNull();
  });
});

describe('parseCloudStatuses', () => {
  it('extracts wamid + status across entries and captures failure detail', () => {
    const body = JSON.stringify({
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  { id: 'wamid.A', status: 'delivered', recipient_id: '5535999' },
                  {
                    id: 'wamid.B',
                    status: 'failed',
                    errors: [{ code: 131049, title: 'per-user marketing limit' }],
                  },
                ],
              },
            },
          ],
        },
        { changes: [{ value: { statuses: [{ id: 'wamid.C', status: 'read' }] } }] },
      ],
    });
    const parsed = parseCloudStatuses(body);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toMatchObject({ wamid: 'wamid.A', status: 'delivered' });
    expect(parsed[1].errorDetail).toMatch(/131049/);
    expect(parsed[2]).toMatchObject({ wamid: 'wamid.C', status: 'read' });
  });

  it('returns [] for message payloads, junk, and unknown status values', () => {
    expect(parseCloudStatuses('{"entry":[{"changes":[{"value":{"messages":[{}]}}]}]}')).toEqual([]);
    expect(parseCloudStatuses('not json')).toEqual([]);
    expect(
      parseCloudStatuses(
        JSON.stringify({ entry: [{ changes: [{ value: { statuses: [{ id: 'w', status: 'weird' }] } }] }] })
      )
    ).toEqual([]);
  });
});
