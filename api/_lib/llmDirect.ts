/**
 * Fallback direto de provedor — a rota que existe para o dia em que o gateway
 * falhar como CONTA, não como rede. Motivação datada: a Stripe anunciou a
 * compra da OpenRouter em 19/08/2026 ("nothing about your integration
 * changes", mas promessa não é contrato), e este repo tinha o OpenRouter como
 * gateway ÚNICO de LLM. Uma chave direta da Anthropic e/ou do Google no env
 * vira um segundo caminho para os MESMOS modelos; sem as chaves, nada muda.
 *
 * Mesmo estilo do gateway: fetch puro, sem SDK, sem streaming. Quem decide
 * QUANDO tentar (e com quanto tempo) é o llm.ts — aqui só se fala o dialeto
 * de cada provedor.
 */

import { buildMessages, type ChatOptions } from './llm';

export interface DirectRoute {
  provider: 'anthropic' | 'google';
  /** Model id no dialeto do provedor (sem o prefixo de slug do OpenRouter). */
  model: string;
  envKey: 'ANTHROPIC_API_KEY' | 'GEMINI_API_KEY';
}

/**
 * Slug do OpenRouter → rota direta, ou null quando não há API direta mapeada.
 * A Anthropic usa hífen onde o slug usa ponto ("claude-haiku-4.5" →
 * "claude-haiku-4-5"); o Google mantém o ponto ("gemini-2.5-flash").
 */
export function directRouteFor(slug: string): DirectRoute | null {
  if (slug.startsWith('anthropic/')) {
    return {
      provider: 'anthropic',
      model: slug.slice('anthropic/'.length).replace(/\./g, '-'),
      envKey: 'ANTHROPIC_API_KEY',
    };
  }
  if (slug.startsWith('google/')) {
    return {
      provider: 'google',
      model: slug.slice('google/'.length),
      envKey: 'GEMINI_API_KEY',
    };
  }
  return null;
}

type AnthropicPart =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

/**
 * Corpo da Messages API da Anthropic. Pure. Devolve null quando a chamada não
 * é exprimível lá (áudio: a Messages API não aceita input de áudio — e áudio é
 * caso do Google de qualquer forma).
 */
export function buildAnthropicBody(
  opts: ChatOptions,
  model: string
): Record<string, unknown> | null {
  if (opts.audio) return null;
  let content: string | AnthropicPart[] = opts.user;
  if (opts.image) {
    content = [
      {
        type: 'image',
        source: { type: 'base64', media_type: opts.image.mime, data: opts.image.base64 },
      },
      { type: 'text', text: opts.user },
    ];
  }
  return {
    model,
    max_tokens: opts.maxTokens ?? 600,
    ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
    ...(opts.system ? { system: opts.system } : {}),
    messages: [{ role: 'user', content }],
  };
}

/**
 * Corpo do endpoint OpenAI-compatível do Google AI Studio
 * (generativelanguage.googleapis.com/v1beta/openai). Mesmo formato do gateway,
 * então reusa buildMessages — só sem o breakpoint de prompt-cache, que é
 * dialeto Anthropic-via-OpenRouter e a camada compat do Google não conhece.
 */
export function buildGoogleBody(opts: ChatOptions, model: string): Record<string, unknown> {
  return {
    model,
    max_tokens: opts.maxTokens ?? 600,
    ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
    messages: buildMessages({ ...opts, cacheSystem: false }),
  };
}

export interface DirectReply {
  text: string;
  /** Normalizado pro contrato do chatDetailed: 'length' = completion cortada. */
  finishReason: string | null;
}

/**
 * Uma chamada direta, sem retry — o retry já aconteceu no gateway, e o tempo
 * que sobrou é de quem chamou. Erros carregam o status na posição que
 * isTransient reconhece ("Anthropic 429: ...").
 */
export async function chatDirect(
  opts: ChatOptions,
  route: DirectRoute,
  timeoutMs: number
): Promise<DirectReply> {
  if (timeoutMs <= 0) throw new Error('sem orçamento de tempo para o fallback direto');
  const apiKey = process.env[route.envKey];
  if (!apiKey) throw new Error(`sem ${route.envKey} no env`);

  if (route.provider === 'anthropic') {
    const body = buildAnthropicBody(opts, route.model);
    if (!body) throw new Error('chamada não exprimível na Messages API (áudio)');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
      stop_reason?: string | null;
    };
    const text = (data.content ?? [])
      .filter((c) => c.type === 'text' && c.text)
      .map((c) => c.text)
      .join('')
      .trim();
    if (!text) throw new Error('Anthropic returned empty completion');
    return { text, finishReason: data.stop_reason === 'max_tokens' ? 'length' : (data.stop_reason ?? null) };
  }

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(buildGoogleBody(opts, route.model)),
    }
  );
  if (!res.ok) throw new Error(`GoogleAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('GoogleAI returned empty completion');
  return { text, finishReason: data.choices?.[0]?.finish_reason ?? null };
}
