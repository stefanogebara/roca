/**
 * OpenRouter chat client (OpenAI-compatible API). One key serves every model
 * tier; Anthropic models are reached via anthropic/* slugs. Kept as plain fetch
 * — no SDK dependency, no streaming, WhatsApp-sized replies.
 */

import { requireEnv, MODELS } from './env';
import { withRetry, isTransient } from './retry';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface ChatImage {
  base64: string;
  mime: string;
}

export interface ChatAudio {
  base64: string;
  /** e.g. 'ogg', 'mp3', 'wav' — WhatsApp voice notes are ogg/opus. */
  format: string;
}

export interface ChatOptions {
  model: string;
  system?: string;
  user: string;
  image?: ChatImage | null;
  audio?: ChatAudio | null;
  maxTokens?: number;
  /** Sampling temperature. Omit for provider default; the Gym runs personas hot. */
  temperature?: number;
  /**
   * Mark the system prompt as an Anthropic prompt-cache breakpoint (ephemeral).
   * Worth it when the same large system prompt repeats across requests — the
   * farmer reasoning path reuses the base persona + style pack on every call and
   * puts all per-request content in the user message, so the system block is a
   * stable prefix Anthropic can cache (~90% input-token cut on a hit). No-op on
   * models/providers that don't cache, or below the minimum cacheable length.
   */
  cacheSystem?: boolean;
}

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'input_audio'; input_audio: { data: string; format: string } };

/** A system message either as a plain string or a cache-marked content block. */
type SystemBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } };
type ChatMessage = { role: string; content: string | ContentPart[] | SystemBlock[] };

/** Short PT-BR description of an image (for feeding vision into text-only flows). */
export async function describeImage(image: ChatImage): Promise<string> {
  return chat({
    model: MODELS.reasoning(),
    maxTokens: 120,
    user: 'Descreva esta imagem em 1-2 frases objetivas, em português.',
    image,
  });
}

/**
 * Send one chat turn and return the assistant text. Throws on API failure.
 * One retry on transient failures (429/5xx/network) and on empty completions —
 * OpenRouter occasionally returns those transiently (seen in gym runs). Kept to
 * a single retry: these calls are the slow part of a webhook with a hard
 * maxDuration budget.
 */
export async function chat(opts: ChatOptions): Promise<string> {
  return withRetry(() => chatOnce(opts), {
    attempts: 2,
    shouldRetry: (e) =>
      isTransient(e) || (e instanceof Error && e.message.includes('empty completion')),
  });
}

/**
 * Build the OpenRouter `messages` array from chat options. Pure — extracted so
 * message shaping (image/audio parts, system prompt-cache breakpoint) is unit
 * testable without a live API call.
 */
export function buildMessages(opts: ChatOptions): ChatMessage[] {
  let content: string | ContentPart[] = opts.user;
  if (opts.image || opts.audio) {
    const parts: ContentPart[] = [];
    if (opts.image) {
      parts.push({
        type: 'image_url',
        image_url: { url: `data:${opts.image.mime};base64,${opts.image.base64}` },
      });
    }
    if (opts.audio) {
      parts.push({
        type: 'input_audio',
        input_audio: { data: opts.audio.base64, format: opts.audio.format },
      });
    }
    parts.push({ type: 'text', text: opts.user });
    content = parts;
  }

  const messages: ChatMessage[] = [];
  if (opts.system) {
    // With cacheSystem, send the system prompt as a content block carrying an
    // ephemeral cache_control breakpoint (Anthropic prompt caching, passed
    // through by OpenRouter). Otherwise a plain string, as before.
    messages.push(
      opts.cacheSystem
        ? { role: 'system', content: [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }] }
        : { role: 'system', content: opts.system }
    );
  }
  messages.push({ role: 'user', content });
  return messages;
}

async function chatOnce(opts: ChatOptions): Promise<string> {
  const apiKey = requireEnv('OPENROUTER_API_KEY');

  const messages = buildMessages(opts);

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://roca-black.vercel.app',
      'X-Title': 'Stevi',
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 600,
      ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
      messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (data.error) throw new Error(`OpenRouter error: ${data.error.message}`);

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('OpenRouter returned empty completion');
  return text;
}
