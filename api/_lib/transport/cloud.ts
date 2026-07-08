/**
 * Meta WhatsApp Cloud API adapter (the scale/compliance transport — dossier
 * Part 6.4 endgame). Verifies the webhook subscription challenge and the
 * X-Hub-Signature-256 HMAC, parses the Graph message envelope, resolves media
 * ids to bytes, and sends via the Graph API.
 *
 * Uses plain fetch + node:crypto — no SDK. Coexists with the Twilio adapter;
 * the webhook picks the adapter by request shape, so pointing Meta's webhook at
 * the same URL needs no redeploy.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  TransportAdapter,
  TransportRequest,
  InboundMessage,
  OutboundMessage,
  InboundKind,
} from './types';

const GRAPH = 'https://graph.facebook.com/v21.0';

interface CloudMessage {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type?: string; caption?: string };
  audio?: { id: string; mime_type?: string };
  voice?: { id: string; mime_type?: string };
  location?: { latitude: number; longitude: number };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
  button?: { text?: string };
}

function classifyMime(mime: string | undefined): InboundKind {
  if (!mime) return 'unsupported';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'voice';
  return 'unsupported';
}

/**
 * Verify Meta's webhook subscription challenge (GET). Returns the challenge to
 * echo when the verify token matches, else null.
 */
export function verifyCloudChallenge(query: Record<string, unknown>): string | null {
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];
  const expected = process.env.WHATSAPP_CLOUD_VERIFY_TOKEN;
  if (mode === 'subscribe' && expected && token === expected) {
    return typeof challenge === 'string' ? challenge : String(challenge ?? '');
  }
  return null;
}

export class CloudApiAdapter implements TransportAdapter {
  readonly provider = 'cloud';
  readonly isSync = false;

  /** HMAC-SHA256 of the raw body, keyed by the app secret; compared to header. */
  async verifySignature(req: TransportRequest): Promise<boolean> {
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (!appSecret) return false;
    const header = req.headers['x-hub-signature-256'];
    if (typeof header !== 'string' || !header.startsWith('sha256=')) return false;
    const expected = createHmac('sha256', appSecret).update(req.rawBody).digest('hex');
    const a = Buffer.from(header.slice('sha256='.length));
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private firstMessage(req: TransportRequest): {
    msg: CloudMessage | null;
    profileName: string | null;
  } {
    try {
      const data = JSON.parse(req.rawBody.toString('utf8')) as {
        entry?: Array<{
          changes?: Array<{
            value?: {
              messages?: CloudMessage[];
              contacts?: Array<{ profile?: { name?: string } }>;
            };
          }>;
        }>;
      };
      const value = data.entry?.[0]?.changes?.[0]?.value;
      const msg = value?.messages?.[0] ?? null;
      const profileName = value?.contacts?.[0]?.profile?.name ?? null;
      return { msg, profileName };
    } catch {
      return { msg: null, profileName: null };
    }
  }

  async parseInbound(req: TransportRequest): Promise<InboundMessage | null> {
    const { msg, profileName } = this.firstMessage(req);
    if (!msg || !msg.from) return null; // e.g. status callbacks carry no message

    let kind: InboundKind = 'text';
    let text: string | null = null;
    let mediaUrl: string | null = null;
    let mediaMime: string | null = null;
    let location: { lat: number; lon: number } | null = null;

    switch (msg.type) {
      case 'text':
        text = msg.text?.body?.trim() || null;
        break;
      case 'image':
        kind = 'image';
        mediaUrl = msg.image?.id ?? null; // resolved by fetchMedia
        mediaMime = msg.image?.mime_type ?? null;
        text = msg.image?.caption?.trim() || null;
        break;
      case 'audio':
      case 'voice': {
        const a = msg.audio ?? msg.voice;
        kind = 'voice';
        mediaUrl = a?.id ?? null;
        mediaMime = a?.mime_type ?? null;
        break;
      }
      case 'location':
        if (msg.location) {
          kind = 'location';
          location = { lat: msg.location.latitude, lon: msg.location.longitude };
        }
        break;
      case 'interactive':
        text =
          msg.interactive?.button_reply?.title ??
          msg.interactive?.list_reply?.title ??
          null;
        break;
      case 'button':
        text = msg.button?.text?.trim() || null;
        break;
      default:
        kind = 'unsupported';
    }

    if (kind === 'text' && !text) return null;

    return {
      from: msg.from,
      messageId: msg.id,
      kind,
      text,
      mediaUrl,
      mediaMime,
      location,
      profileName,
    };
  }

  async send(msg: OutboundMessage): Promise<void> {
    const token = process.env.WHATSAPP_CLOUD_TOKEN;
    const phoneId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;
    if (!token || !phoneId) {
      throw new Error('WHATSAPP_CLOUD_TOKEN / WHATSAPP_CLOUD_PHONE_NUMBER_ID not configured');
    }
    const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: msg.to,
        type: 'text',
        text: { preview_url: false, body: msg.text },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Cloud API send failed ${res.status}: ${body.slice(0, 200)}`);
    }
  }

  /** Two-step media resolution: media id → temporary URL → bytes. */
  async fetchMedia(mediaId: string): Promise<{ base64: string; mime: string }> {
    const token = process.env.WHATSAPP_CLOUD_TOKEN;
    if (!token) throw new Error('WHATSAPP_CLOUD_TOKEN not configured');
    const auth = { Authorization: `Bearer ${token}` };

    const metaRes = await fetch(`${GRAPH}/${mediaId}`, { headers: auth });
    if (!metaRes.ok) throw new Error(`Cloud media meta failed: ${metaRes.status}`);
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
    if (!meta.url) throw new Error('Cloud media meta missing url');

    const binRes = await fetch(meta.url, { headers: auth });
    if (!binRes.ok) throw new Error(`Cloud media download failed: ${binRes.status}`);
    const mime = meta.mime_type ?? binRes.headers.get('content-type') ?? 'image/jpeg';
    const buf = Buffer.from(await binRes.arrayBuffer());
    return { base64: buf.toString('base64'), mime };
  }
}
