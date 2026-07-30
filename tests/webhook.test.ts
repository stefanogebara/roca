/**
 * webhook.ts — the sole production entrypoint (audit 2026-07-16, testing §6:
 * zero coverage before this). These pin the handler *wiring*, not the adapters
 * (their signature/parse logic is covered by cloud.test / twilio-signature):
 *   - GET: Meta subscription challenge (pass/fail) and the plain health check.
 *   - method guard (405).
 *   - adapter selection by request shape (twilio default / cloud via hub-sig /
 *     cloud via JSON content-type) → observed through the ack format.
 *   - signature rejection (403, pipeline never runs).
 *   - status-only posts ack without invoking the pipeline; cloud statuses are
 *     harvested into the health machine; a post can carry a message AND statuses.
 *   - the load-bearing invariant the audit called out: the handler ALWAYS acks,
 *     even when verify/parse/pipeline throws — so a provider never sees a 5xx and
 *     retry-storms the webhook.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fns must exist before the hoisted vi.mock factories run.
const m = vi.hoisted(() => ({
  twilioVerify: vi.fn(),
  twilioParse: vi.fn(),
  cloudVerify: vi.fn(),
  cloudParse: vi.fn(),
  verifyCloudChallenge: vi.fn(),
  parseCloudStatuses: vi.fn(),
  handleInbound: vi.fn(),
  applyProspectStatuses: vi.fn(),
  alertFounders: vi.fn(),
  cloudMarkRead: vi.fn(),
}));

vi.mock('../api/_lib/alert', () => ({ alertFounders: m.alertFounders }));

vi.mock('../api/_lib/transport/twilio', () => ({
  TwilioAdapter: class {
    provider = 'twilio' as const;
    verifySignature = m.twilioVerify;
    parseInbound = m.twilioParse;
  },
}));
vi.mock('../api/_lib/transport/cloud', () => ({
  CloudApiAdapter: class {
    provider = 'cloud' as const;
    /** O markRead real lê este campo do `this` — é o que prova o receptor. */
    inboundPhoneId = 'phone-do-inbound';
    verifySignature = m.cloudVerify;
    parseInbound = m.cloudParse;
    // Método (não arrow) de propósito: só funciona se o chamador preservar `this`.
    markRead(messageId: string) {
      return m.cloudMarkRead(messageId, this.inboundPhoneId);
    }
  },
  verifyCloudChallenge: m.verifyCloudChallenge,
  parseCloudStatuses: m.parseCloudStatuses,
}));
vi.mock('../api/_lib/pipeline', () => ({ handleInbound: m.handleInbound }));
vi.mock('../api/_lib/prospect/health', () => ({ applyProspectStatuses: m.applyProspectStatuses }));

import handler from '../api/webhook';

/** Minimal async-iterable req (readRawBody consumes it via `for await`). */
function makeReq(opts: {
  method?: string;
  headers?: Record<string, string>;
  url?: string;
  query?: Record<string, unknown>;
  body?: string;
}): any {
  const req: any = {
    method: opts.method ?? 'POST',
    headers: opts.headers ?? {},
    url: opts.url ?? '/api/webhook',
    query: opts.query ?? {},
  };
  req[Symbol.asyncIterator] = async function* () {
    yield Buffer.from(opts.body ?? '');
  };
  return req;
}

function makeRes() {
  const out = { code: 0, sent: undefined as unknown, json: undefined as unknown, headers: {} as Record<string, string> };
  const res: any = {
    out,
    setHeader(k: string, v: string) {
      out.headers[k] = v;
    },
    status(code: number) {
      out.code = code;
      return {
        send: (b: unknown) => {
          out.sent = b;
        },
        json: (j: unknown) => {
          out.json = j;
        },
      };
    },
  };
  return res;
}

const TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

beforeEach(() => {
  vi.clearAllMocks();
  // Happy-path defaults; individual tests override.
  m.twilioVerify.mockResolvedValue(true);
  m.cloudVerify.mockResolvedValue(true);
  m.twilioParse.mockResolvedValue({ from: '+5535999990000', kind: 'text', text: 'oi' });
  m.cloudParse.mockResolvedValue({ from: '+5535999990000', kind: 'text', text: 'oi' });
  m.parseCloudStatuses.mockReturnValue([]);
  m.verifyCloudChallenge.mockReturnValue('CHALLENGE-123');
  m.handleInbound.mockResolvedValue(undefined);
  m.applyProspectStatuses.mockResolvedValue(undefined);
  m.cloudMarkRead.mockResolvedValue(undefined);
});

describe('markRead — cosmético, disparado sem esperar', () => {
  const postCloud = () =>
    handler(makeReq({ headers: { 'x-hub-signature-256': 'sha256=abc' }, body: '{}' }), makeRes());

  it('roda com o adapter como receptor (senão perderia o phone id do inbound)', async () => {
    m.cloudParse.mockResolvedValue({ from: '+5535999990000', kind: 'text', text: 'oi', messageId: 'wamid-1' });

    await postCloud();

    // Marcar como lido por OUTRO número da mesma WABA é rejeitado pela Meta:
    // se o `this` se perder no caminho, isso volta undefined e quebra em prod
    // de um jeito que nenhum teste veria (o markRead engole o próprio erro).
    expect(m.cloudMarkRead).toHaveBeenCalledWith('wamid-1', 'phone-do-inbound');
  });

  it('um markRead que rejeita não vira unhandled rejection nem tira o ack', async () => {
    m.cloudParse.mockResolvedValue({ from: '+5535999990000', kind: 'text', text: 'oi', messageId: 'wamid-2' });
    m.cloudMarkRead.mockRejectedValue(new Error('meta caiu'));
    const soltas: unknown[] = [];
    const capturar = (e: unknown) => soltas.push(e);
    process.on('unhandledRejection', capturar);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const res = makeRes();
    try {
      await handler(makeReq({ headers: { 'x-hub-signature-256': 'sha256=abc' }, body: '{}' }), res);
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));
    } finally {
      process.off('unhandledRejection', capturar);
      stderr.mockRestore();
    }

    expect(soltas).toEqual([]);
    expect(res.out.json).toEqual({ received: true }); // o produtor recebeu resposta
    expect(m.handleInbound).toHaveBeenCalledTimes(1); // e o trabalho de verdade rodou
  });
});

describe('GET', () => {
  it('returns the Meta challenge when verification passes', async () => {
    const res = makeRes();
    await handler(makeReq({ method: 'GET', query: { 'hub.mode': 'subscribe', 'hub.verify_token': 't' } }), res);
    expect(res.out.code).toBe(200);
    expect(res.out.sent).toBe('CHALLENGE-123');
    expect(m.handleInbound).not.toHaveBeenCalled();
  });

  it('403s when the challenge token is wrong', async () => {
    m.verifyCloudChallenge.mockReturnValue(null);
    const res = makeRes();
    await handler(makeReq({ method: 'GET', query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'bad' } }), res);
    expect(res.out.code).toBe(403);
    expect(res.out.json).toEqual({ error: 'verification failed' });
  });

  it('answers a plain health check when there is no hub.mode', async () => {
    const res = makeRes();
    await handler(makeReq({ method: 'GET', query: {} }), res);
    expect(res.out.code).toBe(200);
    expect(res.out.json).toEqual({ status: 'ok', service: 'stevi-webhook' });
    expect(m.verifyCloudChallenge).not.toHaveBeenCalled();
  });
});

describe('method guard', () => {
  it('405s a non-GET/POST method', async () => {
    const res = makeRes();
    await handler(makeReq({ method: 'PUT' }), res);
    expect(res.out.code).toBe(405);
    expect(res.out.json).toEqual({ error: 'Method not allowed' });
  });
});

describe('adapter selection (via ack format + which verifier ran)', () => {
  it('defaults to Twilio and acks TwiML', async () => {
    const res = makeRes();
    await handler(makeReq({ headers: { 'x-twilio-signature': 'sig' }, body: 'Body=oi' }), res);
    expect(m.twilioVerify).toHaveBeenCalledTimes(1);
    expect(m.cloudVerify).not.toHaveBeenCalled();
    expect(res.out.headers['Content-Type']).toBe('text/xml');
    expect(res.out.sent).toBe(TWIML);
    expect(m.handleInbound).toHaveBeenCalledTimes(1);
  });

  it('routes to Cloud on x-hub-signature-256 and acks JSON', async () => {
    const res = makeRes();
    await handler(makeReq({ headers: { 'x-hub-signature-256': 'sha256=abc' }, body: '{}' }), res);
    expect(m.cloudVerify).toHaveBeenCalledTimes(1);
    expect(m.twilioVerify).not.toHaveBeenCalled();
    expect(res.out.json).toEqual({ received: true });
  });

  it('routes to Cloud on a JSON content-type', async () => {
    const res = makeRes();
    await handler(makeReq({ headers: { 'content-type': 'application/json' }, body: '{}' }), res);
    expect(m.cloudVerify).toHaveBeenCalledTimes(1);
    expect(m.twilioVerify).not.toHaveBeenCalled();
  });
});

describe('POST processing', () => {
  it('rejects a bad signature with 403 and never runs the pipeline', async () => {
    m.twilioVerify.mockResolvedValue(false);
    const res = makeRes();
    await handler(makeReq({ headers: { 'x-twilio-signature': 'sig' } }), res);
    expect(res.out.code).toBe(403);
    expect(res.out.json).toEqual({ error: 'Invalid signature' });
    expect(m.handleInbound).not.toHaveBeenCalled();
  });

  it('acks without running the pipeline when there is no message', async () => {
    m.twilioParse.mockResolvedValue(null);
    const res = makeRes();
    await handler(makeReq({ headers: { 'x-twilio-signature': 'sig' } }), res);
    expect(m.handleInbound).not.toHaveBeenCalled();
    expect(res.out.sent).toBe(TWIML);
  });

  it('harvests cloud statuses into the health machine (status-only post)', async () => {
    m.cloudParse.mockResolvedValue(null);
    m.parseCloudStatuses.mockReturnValue([{ id: 'wamid', status: 'delivered' }]);
    const res = makeRes();
    await handler(makeReq({ headers: { 'x-hub-signature-256': 'sha256=abc' }, body: '{}' }), res);
    expect(m.applyProspectStatuses).toHaveBeenCalledWith([{ id: 'wamid', status: 'delivered' }]);
    expect(m.handleInbound).not.toHaveBeenCalled();
    expect(res.out.json).toEqual({ received: true });
  });

  it('handles a cloud post carrying BOTH a message and statuses', async () => {
    m.parseCloudStatuses.mockReturnValue([{ id: 'wamid', status: 'read' }]);
    const res = makeRes();
    await handler(makeReq({ headers: { 'x-hub-signature-256': 'sha256=abc' }, body: '{}' }), res);
    expect(m.applyProspectStatuses).toHaveBeenCalledTimes(1);
    expect(m.handleInbound).toHaveBeenCalledTimes(1);
    expect(res.out.json).toEqual({ received: true });
  });

  it('never harvests statuses on the Twilio path', async () => {
    const res = makeRes();
    await handler(makeReq({ headers: { 'x-twilio-signature': 'sig' } }), res);
    expect(m.parseCloudStatuses).not.toHaveBeenCalled();
    expect(m.applyProspectStatuses).not.toHaveBeenCalled();
  });
});

describe('always-ack-on-error (retry-storm guard)', () => {
  it('still acks (provider format) when the pipeline throws — and alerts the founders', async () => {
    m.handleInbound.mockRejectedValue(new Error('boom'));
    const res = makeRes();
    await handler(makeReq({ headers: { 'x-twilio-signature': 'sig' } }), res);
    // No 5xx bubbles out; Twilio still gets its TwiML 200.
    expect(res.out.headers['Content-Type']).toBe('text/xml');
    expect(res.out.sent).toBe(TWIML);
    // A swallowed pipeline crash used to be ack-200 + a log nobody reads; the
    // farmer got no reply and no one knew. Now it pages.
    expect(m.alertFounders).toHaveBeenCalledTimes(1);
    expect(String(m.alertFounders.mock.calls[0][0])).toContain('boom');
  });

  it('an alertFounders failure never breaks the ack', async () => {
    m.handleInbound.mockRejectedValue(new Error('boom'));
    m.alertFounders.mockRejectedValue(new Error('whatsapp down too'));
    const res = makeRes();
    await handler(makeReq({ headers: { 'x-twilio-signature': 'sig' } }), res);
    expect(res.out.sent).toBe(TWIML);
  });

  it('still acks when signature verification throws', async () => {
    m.cloudVerify.mockRejectedValue(new Error('verify exploded'));
    const res = makeRes();
    await handler(makeReq({ headers: { 'x-hub-signature-256': 'sha256=abc' }, body: '{}' }), res);
    expect(res.out.json).toEqual({ received: true });
    expect(m.handleInbound).not.toHaveBeenCalled();
  });
});
