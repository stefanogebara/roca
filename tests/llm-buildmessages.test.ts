/**
 * buildMessages shaping — the pure part of the OpenRouter client. Pins the two
 * behaviours that matter for cost and correctness: the system prompt-cache
 * breakpoint is emitted only when asked (so the farmer reasoning path gets the
 * ~90% cached-prefix discount and nothing else pays for structured content it
 * doesn't need), and multimodal parts still assemble in order.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { buildMessages, buildRequestBody } from '../api/_lib/llm';
import { transcribeProviderPin } from '../api/_lib/env';

describe('buildMessages', () => {
  it('sends the system prompt as a plain string by default (no cache breakpoint)', () => {
    const msgs = buildMessages({ model: 'm', system: 'SPINE', user: 'oi' });
    expect(msgs[0]).toEqual({ role: 'system', content: 'SPINE' });
    expect(msgs[1]).toEqual({ role: 'user', content: 'oi' });
  });

  it('marks the system block with an ephemeral cache breakpoint when cacheSystem is set', () => {
    const msgs = buildMessages({ model: 'm', system: 'SPINE', user: 'oi', cacheSystem: true });
    expect(msgs[0]).toEqual({
      role: 'system',
      content: [{ type: 'text', text: 'SPINE', cache_control: { type: 'ephemeral' } }],
    });
    // The cache marker rides only on the system block, never the user turn.
    expect(msgs[1]).toEqual({ role: 'user', content: 'oi' });
  });

  it('omits the system message entirely when no system prompt is given', () => {
    const msgs = buildMessages({ model: 'm', user: 'oi' });
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe('user');
  });

  it('assembles image + text as ordered content parts (text last)', () => {
    const msgs = buildMessages({
      model: 'm',
      user: 'que praga é essa?',
      image: { base64: 'AAAA', mime: 'image/jpeg' },
    });
    const content = msgs[0].content as Array<{ type: string }>;
    expect(content[0]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/jpeg;base64,AAAA' },
    });
    expect(content[1]).toEqual({ type: 'text', text: 'que praga é essa?' });
  });

  it('keeps a plain string user content when there is no media', () => {
    const msgs = buildMessages({ model: 'm', user: 'só texto' });
    expect(msgs[0].content).toBe('só texto');
  });
});

describe('buildRequestBody — o pin de provider chega no fio', () => {
  it('inclui provider só quando pedido', () => {
    const sem = buildRequestBody({ model: 'm', user: 'oi' });
    expect('provider' in sem).toBe(false);
    const com = buildRequestBody({ model: 'm', user: 'oi', provider: { only: ['google-ai-studio'] } });
    expect(com.provider).toEqual({ only: ['google-ai-studio'] });
  });
});

describe('transcribeProviderPin — desacoplar a transcrição do Vertex', () => {
  afterEach(() => {
    delete process.env.ROCA_TRANSCRIBE_PROVIDER;
  });

  it('default: pin no google-ai-studio (o Vertex aposenta o Gemini 2.5 em 16/10/2026)', () => {
    expect(transcribeProviderPin()).toEqual({ only: ['google-ai-studio'] });
  });

  it('env troca o provider do pin', () => {
    process.env.ROCA_TRANSCRIBE_PROVIDER = 'google-vertex';
    expect(transcribeProviderPin()).toEqual({ only: ['google-vertex'] });
  });

  it('"any" desliga o pin — roteamento livre como antes', () => {
    process.env.ROCA_TRANSCRIBE_PROVIDER = 'any';
    expect(transcribeProviderPin()).toBeUndefined();
  });
});
