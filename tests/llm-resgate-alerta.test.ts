/**
 * O resgate acionado tem que ACORDAR alguém.
 *
 * Achado numa simulação real em 01/09: com a chave principal envenenada, o
 * OpenRouter devolve 401 "User not found" — que NÃO é isCreditError. A reserva
 * segurava todo o tráfego e o alerta de crédito não disparava: por fora tudo
 * funcionava, com registro só no log da Vercel, enquanto o saldo do outro
 * projeto escoava. Chave revogada é justamente o cenário de aquisição que
 * motivou a reserva existir.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { textoAlertaResgate, deveAlertar, RESCUE_ALERT_COOLDOWN_MS } from '../api/_lib/llm';

describe('textoAlertaResgate — o fundador precisa saber o que fazer', () => {
  it('a reserva nomeia a conta do outro projeto e o modelo', () => {
    const t = textoAlertaResgate('reserva', 'anthropic/claude-sonnet-5', 'OpenRouter 401: User not found');
    expect(t).toMatch(/CHAVE RESERVA/);
    expect(t).toContain('anthropic/claude-sonnet-5');
    expect(t).toMatch(/OUTRO projeto/);
    expect(t).toMatch(/openrouter\.ai/);
    // O motivo original viaja junto: 401 e 402 pedem ações diferentes.
    expect(t).toMatch(/401/);
  });

  it('o direto diz que as DUAS chaves do gateway falharam', () => {
    const t = textoAlertaResgate('direto', 'google/gemini-2.5-flash', 'OpenRouter 500');
    expect(t).toMatch(/API DIRETA/);
    expect(t).toMatch(/DUAS chaves/);
  });

  it('diz explicitamente que nada parece quebrado de fora — o motivo do alerta existir', () => {
    const t = textoAlertaResgate('reserva', 'm', 'x');
    expect(t).toMatch(/NADA parece quebrado/i);
  });
});

describe('deveAlertar — cooldown genérico', () => {
  const T0 = 1_000_000;
  it('primeira vez alerta; rajada não', () => {
    expect(deveAlertar(null, T0, RESCUE_ALERT_COOLDOWN_MS)).toBe(true);
    expect(deveAlertar(T0, T0 + 1000, RESCUE_ALERT_COOLDOWN_MS)).toBe(false);
  });
  it('passado o cooldown alerta de novo — o resgate ainda está ativo', () => {
    expect(deveAlertar(T0, T0 + RESCUE_ALERT_COOLDOWN_MS + 1, RESCUE_ALERT_COOLDOWN_MS)).toBe(true);
  });
});

/**
 * A FIAÇÃO: o alerta só vale se o caminho real o chamar. Cinco vezes neste
 * repo o bug foi o mesmo — o dado existia e não estava ligado na decisão.
 */
describe('chat() — o alerta de resgate está ligado no caminho real', () => {
  const alertFounders = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    alertFounders.mockClear();
    vi.doMock('../api/_lib/alert', () => ({ alertFounders }));
    process.env.OPENROUTER_API_KEY = 'principal-podre';
  });

  afterEach(() => {
    vi.doUnmock('../api/_lib/alert');
    vi.unstubAllGlobals();
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_FALLBACK_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  /** Gateway 401 na chave principal; a reserva responde. */
  function gatewayComReserva() {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init?: { headers?: Record<string, string> }) => {
        const auth = init?.headers?.Authorization ?? '';
        if (auth.includes('reserva')) {
          return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
            status: 200,
          });
        }
        return new Response('{"error":{"message":"User not found.","code":401}}', { status: 401 });
      })
    );
  }

  it('401 na principal + reserva salvando = alerta, mesmo sem ser erro de crédito', async () => {
    process.env.OPENROUTER_FALLBACK_API_KEY = 'reserva';
    gatewayComReserva();
    const { chat } = await import('../api/_lib/llm');

    expect(await chat({ model: 'x', user: 'oi', timeoutMs: 50 })).toBe('ok');
    await vi.waitFor(() => expect(alertFounders).toHaveBeenCalledTimes(1));
    expect(alertFounders.mock.calls[0][0]).toMatch(/CHAVE RESERVA/);
  });

  it('rajada de resgates alerta UMA vez — cooldown vale no caminho real', async () => {
    process.env.OPENROUTER_FALLBACK_API_KEY = 'reserva';
    gatewayComReserva();
    const { chat } = await import('../api/_lib/llm');

    for (let i = 0; i < 4; i++) {
      expect(await chat({ model: 'x', user: 'oi', timeoutMs: 50 })).toBe('ok');
    }
    await vi.waitFor(() => expect(alertFounders).toHaveBeenCalledTimes(1));
  });

  it('a API direta salvando também alerta', async () => {
    process.env.ANTHROPIC_API_KEY = 'direta';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: unknown) =>
        String(url).includes('openrouter.ai')
          ? new Response('plataforma fora', { status: 500 })
          : new Response(
              JSON.stringify({ content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' }),
              { status: 200 }
            )
      )
    );
    const { chat } = await import('../api/_lib/llm');

    expect(await chat({ model: 'anthropic/claude-sonnet-5', user: 'oi', timeoutMs: 50 })).toBe('ok');
    await vi.waitFor(() => expect(alertFounders).toHaveBeenCalledTimes(1));
    expect(alertFounders.mock.calls[0][0]).toMatch(/API DIRETA/);
  });

  it('chamada NORMAL não alerta — resgate silencioso seria só barulho', async () => {
    process.env.OPENROUTER_FALLBACK_API_KEY = 'reserva';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 })
      )
    );
    const { chat } = await import('../api/_lib/llm');

    expect(await chat({ model: 'x', user: 'oi', timeoutMs: 50 })).toBe('ok');
    expect(alertFounders).not.toHaveBeenCalled();
  });
});
