/**
 * handleProspectInbound — the hot-lead moment. A prospect's FIRST reply is the
 * most valuable event the outbound funnel produces: the founders must hear
 * about it immediately (email to both + WhatsApp ping) so they can take over
 * the conversation directly (the Racha/Olimpi pattern). Repeat replies and
 * opt-outs must NOT re-fire the notification.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api/_lib/prospect/db', () => ({
  findProspectByPhone: vi.fn(),
  addOptout: vi.fn(),
  markProspectReplied: vi.fn(),
  logProspectMessage: vi.fn(),
  getProspectThread: vi.fn(),
  mergeProspectQualification: vi.fn(),
}));
vi.mock('../api/_lib/prospect/agent', () => ({
  AGENT_NAME: 'Vitória',
  needsEscalation: vi.fn(() => false),
  buildAgentReply: vi.fn(),
  extractQualification: vi.fn(),
}));
vi.mock('../api/_lib/alert', () => ({ alertFounders: vi.fn() }));
vi.mock('../api/_lib/notify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/_lib/notify')>();
  return { ...actual, sendProspectReplyNotification: vi.fn() };
});

import { handleProspectInbound } from '../api/_lib/prospect/inbound';
import { findProspectByPhone, addOptout, markProspectReplied } from '../api/_lib/prospect/db';
import { sendProspectReplyNotification } from '../api/_lib/notify';
import { alertFounders } from '../api/_lib/alert';

const PROSPECT = {
  id: 'p1',
  name: 'Cooperativa Serrana',
  kind: 'cooperativa',
  city: 'Patrocínio',
  uf: 'MG',
  phone: '+5534999887766',
  status: 'contacted',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleProspectInbound — hot-lead notification', () => {
  it('first reply notifies the founders (email + WhatsApp) and marks replied', async () => {
    vi.mocked(findProspectByPhone).mockResolvedValue({ ...PROSPECT } as never);

    const res = await handleProspectInbound('+5534999887766', 'como funciona a parceria?');

    expect(res.handled).toBe(false);
    expect(res.prospect?.id).toBe('p1');
    expect(markProspectReplied).toHaveBeenCalledWith('p1');
    expect(sendProspectReplyNotification).toHaveBeenCalledTimes(1);
    const notice = vi.mocked(sendProspectReplyNotification).mock.calls[0][0];
    expect(notice.name).toBe('Cooperativa Serrana');
    expect(notice.maskedPhone).not.toMatch(/\d{5,}/);
    expect(notice.maskedPhone).toContain('7766');
    expect(alertFounders).toHaveBeenCalledTimes(1);
  });

  it('a repeat reply (already replied) does NOT re-notify', async () => {
    vi.mocked(findProspectByPhone).mockResolvedValue({ ...PROSPECT, status: 'replied' } as never);

    const res = await handleProspectInbound('+5534999887766', 'e o preço?');

    expect(res.handled).toBe(false);
    expect(sendProspectReplyNotification).not.toHaveBeenCalled();
  });

  it('an opt-out is honoured and is NOT a hot lead', async () => {
    vi.mocked(findProspectByPhone).mockResolvedValue({ ...PROSPECT } as never);

    const res = await handleProspectInbound('+5534999887766', 'SAIR');

    expect(res.handled).toBe(true);
    expect(addOptout).toHaveBeenCalled();
    expect(sendProspectReplyNotification).not.toHaveBeenCalled();
  });

  it('a notification failure never blocks the reply flow', async () => {
    vi.mocked(findProspectByPhone).mockResolvedValue({ ...PROSPECT } as never);
    vi.mocked(sendProspectReplyNotification).mockRejectedValue(new Error('smtp down'));

    const res = await handleProspectInbound('+5534999887766', 'oi, me conta mais');

    expect(res.handled).toBe(false);
    expect(res.prospect?.id).toBe('p1');
  });
});
