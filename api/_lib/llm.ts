/**
 * OpenRouter chat client (OpenAI-compatible API). One key serves every model
 * tier; Anthropic models are reached via anthropic/* slugs. Kept as plain fetch
 * — no SDK dependency, no streaming, WhatsApp-sized replies.
 */

import { requireEnv } from './env';

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
}

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'input_audio'; input_audio: { data: string; format: string } };

/** Send one chat turn and return the assistant text. Throws on API failure. */
export async function chat(opts: ChatOptions): Promise<string> {
  const apiKey = requireEnv('OPENROUTER_API_KEY');

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

  const messages: Array<{ role: string; content: string | ContentPart[] }> = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content });

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
