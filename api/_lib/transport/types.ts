/**
 * Transport-agnostic message shapes. Every WhatsApp provider (Twilio sandbox now,
 * Meta Cloud API later) is adapted into these types so the pipeline never knows
 * which provider it's talking to.
 */

export type InboundKind = 'text' | 'image' | 'voice' | 'location' | 'unsupported';

export interface InboundMessage {
  /** Sender phone in E.164-ish form, no `whatsapp:` prefix. */
  from: string;
  /** Provider message id (idempotency). */
  messageId: string;
  kind: InboundKind;
  /** Text body, or transcript/caption when available. */
  text: string | null;
  /** Media URL for image/voice, fetched lazily and bandwidth-frugally. */
  mediaUrl: string | null;
  /** Media MIME type, when the provider supplies it. */
  mediaMime: string | null;
  /** Parsed coordinates for location messages. */
  location: { lat: number; lon: number } | null;
  /** WhatsApp profile display name, if provided. */
  profileName: string | null;
}

export interface OutboundMessage {
  to: string;
  text: string;
}

/**
 * A transport adapter bridges a provider's HTTP webhook to InboundMessage and
 * sends OutboundMessage back. `isSync` is true for Twilio (TwiML reply on the
 * same response) and false for Cloud API (async send via REST).
 */
export interface TransportAdapter {
  readonly provider: string;
  readonly isSync: boolean;
  verifySignature(req: TransportRequest): Promise<boolean>;
  parseInbound(req: TransportRequest): Promise<InboundMessage | null>;
  send(msg: OutboundMessage): Promise<void>;
  /** Resolve an inbound media reference (Twilio URL or Cloud media id) to bytes. */
  fetchMedia?(ref: string): Promise<{ base64: string; mime: string }>;
}

/** Minimal request surface the adapters need. The webhook reads the raw body
 * once (body parsing is disabled) so providers can verify signatures over the
 * exact bytes; each adapter parses `rawBody` itself. */
export interface TransportRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  url?: string;
  /** Exact request bytes, for signature verification and per-provider parsing. */
  rawBody: Buffer;
}
