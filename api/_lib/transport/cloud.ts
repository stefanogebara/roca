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
  contacts?: Array<{
    name?: { formatted_name?: string };
    phones?: Array<{ phone?: string }>;
  }>;
}

function classifyMime(mime: string | undefined): InboundKind {
  if (!mime) return 'unsupported';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'voice';
  return 'unsupported';
}

const STATUS_VALUES = new Set(['sent', 'delivered', 'read', 'failed']);

/**
 * Extract message-status callbacks (sent/delivered/read/failed) from a Cloud
 * webhook body. Statuses arrive in the same envelope as messages but under
 * value.statuses[], possibly batched across entries/changes. Pure; returns []
 * for message payloads, junk, and unknown status values.
 */
export function parseCloudStatuses(
  rawBody: Buffer | string
): Array<{ wamid: string; status: 'sent' | 'delivered' | 'read' | 'failed'; errorDetail: string | null }> {
  try {
    const data = JSON.parse(rawBody.toString()) as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            statuses?: Array<{
              id?: string;
              status?: string;
              errors?: Array<{ code?: number; title?: string; message?: string }>;
            }>;
          };
        }>;
      }>;
    };
    const out: Array<{ wamid: string; status: 'sent' | 'delivered' | 'read' | 'failed'; errorDetail: string | null }> = [];
    for (const entry of data.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const st of change.value?.statuses ?? []) {
          if (!st.id || !st.status || !STATUS_VALUES.has(st.status)) continue;
          const err = (st.errors ?? [])[0];
          out.push({
            wamid: st.id,
            status: st.status as 'sent' | 'delivered' | 'read' | 'failed',
            errorDetail: err ? `${err.code ?? ''} ${err.title ?? err.message ?? ''}`.trim() || null : null,
          });
        }
      }
    }
    return out;
  } catch {
    return [];
  }
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
      case 'contacts': {
        // Shared contact card(s) → text summary, so both the farmer pipeline
        // and the prospect agent can use it without a new inbound kind.
        const cards = (msg.contacts ?? []) as Array<{
          name?: { formatted_name?: string };
          phones?: Array<{ phone?: string }>;
        }>;
        text = cards
          .map((c) => {
            const phones = (c.phones ?? []).map((p) => p.phone).filter(Boolean).join(', ');
            return `[contato compartilhado] ${c.name?.formatted_name ?? '(sem nome)'}${phones ? ` — ${phones}` : ''}`;
          })
          .join('\n')
          .trim() || null;
        break;
      }
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
    // Media path: an image (default) or a document (PDF), with the text as
    // caption. On failure, fall back to plain text so a broken attachment never
    // drops the reply.
    if (msg.mediaUrl) {
      const caption = msg.text.slice(0, 1024);
      const media =
        msg.mediaType === 'document'
          ? {
              type: 'document',
              document: {
                link: msg.mediaUrl,
                caption,
                filename: msg.filename ?? 'documento.pdf',
              },
            }
          : { type: 'image', image: { link: msg.mediaUrl, caption } };
      const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: msg.to,
          ...media,
        }),
      });
      if (res.ok) return;
      await this.send({ to: msg.to, text: msg.text, buttons: msg.buttons });
      return;
    }

    // Interactive reply buttons (≤3, titles ≤20 chars, body ≤1024) when
    // requested; plain text otherwise. A rejected interactive send retries as
    // plain text — every rich message carries its plain-text twin.
    const interactive = !!msg.buttons?.length && msg.text.length <= 1024;
    const payload = interactive
      ? {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: msg.to,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: msg.text },
            action: {
              buttons: msg.buttons!.slice(0, 3).map((title, i) => ({
                type: 'reply',
                reply: { id: `qr_${i}`, title: title.slice(0, 20) },
              })),
            },
          },
        }
      : {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: msg.to,
          type: 'text',
          text: { preview_url: false, body: msg.text },
        };

    const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text();
      if (interactive) {
        await this.send({ to: msg.to, text: msg.text });
        return;
      }
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
