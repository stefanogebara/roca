/**
 * A retenção LGPD entrando no canário — o canal, ponta a ponta.
 *
 * A lição de 03/ago (o alarme mudo) foi: canal sem teste ponta a ponta é
 * suposição. `purgeReport` produzir um check vermelho não serve de nada se o
 * check não chegar a `runCanary` — e o único jeito de saber é rodando o
 * caminho inteiro até `alertFounders`.
 *
 * A máquina do canário é justamente o que a retenção precisa: um purge que
 * quebrou vai quebrar TODO dia até alguém arrumar. Alertar todo dia seria o
 * mesmo ruído que fez o log virar paisagem. Aqui: avisa no dia em que quebra,
 * cala enquanto continua quebrado, avisa de novo quando volta — e o estado
 * parado fica gravado em canary_runs de qualquer jeito.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const alertas: string[] = [];
vi.mock('../api/_lib/alert', () => ({
  alertFounders: vi.fn(async (text: string) => {
    alertas.push(text);
  }),
}));
vi.mock('../api/_lib/llm', () => ({ chat: vi.fn(async () => 'ok') }));

/** Resultados do run anterior lidos de canary_runs (null = primeiro run). */
let anterior: unknown[] | null = null;
/** Linhas inseridas em canary_runs neste teste. */
const gravados: Array<{ results: Array<{ check: string; ok: boolean }> }> = [];

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from(table: string) {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        gte: () => builder,
        ilike: () => builder,
        order: () => builder,
        limit: () => builder,
        maybeSingle: async () => ({
          data: table === 'canary_runs' ? { results: anterior } : null,
          error: null,
        }),
        insert: async (row: { results: Array<{ check: string; ok: boolean }> }) => {
          if (table === 'canary_runs') gravados.push(row);
          return { error: null };
        },
        // As contagens de fallback são awaited direto no builder.
        then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
          Promise.resolve({ count: 0, error: null }).then(res, rej),
      };
      return builder;
    },
  }),
}));

import { runCanary, type CanaryCheck } from '../api/_lib/canary';
import { purgeReport } from '../api/_lib/db';

const RETENCAO_QUEBRADA: CanaryCheck = purgeReport({
  purged: {},
  failed: [{ table: 'farmer_alerts', error: 'column farmer_alerts.created_at does not exist' }],
}).check;
const RETENCAO_OK: CanaryCheck = purgeReport({ purged: { farmer_alerts: 0 }, failed: [] }).check;

const envSalvo = { ...process.env };

beforeEach(() => {
  alertas.length = 0;
  gravados.length = 0;
  anterior = null;
  process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  // Sem estas, os checks de template/número/modelo/webhook-assinado se omitem
  // sozinhos — sobram as sondas HTTP, que o fetch abaixo atende.
  for (const k of [
    'WHATSAPP_CLOUD_TOKEN',
    'WHATSAPP_CLOUD_PHONE_NUMBER_ID',
    'WHATSAPP_APP_SECRET',
    'OPENROUTER_API_KEY',
  ]) {
    delete process.env[k];
  }
  vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200, json: async () => ({}) })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...envSalvo };
});

describe('runCanary carrega os checks que o chamador já calculou', () => {
  it('a retenção quebrada CHEGA no alerta aos founders — o canal, de ponta a ponta', async () => {
    const run = await runCanary([RETENCAO_QUEBRADA]);
    expect(run.broke.map((c) => c.check)).toContain('retenção LGPD');
    expect(alertas.join('\n')).toContain('retenção LGPD');
    expect(alertas.join('\n')).toContain('farmer_alerts');
  });

  it('e fica gravada em canary_runs — o estado parado sobrevive ao alerta', async () => {
    await runCanary([RETENCAO_QUEBRADA]);
    expect(gravados[0].results.find((c) => c.check === 'retenção LGPD')).toMatchObject({ ok: false });
  });

  it('no segundo dia quebrada não repete o alerta (é isto que mata o log)', async () => {
    anterior = [RETENCAO_QUEBRADA];
    const run = await runCanary([RETENCAO_QUEBRADA]);
    expect(run.broke.map((c) => c.check)).not.toContain('retenção LGPD');
    expect(alertas.join('\n')).not.toContain('retenção');
  });

  it('quando arruma, avisa que voltou', async () => {
    anterior = [RETENCAO_QUEBRADA];
    const run = await runCanary([RETENCAO_OK]);
    expect(run.recovered.map((c) => c.check)).toContain('retenção LGPD');
    expect(alertas.join('\n')).toContain('retenção LGPD');
  });

  it('purge saudável não inventa alarme nem some do registro', async () => {
    anterior = [RETENCAO_OK];
    const run = await runCanary([RETENCAO_OK]);
    expect(run.broke.map((c) => c.check)).not.toContain('retenção LGPD');
    expect(gravados[0].results.find((c) => c.check === 'retenção LGPD')).toMatchObject({ ok: true });
  });

  it('sem extras o canário roda igual — o parâmetro é opcional de verdade', async () => {
    const run = await runCanary();
    expect(run.results.some((c) => c.check === 'retenção LGPD')).toBe(false);
    expect(run.results.length).toBeGreaterThan(0);
  });
});
