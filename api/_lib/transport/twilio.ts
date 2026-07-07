/**
 * Twilio WhatsApp Sandbox adapter (Stage 0 transport).
 *
 * Twilio posts URL-encoded form bodies and expects a TwiML reply, but we send
 * asynchronously via the REST API to keep the pipeline uniform with Cloud API.
 * The webhook returns empty TwiML immediately; the real answer is sent out-of-band.
 */

import twilio from 'twilio';
import type {
  TransportAdapter,
  TransportRequest,
  InboundMessage,
  OutboundMessage,
  InboundKind,
} from './types';

function formToObject(body: unknown): Record<string, string> {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, string>;
  }
  if (typeof body === 'string') {
    const params = new URLSearchParams(body);
    const out: Record<string, string> = {};
    for (const [k, v] of params) out[k] = v;
    return out;
  }
  return {};
}

function classifyMedia(mime: string | null): InboundKind {
  if (!mime) return 'unsupported';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'voice';
  return 'unsupported';
}

export class TwilioAdapter implements TransportAdapter {
  readonly provider = 'twilio';
  readonly isSync = false;

  private client: twilio.Twilio | null = null;

  private getClient(): twilio.Twilio {
    if (this.client) return this.client;
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      throw new Error('TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not configured');
    }
    this.client = twilio(sid, token);
    return this.client;
  }

  async verifySignature(req: TransportRequest): Promise<boolean> {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) return false;
    const signature = req.headers['x-twilio-signature'];
    if (typeof signature !== 'string') return false;
    const host = req.headers['host'];
    const url = `https://${host}${req.url ?? ''}`;
    return twilio.validateRequest(authToken, signature, url, formToObject(req.body));
  }

  async parseInbound(req: TransportRequest): Promise<InboundMessage | null> {
    const b = formToObject(req.body);
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
    const fromNumber = process.env.TWILIO_WHATSAPP_FROM;
    if (!fromNumber) throw new Error('TWILIO_WHATSAPP_FROM not configured');
    await this.getClient().messages.create({
      from: fromNumber,
      to: `whatsapp:${msg.to}`,
      body: msg.text,
    });
  }

  /**
   * Twilio media URLs require basic-auth with the account credentials.
   * Returns the media as a base64 data payload for Claude vision.
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
