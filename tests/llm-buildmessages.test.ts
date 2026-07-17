/**
 * buildMessages shaping — the pure part of the OpenRouter client. Pins the two
 * behaviours that matter for cost and correctness: the system prompt-cache
 * breakpoint is emitted only when asked (so the farmer reasoning path gets the
 * ~90% cached-prefix discount and nothing else pays for structured content it
 * doesn't need), and multimodal parts still assemble in order.
 */
import { describe, it, expect } from 'vitest';
import { buildMessages } from '../api/_lib/llm';

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
