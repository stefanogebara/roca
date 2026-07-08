import { describe, it, expect, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { CloudApiAdapter, verifyCloudChallenge } from '../api/_lib/transport/cloud';
import type { TransportRequest } from '../api/_lib/transport/types';

function reqOf(body: unknown, headers: Record<string, string> = {}): TransportRequest {
  const rawBody = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body), 'utf8');
  return { method: 'POST', headers, url: '/api/webhook', rawBody };
}

const messageEnvelope = (msg: Record<string, unknown>, name = 'Seu Antônio') => ({
  object: 'whatsapp_business_account',
  entry: [
    {
      changes: [
        { value: { contacts: [{ profile: { name } }], messages: [msg] }, field: 'messages' },
      ],
    },
  ],
});

describe('verifyCloudChallenge', () => {
  beforeEach(() => {
    process.env.WHATSAPP_CLOUD_VERIFY_TOKEN = 'verify-me';
  });

  it('echoes the challenge when the verify token matches', () => {
    expect(
      verifyCloudChallenge({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'verify-me',
        'hub.challenge': '12345',
      })
    ).toBe('12345');
  });

  it('rejects a wrong verify token', () => {
    expect(
      verifyCloudChallenge({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong',
        'hub.challenge': '12345',
      })
    ).toBeNull();
  });
});

describe('CloudApiAdapter.verifySignature', () => {
  const adapter = new CloudApiAdapter();
  beforeEach(() => {
    process.env.WHATSAPP_APP_SECRET = 'app-secret-xyz';
  });

  it('accepts a correct X-Hub-Signature-256', async () => {
    const body = JSON.stringify(messageEnvelope({ from: '55', id: 'w1', type: 'text', text: { body: 'oi' } }));
    const sig = 'sha256=' + createHmac('sha256', 'app-secret-xyz').update(Buffer.from(body)).digest('hex');
    const ok = await adapter.verifySignature(reqOf(body, { 'x-hub-signature-256': sig }));
    expect(ok).toBe(true);
  });

  it('rejects a tampered body', async () => {
    const body = JSON.stringify(messageEnvelope({ from: '55', id: 'w1', type: 'text', text: { body: 'oi' } }));
    const sig = 'sha256=' + createHmac('sha256', 'app-secret-xyz').update(Buffer.from(body)).digest('hex');
    const tampered = body.replace('oi', 'tchau');
    const ok = await adapter.verifySignature(reqOf(tampered, { 'x-hub-signature-256': sig }));
    expect(ok).toBe(false);
  });

  it('rejects a missing signature header', async () => {
    const ok = await adapter.verifySignature(reqOf(messageEnvelope({ from: '55', id: 'w1', type: 'text', text: { body: 'oi' } })));
    expect(ok).toBe(false);
  });
});

describe('CloudApiAdapter.parseInbound', () => {
  const adapter = new CloudApiAdapter();

  it('parses a text message with profile name', async () => {
    const m = await adapter.parseInbound(
      reqOf(messageEnvelope({ from: '5511999', id: 'w1', type: 'text', text: { body: '  posso pulverizar?  ' } }))
    );
    expect(m).not.toBeNull();
    expect(m!.kind).toBe('text');
    expect(m!.text).toBe('posso pulverizar?');
    expect(m!.from).toBe('5511999');
    expect(m!.profileName).toBe('Seu Antônio');
  });

  it('parses an image with the media id as mediaUrl and caption as text', async () => {
    const m = await adapter.parseInbound(
      reqOf(messageEnvelope({ from: '55', id: 'w2', type: 'image', image: { id: 'MEDIA123', mime_type: 'image/jpeg', caption: 'que praga é essa?' } }))
    );
    expect(m!.kind).toBe('image');
    expect(m!.mediaUrl).toBe('MEDIA123');
    expect(m!.mediaMime).toBe('image/jpeg');
    expect(m!.text).toBe('que praga é essa?');
  });

  it('parses a voice note', async () => {
    const m = await adapter.parseInbound(
      reqOf(messageEnvelope({ from: '55', id: 'w3', type: 'audio', audio: { id: 'AUD1', mime_type: 'audio/ogg; codecs=opus' } }))
    );
    expect(m!.kind).toBe('voice');
    expect(m!.mediaUrl).toBe('AUD1');
  });

  it('parses a location', async () => {
    const m = await adapter.parseInbound(
      reqOf(messageEnvelope({ from: '55', id: 'w4', type: 'location', location: { latitude: -12.5, longitude: -55.7 } }))
    );
    expect(m!.kind).toBe('location');
    expect(m!.location).toEqual({ lat: -12.5, lon: -55.7 });
  });

  it('returns null for a status callback (no messages)', async () => {
    const statusEnvelope = {
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { statuses: [{ id: 'w1', status: 'delivered' }] }, field: 'messages' }] }],
    };
    expect(await adapter.parseInbound(reqOf(statusEnvelope))).toBeNull();
  });

  it('returns null for malformed JSON (fail-soft)', async () => {
    expect(await adapter.parseInbound(reqOf('{not json'))).toBeNull();
  });
});
