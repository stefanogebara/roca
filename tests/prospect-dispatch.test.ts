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

import { runDispatch, runBumpDispatch } from '../api/_lib/prospect/dispatch';
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
  kind: 'revenda',
  city: 'Varginha',
  uf: 'MG',
  phone: '+5535999990000',
  wa_status: 'valid',
  source: 'manual',
  status: 'ready',
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

beforeEach(() => {
  vi.clearAllMocks();
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
});
