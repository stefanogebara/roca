/**
 * Daily canary — the pure halves: transition detection (alert on NEWLY broken
 * or recovered, stay silent on steady state, in both directions) and the
 * fallback-rate verdict. The anti-noise property is the whole point: a check
 * that's been red for a week must not page the founders every morning.
 */
import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { CloudApiAdapter, parseCloudStatuses } from '../api/_lib/transport/cloud';
import {
  diffCanary,
  formatCanaryAlert,
  fallbackVerdict,
  agrofitFreshnessCheck,
  canaryProbeBody,
  type CanaryCheck,
} from '../api/_lib/canary';
import { AGROFIT_GENERATED_AT, AGROFIT_MAX_AGE_DAYS } from '../api/_lib/tools/agrofit';

const check = (name: string, ok: boolean, detail: string | null = null): CanaryCheck => ({
  check: name,
  ok,
  detail,
});

describe('diffCanary', () => {
  it('first run: failures alert (they are real), successes stay quiet', () => {
    const d = diffCanary(null, [check('a', true), check('b', false, 'timeout')]);
    expect(d.broke.map((c) => c.check)).toEqual(['b']);
    expect(d.recovered).toEqual([]);
  });

  it('transition ok→fail is "broke"; fail→ok is "recovered"', () => {
    const prev = [check('a', true), check('b', false)];
    const curr = [check('a', false, '500'), check('b', true)];
    const d = diffCanary(prev, curr);
    expect(d.broke.map((c) => c.check)).toEqual(['a']);
    expect(d.recovered.map((c) => c.check)).toEqual(['b']);
  });

  it('steady state — still broken or still fine — never re-alerts', () => {
    const prev = [check('a', true), check('b', false)];
    const curr = [check('a', true), check('b', false)];
    const d = diffCanary(prev, curr);
    expect(d.broke).toEqual([]);
    expect(d.recovered).toEqual([]);
  });

  it('a check that first appears already failing alerts (new information)', () => {
    const d = diffCanary([check('a', true)], [check('a', true), check('novo', false)]);
    expect(d.broke.map((c) => c.check)).toEqual(['novo']);
  });
});

describe('formatCanaryAlert', () => {
  it('is null when nothing changed', () => {
    expect(formatCanaryAlert({ broke: [], recovered: [] })).toBeNull();
  });

  it('names what broke, with detail', () => {
    const msg = formatCanaryAlert({
      broke: [check('template stevi_parceria_v1', false, 'PAUSED')],
      recovered: [],
    });
    expect(msg).toContain('stevi_parceria_v1');
    expect(msg).toContain('PAUSED');
  });

  it('reports recoveries even without new breakage', () => {
    const msg = formatCanaryAlert({ broke: [], recovered: [check('yahoo-prices', true)] });
    expect(msg).toContain('yahoo-prices');
    expect(msg).toMatch(/voltou/i);
  });
});

describe('fallbackVerdict', () => {
  it('quiet day (no outbound) is fine', () => {
    expect(fallbackVerdict(0, 0).ok).toBe(true);
  });
  it('a couple of fallbacks are noise, not an outage', () => {
    expect(fallbackVerdict(2, 4).ok).toBe(true);
  });
  it('3+ fallbacks above 20% of replies is an outage signal', () => {
    expect(fallbackVerdict(3, 10).ok).toBe(false);
    expect(fallbackVerdict(3, 10).detail).toContain('3');
  });
  it('3 fallbacks out of hundreds is not', () => {
    expect(fallbackVerdict(3, 100).ok).toBe(true);
  });
});

describe('agrofitFreshnessCheck (snapshot staleness is detectable now)', () => {
  const gen = new Date(`${AGROFIT_GENERATED_AT}T00:00:00Z`);
  const plusDays = (d: number) => new Date(gen.getTime() + d * 86_400_000);

  it('is ok while the snapshot is within the max age', () => {
    const c = agrofitFreshnessCheck(plusDays(AGROFIT_MAX_AGE_DAYS - 1));
    expect(c.check).toBe('agrofit snapshot');
    expect(c.ok).toBe(true);
  });

  it('fails once it is past the max age, and names the rebuild command', () => {
    const c = agrofitFreshnessCheck(plusDays(AGROFIT_MAX_AGE_DAYS + 30));
    expect(c.ok).toBe(false);
    expect(c.detail).toMatch(/agrofit-extract/);
  });
});

/**
 * A sonda assinada do webhook, checada contra o adapter DE VERDADE.
 *
 * O `probe('webhook')` é GET, e o handler responde GET no topo — prova só que o
 * módulo carregou. Esta sonda exercita o que importa (seleção de adapter +
 * verificação de assinatura), e a propriedade que ela PRECISA ter é não causar
 * trabalho nenhum: um canário que grava no banco ou gasta LLM todo dia deixa de
 * ser barato e vira ruído no próprio dado que ele deveria medir.
 */
describe('sonda assinada do webhook não causa trabalho', () => {
  const SEGREDO = 'segredo-de-app-de-teste';
  const req = () => {
    const body = canaryProbeBody();
    const assinatura = `sha256=${createHmac('sha256', SEGREDO).update(body).digest('hex')}`;
    return {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': assinatura, host: 'roca-black.vercel.app' },
      url: '/api/webhook',
      rawBody: Buffer.from(body),
    };
  };

  it('o adapter real aceita a assinatura', async () => {
    const antes = process.env.WHATSAPP_APP_SECRET;
    process.env.WHATSAPP_APP_SECRET = SEGREDO;
    try {
      expect(await new CloudApiAdapter().verifySignature(req())).toBe(true);
    } finally {
      if (antes === undefined) delete process.env.WHATSAPP_APP_SECRET;
      else process.env.WHATSAPP_APP_SECRET = antes;
    }
  });

  it('não carrega mensagem — parseInbound devolve null, o pipeline nunca roda', async () => {
    expect(await new CloudApiAdapter().parseInbound(req())).toBeNull();
  });

  it('não carrega status — nada é gravado no termômetro do número', () => {
    expect(parseCloudStatuses(Buffer.from(canaryProbeBody()))).toEqual([]);
  });
});
