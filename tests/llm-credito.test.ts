/**
 * Falha por CRÉDITO é diferente de falha transitória.
 *
 * 29/jul, fim do dia: o OpenRouter devolveu 402 "Insufficient credits" e o gym
 * gravou uma rodada de zeros. Isso é o de menos — a Vitória usa o MESMO
 * OpenRouter em produção, e buildAgentReply degrada para silêncio quando o
 * modelo falha. Comportamento seguro (melhor calar que mandar lixo), mas
 * SILENCIOSO: se o saldo acabar num dia de disparo, o prospect responde, ela
 * fica muda, e ninguém é avisado.
 *
 * Timeout e 429 se resolvem sozinhos com retry. Saldo zero não: alguém tem que
 * pagar. São classes diferentes e precisam de tratamento diferente.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isCreditError, deveAlertarCredito, CREDIT_ALERT_COOLDOWN_MS } from '../api/_lib/llm';

describe('isCreditError — separar "sem saldo" de "deu ruim"', () => {
  it('pega o 402 que aconteceu de verdade', () => {
    expect(
      isCreditError('OpenRouter 402: {"error":{"message":"Insufficient credits. Add more using https://openrouter.ai/settings/credits","code":402}}')
    ).toBe(true);
  });

  it('pega as variações de mensagem de saldo', () => {
    for (const m of [
      'OpenRouter 402: payment required',
      'insufficient credits',
      'OpenRouter error: quota exceeded for this key',
      'Your credit balance is too low',
    ]) {
      expect(isCreditError(m), m).toBe(true);
    }
  });

  it('NÃO confunde com falha transitória — essas o retry resolve', () => {
    for (const m of [
      'OpenRouter 429: rate limit',
      'OpenRouter 503: upstream unavailable',
      'timeout after 25000ms',
      'OpenRouter returned empty completion',
      'fetch failed',
    ]) {
      expect(isCreditError(m), m).toBe(false);
    }
  });

  it('não explode com entrada vazia', () => {
    expect(isCreditError('')).toBe(false);
    expect(isCreditError(null)).toBe(false);
  });
});

describe('deveAlertarCredito — avisa, mas não vira spam', () => {
  const T0 = 1_000_000;

  it('primeira falha alerta', () => {
    expect(deveAlertarCredito(null, T0)).toBe(true);
  });

  it('falha logo depois NÃO alerta de novo — uma rajada é um problema, não vinte', () => {
    expect(deveAlertarCredito(T0, T0 + 1000)).toBe(false);
  });

  it('passado o cooldown, alerta de novo — o problema persiste e continua caro', () => {
    expect(deveAlertarCredito(T0, T0 + CREDIT_ALERT_COOLDOWN_MS + 1)).toBe(true);
  });

  it('o cooldown é de minutos, não de horas — saldo zero para o produto', () => {
    expect(CREDIT_ALERT_COOLDOWN_MS).toBeLessThanOrEqual(30 * 60_000);
    expect(CREDIT_ALERT_COOLDOWN_MS).toBeGreaterThanOrEqual(60_000);
  });
});

/**
 * Os testes acima provam as funções puras. Este prova a FIAÇÃO — que o chat()
 * de fato chama o alerta. Cinco vezes hoje o bug foi o mesmo: o dado existia e
 * não estava ligado na decisão. Uma função de alerta que ninguém chama é
 * exatamente isso com outra roupa.
 */
describe('chat() — o alerta está ligado no caminho real', () => {
  const alertFounders = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    alertFounders.mockClear();
    vi.doMock('../api/_lib/alert', () => ({ alertFounders }));
    process.env.OPENROUTER_API_KEY = 'test-key';
  });

  afterEach(() => {
    vi.doUnmock('../api/_lib/alert');
    vi.unstubAllGlobals();
  });

  function respondeCom(status: number, body: string) {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status })));
  }

  it('402 alerta os fundadores E continua jogando o erro pra cima', async () => {
    respondeCom(402, '{"error":{"message":"Insufficient credits"}}');
    const { chat } = await import('../api/_lib/llm');

    // O erro TEM que subir: quem chamou decide o que fazer sem modelo. Um alerta
    // que engole a exceção seria pior que o problema que ele reporta.
    await expect(chat({ model: 'x', user: 'oi' })).rejects.toThrow(/402/);
    await vi.waitFor(() => expect(alertFounders).toHaveBeenCalledTimes(1));
    expect(alertFounders.mock.calls[0][0]).toMatch(/SEM SALDO/);
  });

  it('503 NÃO alerta — falha transitória não acorda ninguém', async () => {
    respondeCom(503, 'upstream unavailable');
    const { chat } = await import('../api/_lib/llm');

    await expect(chat({ model: 'x', user: 'oi' })).rejects.toThrow();
    expect(alertFounders).not.toHaveBeenCalled();
  });

  it('rajada de 402 alerta UMA vez — o cooldown vale no caminho real', async () => {
    respondeCom(402, 'Insufficient credits');
    const { chat } = await import('../api/_lib/llm');

    for (let i = 0; i < 4; i++) {
      await expect(chat({ model: 'x', user: 'oi' })).rejects.toThrow();
    }
    await vi.waitFor(() => expect(alertFounders).toHaveBeenCalledTimes(1));
  });
});
