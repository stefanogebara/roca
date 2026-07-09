/**
 * Twilio WhatsApp Sandbox adapter (Stage 0 transport).
 *
 * We talk to Twilio over plain HTTPS + node:crypto rather than the `twilio` SDK:
 * the SDK ships ~1000 per-resource .d.ts files that dominated typecheck time,
 * and we use exactly two things — request-signature validation and sending a
 * message. Both are a few lines here.
 *
 * Twilio posts URL-encoded form bodies; we reply asynchronously via the REST API
 * (empty TwiML ack in the webhook) to keep the pipeline uniform with Cloud API.
 */

import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
import type {
  TransportAdapter,
  TransportRequest,
  InboundMessage,
  OutboundMessage,
  InboundKind,
} from './types';
import { getTwilioContentSid, setTwilioContentSid } from '../db';
import { createLogger } from '../logger';

const log = createLogger('twilio');

const TWILIO_API = 'https://api.twilio.com/2010-04-01';
const CONTENT_API = 'https://content.twilio.com/v1/Content';

/**
 * Quick-reply buttons ride on a Twilio Content template (in-session templates
 * need no approval inside the 24h window). The body travels as variable {{1}},
 * so one template per distinct BUTTON-SET serves every message — created once,
 * SID cached in the DB. WhatsApp interactive bodies cap at 1024 chars; above
 * this we quietly send plain text instead.
 */
const INTERACTIVE_BODY_MAX = 950;

function buttonsHash(buttons: string[]): string {
  return createHash('sha256').update(JSON.stringify(buttons)).digest('hex').slice(0, 32);
}

function formToObject(rawBody: Buffer): Record<string, string> {
  const params = new URLSearchParams(rawBody.toString('utf8'));
  const out: Record<string, string> = {};
  for (const [k, v] of params) out[k] = v;
  return out;
}

function classifyMedia(mime: string | null): InboundKind {
  if (!mime) return 'unsupported';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'voice';
  return 'unsupported';
}

/**
 * Twilio's request signature: HMAC-SHA1 over (URL + each POST param key
 * immediately followed by its value, sorted by key), base64-encoded, keyed by
 * the auth token. Validated against the X-Twilio-Signature header.
 */
export function computeTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>
): string {
  const sorted = Object.keys(params).sort();
  const payload = url + sorted.map((k) => k + params[k]).join('');
  return createHmac('sha1', authToken).update(payload, 'utf8').digest('base64');
}

export class TwilioAdapter implements TransportAdapter {
  readonly provider = 'twilio';
  readonly isSync = false;

  async verifySignature(req: TransportRequest): Promise<boolean> {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) return false;
    const signature = req.headers['x-twilio-signature'];
    if (typeof signature !== 'string') return false;

    const host = req.headers['host'];
    const url = `https://${host}${req.url ?? ''}`;
    const expected = computeTwilioSignature(authToken, url, formToObject(req.rawBody));

    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async parseInbound(req: TransportRequest): Promise<InboundMessage | null> {
    const b = formToObject(req.rawBody);
    const from = (b.From ?? '').replace('whatsapp:', '');
    if (!from) return null;

    const numMedia = parseInt(b.NumMedia ?? '0', 10) || 0;
    const lat = b.Latitude ? Number(b.Latitude) : null;
    const lon = b.Longitude ? Number(b.Longitude) : null;

    let kind: InboundKind = 'text';
    let mediaUrl: string | null = null;
    let mediaMime: string | null = null;
    let location: { lat: number; lon: number } | null = null;

    if (lat != null && lon != null && !Number.isNaN(lat) && !Number.isNaN(lon)) {
      kind = 'location';
      location = { lat, lon };
    } else if (numMedia > 0) {
      mediaUrl = b.MediaUrl0 ?? null;
      mediaMime = b.MediaContentType0 ?? null;
      kind = classifyMedia(mediaMime);
    }

    const text = (b.Body ?? '').trim() || null;
    if (kind === 'text' && !text) return null;

    return {
      from,
      messageId: b.MessageSid || `twilio-${from}-${b.Body ?? ''}`,
      kind,
      text,
      mediaUrl,
      mediaMime,
      location,
      profileName: b.ProfileName || null,
    };
  }

  async send(msg: OutboundMessage): Promise<void> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM;
    if (!sid || !token || !from) {
      throw new Error('Twilio credentials / TWILIO_WHATSAPP_FROM not configured');
    }
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');

    const params: Record<string, string> = {
      From: from,
      To: `whatsapp:${msg.to}`,
    };

    // Media path: send the image with the text as body. On any failure, retry
    // text-only so a broken card URL never drops the reply. Media + quick-reply
    // buttons can't coexist in one Twilio message, so media wins here.
    if (msg.mediaUrl) {
      params.Body = msg.text;
      params.MediaUrl = msg.mediaUrl;
      const res = await fetch(`${TWILIO_API}/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params).toString(),
      });
      if (res.ok) return;
      log.error(`media send failed ${res.status}, retrying text-only:`, (await res.text()).slice(0, 120));
      await this.send({ to: msg.to, text: msg.text, buttons: msg.buttons });
      return;
    }

    // Buttons path: resolve (or create) the content template for this button-set.
    // Any failure degrades to plain text — the farmer always gets the message.
    let interactive = false;
    if (msg.buttons?.length && msg.text.length <= INTERACTIVE_BODY_MAX) {
      try {
        const contentSid = await this.resolveContentSid(auth, msg.buttons.slice(0, 3));
        params.ContentSid = contentSid;
        params.ContentVariables = JSON.stringify({ '1': msg.text });
        interactive = true;
      } catch (e) {
        log.error('buttons degraded to plain text:', (e as Error).message);
      }
    }
    if (!interactive) params.Body = msg.text;

    const res = await fetch(`${TWILIO_API}/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });
    if (!res.ok) {
      const text = await res.text();
      // Interactive send rejected (e.g. outside the 24h session)? Plain-text twin.
      if (interactive) {
        log.error(`interactive send failed ${res.status}, retrying plain:`, text.slice(0, 120));
        await this.send({ to: msg.to, text: msg.text });
        return;
      }
      throw new Error(`Twilio send failed ${res.status}: ${text.slice(0, 200)}`);
    }
  }

  /** Content SID for a button-set: DB cache first, else create once and cache. */
  private async resolveContentSid(auth: string, buttons: string[]): Promise<string> {
    const hash = buttonsHash(buttons);
    const cached = await getTwilioContentSid(hash);
    if (cached) return cached;

    const res = await fetch(CONTENT_API, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        friendly_name: `stevi_qr_${hash.slice(0, 12)}`,
        language: 'pt_BR',
        variables: { '1': 'texto' },
        types: {
          'twilio/quick-reply': {
            body: '{{1}}',
            actions: buttons.map((title, i) => ({ title, id: `qr_${i}` })),
          },
          'twilio/text': { body: '{{1}}' },
        },
      }),
    });
    if (!res.ok) {
      throw new Error(`content create failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const created = (await res.json()) as { sid: string };
    await setTwilioContentSid(hash, created.sid, buttons);
    return created.sid;
  }

  /**
   * Fetch inbound media (image/voice). Twilio media URLs require basic-auth with
   * the account credentials. Returns base64 + mime for the LLM.
   */
  async fetchMedia(url: string): Promise<{ base64: string; mime: string }> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) throw new Error('Twilio credentials not configured');
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
    if (!res.ok) throw new Error(`Twilio media fetch failed: ${res.status}`);
    const mime = res.headers.get('content-type') ?? 'image/jpeg';
    const buf = Buffer.from(await res.arrayBuffer());
    return { base64: buf.toString('base64'), mime };
  }
}
