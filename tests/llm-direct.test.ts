/**
 * Fallback direto de gateway (llmDirect) — a diversificação pós-aquisição
 * OpenRouter→Stripe. Fixa três coisas: o mapeamento de slug→API direta (o
 * dialeto de model id da Anthropic difere do slug), a forma dos corpos por
 * provedor, e o comportamento do chat(): gateway esgotado + chave direta
 * presente = uma tentativa direta; sem chave = o erro ORIGINAL sobe, como
 * sempre subiu.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { chat } from '../api/_lib/llm';

// O caso 402 abaixo dispara o alerta de crédito (fireAndForget → alert.ts);
// sem o mock, o alerta real tentaria rede DEPOIS do unstub do fetch.
vi.mock('../api/_lib/alert', () => ({ alertFounders: vi.fn() }));
import {
  directRouteFor,
  buildAnthropicBody,
  buildGoogleBody,
} from '../api/_lib/llmDirect';

describe('directRouteFor', () => {
  it('mapeia slug anthropic trocando ponto por hífen (dialeto de model id)', () => {
    expect(directRouteFor('anthropic/claude-haiku-4.5')).toEqual({
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      envKey: 'ANTHROPIC_API_KEY',
    });
    expect(directRouteFor('anthropic/claude-sonnet-5')?.model).toBe('claude-sonnet-5');
  });

  it('mapeia slug google mantendo o ponto', () => {
    expect(directRouteFor('google/gemini-2.5-flash')).toEqual({
      provider: 'google',
      model: 'gemini-2.5-flash',
      envKey: 'GEMINI_API_KEY',
    });
  });

  it('devolve null para provedor sem API direta mapeada', () => {
    expect(directRouteFor('openai/gpt-5')).toBeNull();
    expect(directRouteFor('test/model')).toBeNull();
  });
});

describe('buildAnthropicBody', () => {
  it('põe o system no topo e a mensagem como user', () => {
    const body = buildAnthropicBody({ model: 'x', system: 'SPINE', user: 'oi' }, 'claude-sonnet-5');
    expect(body).toEqual({
      model: 'claude-sonnet-5',
      max_tokens: 600,
      system: 'SPINE',
      messages: [{ role: 'user', content: 'oi' }],
    });
  });

  it('monta imagem como source base64 com o texto depois', () => {
    const body = buildAnthropicBody(
      { model: 'x', user: 'que praga?', image: { base64: 'AAAA', mime: 'image/jpeg' } },
      'claude-sonnet-5'
    );
    expect((body as { messages: Array<{ content: unknown }> }).messages[0].content).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } },
      { type: 'text', text: 'que praga?' },
    ]);
  });

  it('devolve null para áudio — a Messages API não transcreve', () => {
    expect(
      buildAnthropicBody({ model: 'x', user: 'oi', audio: { base64: 'A', format: 'ogg' } }, 'm')
    ).toBeNull();
  });
});

describe('buildGoogleBody', () => {
  it('reusa o formato OpenAI, áudio incluso, sem breakpoint de cache', () => {
    const body = buildGoogleBody(
      { model: 'x', system: 'S', user: 'oi', cacheSystem: true, audio: { base64: 'A', format: 'ogg' } },
      'gemini-2.5-flash'
    ) as { model: string; messages: Array<{ role: string; content: unknown }> };
    expect(body.model).toBe('gemini-2.5-flash');
    // cacheSystem é dialeto Anthropic-via-OpenRouter: aqui o system volta a string.
    expect(body.messages[0]).toEqual({ role: 'system', content: 'S' });
    const parts = body.messages[1].content as Array<{ type: string }>;
    expect(parts[0].type).toBe('input_audio');
  });
});

describe('chat com fallback direto', () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'test-key';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('gateway 500 + chave direta presente = a resposta vem da API direta', async () => {
    process.env.ANTHROPIC_API_KEY = 'direct-key';
    const fetchMock = vi.fn(async (url: unknown) => {
      if (String(url).includes('openrouter.ai')) {
        return new Response('gateway morto', { status: 500 });
      }
      return new Response(
        JSON.stringify({ content: [{ type: 'text', text: 'salvo' }], stop_reason: 'end_turn' }),
        { status: 200 }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const out = await chat({ model: 'anthropic/claude-sonnet-5', user: 'oi', timeoutMs: 50 });
    expect(out).toBe('salvo');
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('api.anthropic.com/v1/messages'))).toBe(true);
  });

  it('sem chave direta, o erro original do gateway sobe — nada muda', async () => {
    const fetchMock = vi.fn(async (url: unknown) => {
      void url;
      return new Response('gateway morto', { status: 500 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      chat({ model: 'anthropic/claude-sonnet-5', user: 'oi', timeoutMs: 50 })
    ).rejects.toThrow(/OpenRouter 500/);
    // Só o gateway foi chamado (2 tentativas do retry), nunca a API direta.
    for (const c of fetchMock.mock.calls) {
      expect(String(c[0])).toContain('openrouter.ai');
    }
  });

  it('fallback também falhando, o erro que sobe é o do GATEWAY (o incidente real)', async () => {
    process.env.ANTHROPIC_API_KEY = 'direct-key';
    const fetchMock = vi.fn(async (url: unknown) =>
      String(url).includes('openrouter.ai')
        ? new Response('sem saldo', { status: 402 })
        : new Response('tudo fora', { status: 500 })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      chat({ model: 'anthropic/claude-sonnet-5', user: 'oi', timeoutMs: 50 })
    ).rejects.toThrow(/OpenRouter 402/);
  });
});
