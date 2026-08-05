/**
 * Empresa não conta como tração (decisão do Stefano, 05/ago).
 *
 * Medido no banco no dia: 15 empresas contra 10 produtores, e 1719 das 1888
 * mensagens — 91% do volume. WAU, "voltaram" e retenção D7 vinham contando
 * revenda, consultoria e software de agro como se fossem lavoura. A Corpal
 * Tratores sozinha responde por 1672 dessas mensagens (o loop de 03/ago).
 *
 * Duas origens, e a segunda sobrevive ao conserto de hoje:
 *   1. o bug do nono dígito mandava a resposta do prospect pro fluxo de produtor;
 *   2. mesmo roteando certo, TODO prospect que responde ganha linha em `users`,
 *      porque o usuário é resolvido antes do ramo de prospect.
 * Por isso o filtro é permanente, não faxina de uma vez.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const EMPRESA = 'u-empresa';
const PRODUTOR = 'u-produtor';

/** Linhas por tabela, servidas ao mock do PostgREST. */
const dados: Record<string, unknown[]> = {};

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from(tabela: string) {
      const q: Record<string, unknown> = {};
      const filtros: Array<(r: Record<string, unknown>) => boolean> = [];
      const resolver = () => {
        const linhas = (dados[tabela] ?? []).filter((r) =>
          filtros.every((f) => f(r as Record<string, unknown>))
        );
        return { data: linhas, count: linhas.length, error: null };
      };
      const encadeia = new Proxy(q, {
        get(_t, prop) {
          if (prop === 'then') return (res: (v: unknown) => void) => res(resolver());
          return (...args: unknown[]) => {
            if (prop === 'eq') filtros.push((r) => r[args[0] as string] === args[1]);
            if (prop === 'neq') filtros.push((r) => r[args[0] as string] !== args[1]);
            return encadeia;
          };
        },
      });
      return encadeia;
    },
  }),
}));

import { computeDigestStats } from '../api/_lib/digest';

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave';
  for (const k of Object.keys(dados)) delete dados[k];
  dados.users = [
    { id: PRODUTOR, kind: 'produtor', created_at: '2026-08-01T00:00:00Z', source: null },
    { id: EMPRESA, kind: 'empresa', created_at: '2026-08-01T00:00:00Z', source: null },
  ];
  dados.referral_requests = [];
});

const msg = (user_id: string, direction: string) => ({
  user_id,
  direction,
  kind: 'text',
  intent: direction === 'out' ? 'smalltalk' : null,
  raw: 'oi',
  created_at: '2026-08-05T12:00:00Z',
});

describe('computeDigestStats ignora empresas', () => {
  it('mensagem de empresa não entra no volume nem nos usuários únicos', async () => {
    dados.messages = [msg(PRODUTOR, 'in'), msg(EMPRESA, 'in'), msg(EMPRESA, 'in')];

    const s = await computeDigestStats('2026-08-05T00:00:00Z', '2026-08-06T00:00:00Z');

    expect(s.inboundTotal).toBe(1);
    expect(s.uniqueUsers).toBe(1);
  });

  it('um dia SÓ de empresa aparece como dia parado, e é a verdade', async () => {
    // Foi exatamente o 03/ago: 835 mensagens de saída num loop com robô, e a
    // leitura de tração do dia saiu inflada.
    dados.messages = [msg(EMPRESA, 'in'), msg(EMPRESA, 'out'), msg(EMPRESA, 'in')];

    const s = await computeDigestStats('2026-08-05T00:00:00Z', '2026-08-06T00:00:00Z');

    expect(s.inboundTotal).toBe(0);
    expect(s.uniqueUsers).toBe(0);
    expect(Object.keys(s.byIntent)).toHaveLength(0);
  });

  it('mensagem sem dono ainda conta — não sumir com tráfego real por detalhe de escrita', async () => {
    dados.messages = [{ ...msg(PRODUTOR, 'in'), user_id: null }];
    const s = await computeDigestStats('2026-08-05T00:00:00Z', '2026-08-06T00:00:00Z');
    expect(s.inboundTotal).toBe(1);
  });
});
