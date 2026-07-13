/**
 * Dispatch engine orchestration — the ban-risk surface. Pins the two rails that
 * pure-function tests can't see: the atomic per-row claim (no double-send when
 * a cron run overlaps a manual painel dispatch) and the intro template
 * pre-flight (an unapproved/paused template must abort the run instead of
 * burning the batch as per-prospect failures).
 *
 * External modules are mocked; personalize/core stay real (pure). The clock is
 * faked to a BRT business-hours instant so runBumpDispatch (which has no
 * `force` escape hatch) can run.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

vi.mock('../api/_lib/prospect/db', () => ({
  loadReadyProspects: vi.fn(),
  loadOptouts: vi.fn(),
  countSentSince: vi.fn(),
  recordSend: vi.fn(),
  recordSendFailed: vi.fn(),
  logProspectMessage: vi.fn(),
  loadBumpDueProspects: vi.fn(),
  recordBump: vi.fn(),
  claimProspectForSend: vi.fn(),
  claimProspectForBump: vi.fn(),
}));
vi.mock('../api/_lib/prospect/send', () => ({ sendProspectTemplate: vi.fn() }));
vi.mock('../api/_lib/prospect/template', () => ({ getTemplateStatus: vi.fn() }));
vi.mock('../api/_lib/alert', () => ({ alertFounders: vi.fn() }));
// gradeCap/envCapOverride stay REAL (the ladder is under test); only the db
// read is mocked.
vi.mock('../api/_lib/prospect/health', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/_lib/prospect/health')>();
  return {
    ...actual,
    loadSendHealth: vi.fn(),
    isDispatchLatched: vi.fn(),
    recordDispatchPause: vi.fn(),
  };
});

import { runDispatch, runBumpDispatch } from '../api/_lib/prospect/dispatch';
import {
  loadSendHealth,
  isDispatchLatched,
  recordDispatchPause,
} from '../api/_lib/prospect/health';
import {
  loadReadyProspects,
  loadOptouts,
  countSentSince,
  recordSend,
  recordSendFailed,
  logProspectMessage,
  loadBumpDueProspects,
  recordBump,
  claimProspectForSend,
  claimProspectForBump,
  type ProspectRow,
} from '../api/_lib/prospect/db';
import { sendProspectTemplate } from '../api/_lib/prospect/send';
import { getTemplateStatus } from '../api/_lib/prospect/template';
import { alertFounders } from '../api/_lib/alert';

const prospect = (over: Partial<ProspectRow> = {}): ProspectRow => ({
  id: 'p1',
  name: 'Agro Forte',
  kind: 'agronomo',
  city: 'Varginha',
  uf: 'MG',
  phone: '+5535999990000',
  wa_status: 'valid',
  source: 'manual',
  status: 'ready',
  // Fixture kind sits inside the default PROSPECT_SEND_KINDS gate.
  notes: null,
  sent_at: null,
  send_status: null,
  wamid: null,
  template_used: null,
  touches: 0,
  created_at: '2026-07-10T12:00:00Z',
  updated_at: '2026-07-10T12:00:00Z',
  ...over,
});

// Tuesday 15:00 BRT — inside the outreach window, so runBumpDispatch (no
// `force` option) can execute. Only Date is faked; timers stay real.
vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-07-14T15:00:00-03:00') });
afterAll(() => vi.useRealTimers());

// Healthy-but-young number: grade 'healthy' but lifetime 10 sits below every
// ladder tier, so the cap stays at the base 20 and pre-ramp tests keep their
// behavior.
const WARM_HEALTH = {
  health: { windowSends: 40, delivered: 39, failed: 0, deliveredRate: 0.975, failRate: 0, optoutRate: 0.02 },
  lifetimeSends: 10,
};

beforeEach(() => {
  vi.clearAllMocks();
  // A host-environment override would silently flip every test to the manual
  // path — the suite must own these variables.
  delete process.env.PROSPECT_DAILY_CAP;
  delete process.env.PROSPECT_SEND_KINDS;
  vi.mocked(loadSendHealth).mockResolvedValue(WARM_HEALTH);
  vi.mocked(isDispatchLatched).mockResolvedValue(false);
  vi.mocked(recordDispatchPause).mockResolvedValue(undefined);
  vi.mocked(getTemplateStatus).mockResolvedValue({ name: 'x', status: 'APPROVED' });
  vi.mocked(loadOptouts).mockResolvedValue(new Set());
  vi.mocked(countSentSince).mockResolvedValue(0);
  vi.mocked(loadReadyProspects).mockResolvedValue([]);
  vi.mocked(loadBumpDueProspects).mockResolvedValue([]);
  vi.mocked(claimProspectForSend).mockResolvedValue(true);
  vi.mocked(claimProspectForBump).mockResolvedValue(true);
  vi.mocked(sendProspectTemplate).mockResolvedValue({ wamid: 'wamid-1' });
  vi.mocked(recordSend).mockResolvedValue(undefined);
  vi.mocked(recordBump).mockResolvedValue(undefined);
  vi.mocked(recordSendFailed).mockResolvedValue(undefined);
  vi.mocked(logProspectMessage).mockResolvedValue(undefined);
  vi.mocked(alertFounders).mockResolvedValue(undefined);
});

describe('runDispatch — template pre-flight', () => {
  it('aborts with zero sends when the intro template is not APPROVED', async () => {
    vi.mocked(getTemplateStatus).mockResolvedValue({ name: 'x', status: 'PAUSED' });
    vi.mocked(loadReadyProspects).mockResolvedValue([prospect()]);
    const rep = await runDispatch({ force: true });
    expect(rep.aborted).toBe(true);
    expect(rep.error).toMatch(/template_not_approved/);
    expect(sendProspectTemplate).not.toHaveBeenCalled();
    expect(alertFounders).toHaveBeenCalled();
  });

  it('fails closed when the template status cannot be checked', async () => {
    vi.mocked(getTemplateStatus).mockRejectedValue(new Error('graph down'));
    vi.mocked(loadReadyProspects).mockResolvedValue([prospect()]);
    const rep = await runDispatch({ force: true });
    expect(rep.aborted).toBe(true);
    expect(rep.error).toMatch(/template_check_failed/);
    expect(sendProspectTemplate).not.toHaveBeenCalled();
  });

  it('dryRun plans without claiming, sending, or touching the Graph API', async () => {
    vi.mocked(loadReadyProspects).mockResolvedValue([prospect()]);
    const rep = await runDispatch({ dryRun: true });
    expect(rep.planned).toBe(1);
    expect(rep.recipients[0].result).toBe('planned');
    expect(getTemplateStatus).not.toHaveBeenCalled();
    expect(claimProspectForSend).not.toHaveBeenCalled();
    expect(sendProspectTemplate).not.toHaveBeenCalled();
  });
});

describe('runDispatch — atomic claim (double-send race)', () => {
  it('skips a row another concurrent run already claimed', async () => {
    const p1 = prospect({ id: 'p1', phone: '+5535999990001' });
    const p2 = prospect({ id: 'p2', phone: '+5535999990002' });
    vi.mocked(loadReadyProspects).mockResolvedValue([p1, p2]);
    vi.mocked(claimProspectForSend).mockImplementation(async (id) => id !== 'p1');

    const rep = await runDispatch({ force: true });

    expect(sendProspectTemplate).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendProspectTemplate).mock.calls[0][0]).toBe('+5535999990002');
    expect(rep.sent).toBe(1);
    expect(rep.recipients).toContainEqual(
      expect.objectContaining({ id: 'p1', result: 'skipped' })
    );
    expect(recordSendFailed).not.toHaveBeenCalled(); // a lost claim is not a failure
  });

  it('claims BEFORE sending (order matters — the claim is the lock)', async () => {
    vi.mocked(loadReadyProspects).mockResolvedValue([prospect()]);
    await runDispatch({ force: true });
    const claimOrder = vi.mocked(claimProspectForSend).mock.invocationCallOrder[0];
    const sendOrder = vi.mocked(sendProspectTemplate).mock.invocationCallOrder[0];
    expect(claimOrder).toBeLessThan(sendOrder);
    expect(recordSend).toHaveBeenCalledWith('p1', { wamid: 'wamid-1', template: expect.any(String) });
  });

  it('records failed (never unclaims) when the send throws after a claim', async () => {
    vi.mocked(loadReadyProspects).mockResolvedValue([prospect()]);
    vi.mocked(sendProspectTemplate).mockRejectedValue(new Error('cloud api 500'));
    const rep = await runDispatch({ force: true });
    expect(rep.failed).toBe(1);
    expect(recordSendFailed).toHaveBeenCalledWith('p1');
    expect(recordSend).not.toHaveBeenCalled();
  });

  it('still aborts fail-closed when opt-outs are unverifiable', async () => {
    vi.mocked(loadOptouts).mockRejectedValue(new Error('db down'));
    const rep = await runDispatch({ force: true });
    expect(rep.aborted).toBe(true);
    expect(sendProspectTemplate).not.toHaveBeenCalled();
  });

  it('stops before claiming when the cap was consumed mid-run by a concurrent run', async () => {
    vi.mocked(loadReadyProspects).mockResolvedValue([prospect()]);
    // Precondition count says 0; the in-loop recheck sees the other run's
    // claims (claims stamp sent_at, so counts include them).
    vi.mocked(countSentSince).mockResolvedValueOnce(0).mockResolvedValue(20);
    const rep = await runDispatch({ force: true });
    expect(claimProspectForSend).not.toHaveBeenCalled();
    expect(sendProspectTemplate).not.toHaveBeenCalled();
    expect(rep.sent).toBe(0);
  });
});

describe('runDispatch — graded cap ramp', () => {
  it('pauses (aborts + alerts) when the number health is severe', async () => {
    vi.mocked(loadSendHealth).mockResolvedValue({
      health: { windowSends: 40, delivered: 16, failed: 2, deliveredRate: 0.4, failRate: 0.05, optoutRate: 0.02 },
      lifetimeSends: 400,
    });
    vi.mocked(loadReadyProspects).mockResolvedValue([prospect()]);
    const rep = await runDispatch({ force: true });
    expect(rep.aborted).toBe(true);
    expect(rep.error).toMatch(/number_health_paused/);
    expect(rep.cap).toBe(0);
    expect(sendProspectTemplate).not.toHaveBeenCalled();
    expect(alertFounders).toHaveBeenCalledWith(expect.stringContaining('PAUSADA'));
  });

  it('a paused dry run reports the state without paging the founders', async () => {
    vi.mocked(loadSendHealth).mockResolvedValue({
      health: { windowSends: 40, delivered: 16, failed: 2, deliveredRate: 0.4, failRate: 0.05, optoutRate: 0.02 },
      lifetimeSends: 400,
    });
    const rep = await runDispatch({ dryRun: true });
    expect(rep.aborted).toBe(true);
    expect(alertFounders).not.toHaveBeenCalled();
  });

  it('a degraded number trickles: graded cap 10 bounds the batch', async () => {
    vi.mocked(loadSendHealth).mockResolvedValue({
      health: { windowSends: 40, delivered: 30, failed: 0, deliveredRate: 0.75, failRate: 0, optoutRate: 0.02 },
      lifetimeSends: 400,
    });
    vi.mocked(countSentSince).mockResolvedValue(9); // 9 of the 10 already used today
    vi.mocked(loadReadyProspects).mockResolvedValue([
      prospect({ id: 'p1', phone: '+5535999990001' }),
      prospect({ id: 'p2', phone: '+5535999990002' }),
    ]);
    const rep = await runDispatch({ force: true });
    expect(rep.capGrade).toBe('degraded');
    expect(rep.cap).toBe(10);
    expect(rep.planned).toBe(1); // only the remaining slot
    expect(sendProspectTemplate).toHaveBeenCalledTimes(1);
  });

  it('a manual cap wins and skips the health read entirely', async () => {
    vi.mocked(loadReadyProspects).mockResolvedValue([prospect()]);
    const rep = await runDispatch({ force: true, dailyCap: 5 });
    expect(loadSendHealth).not.toHaveBeenCalled();
    expect(rep.capGrade).toBe('manual');
    expect(rep.cap).toBe(5);
  });

  it('the manual emergency stop (cap 0) pauses without paging the founder who pulled it', async () => {
    vi.mocked(loadReadyProspects).mockResolvedValue([prospect()]);
    const rep = await runDispatch({ force: true, dailyCap: 0 });
    expect(rep.aborted).toBe(true);
    expect(rep.error).toMatch(/paused_by_override/);
    expect(sendProspectTemplate).not.toHaveBeenCalled();
    expect(alertFounders).not.toHaveBeenCalled();
  });

  it('healthy volume climbs the ladder (lifetime 400 → cap 60)', async () => {
    vi.mocked(loadSendHealth).mockResolvedValue({ ...WARM_HEALTH, lifetimeSends: 400 });
    vi.mocked(loadReadyProspects).mockResolvedValue([prospect()]);
    const rep = await runDispatch({ force: true });
    expect(rep.cap).toBe(60);
    expect(rep.capGrade).toBe('healthy');
  });

  it('a real pause records an episode; the manual stop does not', async () => {
    vi.mocked(loadSendHealth).mockResolvedValue({
      health: { windowSends: 40, delivered: 16, failed: 2, deliveredRate: 0.4, failRate: 0.05, optoutRate: 0.02 },
      lifetimeSends: 400,
    });
    await runDispatch({ force: true });
    expect(recordDispatchPause).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    vi.mocked(isDispatchLatched).mockResolvedValue(false);
    await runDispatch({ force: true, dailyCap: 0 });
    expect(recordDispatchPause).not.toHaveBeenCalled();
  });

  it('the latch outranks everything — even a manual cap cannot send through it', async () => {
    vi.mocked(isDispatchLatched).mockResolvedValue(true);
    vi.mocked(loadReadyProspects).mockResolvedValue([prospect()]);
    const rep = await runDispatch({ force: true, dailyCap: 20 });
    expect(rep.aborted).toBe(true);
    expect(rep.error).toMatch(/paused_latched/);
    expect(rep.capGrade).toBe('latched');
    expect(sendProspectTemplate).not.toHaveBeenCalled();
    expect(alertFounders).toHaveBeenCalledWith(expect.stringContaining('TRAVADA'));
  });
});

describe('runDispatch — campaign kind gating', () => {
  it('coops/revendas never receive the lead-gen template under the default gate', async () => {
    vi.mocked(loadReadyProspects).mockResolvedValue([
      prospect({ id: 'p1', kind: 'agronomo', phone: '+5535999990001' }),
      prospect({ id: 'p2', kind: 'cooperativa', phone: '+5535999990002' }),
      prospect({ id: 'p3', kind: 'revenda', phone: '+5535999990003' }),
      prospect({ id: 'p4', kind: 'consultoria', phone: '+5535999990004' }),
    ]);
    const rep = await runDispatch({ force: true });
    expect(rep.eligible).toBe(2); // agronomo + consultoria only
    const sentTo = vi.mocked(sendProspectTemplate).mock.calls.map((c) => c[0]);
    expect(sentTo).toEqual(['+5535999990001', '+5535999990004']);
  });

  it("PROSPECT_SEND_KINDS='all' opens the gate", async () => {
    process.env.PROSPECT_SEND_KINDS = 'all';
    vi.mocked(loadReadyProspects).mockResolvedValue([
      prospect({ id: 'p2', kind: 'cooperativa', phone: '+5535999990002' }),
    ]);
    const rep = await runDispatch({ force: true });
    expect(rep.sent).toBe(1);
  });
});

describe('runBumpDispatch — atomic claim', () => {
  const due = () =>
    prospect({ status: 'contacted', send_status: 'sent', touches: 1, sent_at: '2026-07-10T12:00:00Z' });

  it('skips a bump another concurrent run already claimed', async () => {
    vi.mocked(loadBumpDueProspects).mockResolvedValue([due()]);
    vi.mocked(claimProspectForBump).mockResolvedValue(false);
    const rep = await runBumpDispatch();
    expect(sendProspectTemplate).not.toHaveBeenCalled();
    expect(rep.sent).toBe(0);
  });

  it('claims, sends, and records the bump', async () => {
    vi.mocked(loadBumpDueProspects).mockResolvedValue([due()]);
    const rep = await runBumpDispatch();
    expect(claimProspectForBump).toHaveBeenCalledWith('p1');
    expect(sendProspectTemplate).toHaveBeenCalledTimes(1);
    expect(recordBump).toHaveBeenCalledWith('p1', { wamid: 'wamid-1', template: expect.any(String) });
    expect(rep.sent).toBe(1);
  });

  it('bumps share the health pause (quiet skip — the intro run already paged)', async () => {
    vi.mocked(loadSendHealth).mockResolvedValue({
      health: { windowSends: 40, delivered: 16, failed: 2, deliveredRate: 0.4, failRate: 0.05, optoutRate: 0.02 },
      lifetimeSends: 400,
    });
    vi.mocked(loadBumpDueProspects).mockResolvedValue([due()]);
    const rep = await runBumpDispatch();
    expect(rep.skipped).toMatch(/number_health_paused/);
    expect(sendProspectTemplate).not.toHaveBeenCalled();
    expect(alertFounders).not.toHaveBeenCalled();
  });
});
