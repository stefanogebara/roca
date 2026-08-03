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
import { alertFounders } from './_lib/alert';
import { createLogger } from './_lib/logger';
import { fireAndForget } from './_lib/fireAndForget';

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
        // O MESMO callback confirma (ou desmente) a entrega dos alertas pros
        // founders. Sem isto, "aceito pela Meta" era tudo que sabiamos — e foi
        // assim que o canal ficou mudo por semanas em 03/ago.
        //
        // try/catch PROPRIO: isto e contabilidade de alerta, um satelite. O
        // teste do webhook pegou o erro na hora — sem o catch, uma falha aqui
        // impedia handleInbound de rodar e o produtor ficava sem resposta por
        // causa do nosso livro-caixa. Mesma familia do apagao do geotiff:
        // periferico nunca derruba o essencial.
        try {
          const { aplicarStatusEmAlertas } = await import('./_lib/alertDelivery');
          await aplicarStatusEmAlertas(statuses);
        } catch (e) {
          log.error('registro de entrega de alerta falhou:', (e as Error).message);
        }
      }
    }

    if (!msg) {
      ack();
      return;
    }
    // Perceived speed: flag "read + typing" before the heavy work starts.
    // markRead é cosmético e o adapter da Cloud já engole os próprios erros —
    // mas a interface (transport/types.ts) não obriga ninguém a isso, e um
    // adapter futuro que lançasse derrubaria a instância junto com requisições
    // de outros produtores. O contrato passa a ser garantido aqui, não confiado.
    // O bind não é enfeite: markRead é método de protótipo e lê
    // this.inboundPhoneId ANTES do próprio try/catch. Solto da instância, `this`
    // é undefined e ele morre de TypeError — que o fireAndForget engole. Ficaria
    // "sem erro" e sem read receipt nenhum, que é o oposto do que ele existe pra
    // fazer. (Marcar como lido por outro número da WABA a Meta rejeita.)
    const markRead = adapter.markRead?.bind(adapter);
    if (markRead) fireAndForget(() => markRead(msg.messageId), 'markRead');
    await handleInbound(adapter, msg);
    ack();
  } catch (e) {
    log.error('webhook error:', (e as Error).message);
    // A swallowed crash here means a farmer sent a message and got NOTHING —
    // ack-200 + a log nobody reads. Page the founders (fail-soft: alerting
    // trouble must never break the ack that keeps provider retries at bay).
    try {
      await alertFounders(`⚠️ Stevi: erro no webhook — ${(e as Error).message.slice(0, 180)}`);
    } catch (alertErr) {
      log.error('alertFounders failed too:', (alertErr as Error).message);
    }
    ack();
  }
}
