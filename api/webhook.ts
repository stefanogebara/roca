/**
 * Roça WhatsApp webhook (Stage 0 — Twilio sandbox).
 *
 * Thin handler: verify signature → parse → run pipeline → ack. Reply is sent
 * asynchronously via the transport's REST API, so we return empty TwiML.
 * Swapping to Meta Cloud API later means adding a CloudApiAdapter and selecting
 * it here — the pipeline is transport-agnostic.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TwilioAdapter } from './_lib/transport/twilio';
import { handleInbound } from './_lib/pipeline';
import type { TransportRequest } from './_lib/transport/types';
import { createLogger } from './_lib/logger';

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
const adapter = new TwilioAdapter();
const log = createLogger('webhook');

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method === 'GET') {
    res.status(200).json({ status: 'ok', service: 'roca-webhook' });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const treq: TransportRequest = {
    method: req.method,
    headers: req.headers,
    url: req.url,
    body: req.body,
  };

  if (!(await adapter.verifySignature(treq))) {
    res.status(403).json({ error: 'Invalid signature' });
    return;
  }

  // Always ack Twilio with empty TwiML; the answer is sent out-of-band.
  const ack = () => {
    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send(EMPTY_TWIML);
  };

  try {
    const msg = await adapter.parseInbound(treq);
    if (!msg) {
      ack();
      return;
    }
    await handleInbound(adapter, msg);
    ack();
  } catch (e) {
    log.error('webhook error:', (e as Error).message);
    ack();
  }
}
