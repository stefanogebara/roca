/**
 * Stevi WhatsApp webhook — provider-agnostic.
 *
 * Body parsing is disabled so we can read the exact bytes: Meta's Cloud API
 * signs the raw body (HMAC-SHA256) and Twilio's signature is order-independent
 * over form params. We read the raw body once, pick the adapter by request
 * shape, verify, run the pipeline, and ack in the provider's expected format.
 *
 * Supporting both providers at one URL means flipping from the Twilio sandbox to
 * Meta Cloud API needs no code change — just point Meta's webhook here.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TwilioAdapter } from './_lib/transport/twilio';
import { CloudApiAdapter, verifyCloudChallenge, parseCloudStatuses } from './_lib/transport/cloud';
import { handleInbound } from './_lib/pipeline';
import type { TransportAdapter, TransportRequest } from './_lib/transport/types';
import { createLogger } from './_lib/logger';

// Disable Vercel's automatic body parsing so we can read raw bytes for HMAC.
export const config = { api: { bodyParser: false } };

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
const log = createLogger('webhook');

const twilio = new TwilioAdapter();
const cloud = new CloudApiAdapter();

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

/** Pick the adapter by request shape: Twilio sends x-twilio-signature; Meta
 * sends x-hub-signature-256 / JSON. Default to Twilio (the active sandbox). */
function selectAdapter(req: VercelRequest): TransportAdapter {
  const h = req.headers;
  if (h['x-hub-signature-256'] || String(h['content-type'] ?? '').includes('application/json')) {
    return cloud;
  }
  return twilio;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // GET: Meta subscription challenge, or a health check.
  if (req.method === 'GET') {
    if (req.query && 'hub.mode' in req.query) {
      const challenge = verifyCloudChallenge(req.query as Record<string, unknown>);
      if (challenge !== null) {
        res.status(200).send(challenge);
        return;
      }
      res.status(403).json({ error: 'verification failed' });
      return;
    }
    res.status(200).json({ status: 'ok', service: 'stevi-webhook' });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const adapter = selectAdapter(req);

  // Ack in the provider's expected format. Twilio wants TwiML; Cloud wants 200.
  const ack = () => {
    if (adapter.provider === 'twilio') {
      res.setHeader('Content-Type', 'text/xml');
      res.status(200).send(EMPTY_TWIML);
    } else {
      res.status(200).json({ received: true });
    }
  };

  try {
    const rawBody = await readRawBody(req);
    const treq: TransportRequest = {
      method: req.method,
      headers: req.headers,
      url: req.url,
      rawBody,
    };

    if (!(await adapter.verifySignature(treq))) {
      res.status(403).json({ error: 'Invalid signature' });
      return;
    }

    const msg = await adapter.parseInbound(treq);

    // Cloud status callbacks (sent/delivered/read/failed) feed the prospect
    // send-status machine and the number-health thermometer that grades the
    // dispatch cap. Meta batches: one POST can carry messages AND statuses —
    // harvest them on every verified cloud post, not only message-less ones.
    if (adapter.provider === 'cloud') {
      const statuses = parseCloudStatuses(rawBody);
      if (statuses.length) {
        const { applyProspectStatuses } = await import('./_lib/prospect/health');
        await applyProspectStatuses(statuses);
      }
    }

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
