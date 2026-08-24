/**
 * Alerta proativo só vai para produtor (achado do /intel de 24/ago).
 *
 * `farmer_alerts` está em zero na vida do produto. A primeira linha que entrar
 * ali é o primeiro número não-zero da métrica que o scorecard mede em 11/set —
 * e o cron das 11h entra na janela do vazio sanitário de MT em 30/ago, quatro
 * dias antes do fim do voo.
 *
 * Até aqui `listSojaFarmersByUf` e `listFarmsWithCoords` não filtravam
 * `users.kind`, então uma fazenda de teste ou de empresa entraria como envio.
 * Seria a mesma classe de erro das "5 referrals" de 25/jul (teste dos próprios
 * founders) e dos "8 novos usuários" de 03/ago (bots de atendimento de revenda):
 * número agregado que parece tração e não é.
 *
 * O filtro é POSITIVO (`kind = 'produtor'`), não `neq`: qualquer `kind` novo sai
 * por padrão. Falha fechado.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const PRODUTOR = 'u-produtor';
const EMPRESA = 'u-empresa';
const TESTE = 'u-teste';

/** Linhas por tabela, servidas ao mock do PostgREST. */
const dados: Record<string, unknown[]> = {};

/** Resolve 'users.kind' contra a linha embutida; 'state' contra a própria linha. */
function leia(r: Record<string, unknown>, caminho: string): unknown {
  if (!caminho.includes('.')) return r[caminho];
  const [tabela, coluna] = caminho.split('.');
  const emb = r[tabela] as Record<string, unknown> | null | undefined;
  return emb ? emb[coluna] : undefined;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from(tabela: string) {
      const filtros: Array<(r: Record<string, unknown>) => boolean> = [];
      const resolver = () => {
        const linhas = (dados[tabela] ?? []).filter((r) =>
          filtros.every((f) => f(r as Record<string, unknown>))
        );
        return { data: linhas, count: linhas.length, error: null };
      };
      const encadeia: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (res: (v: unknown) => void) => res(resolver());
            return (...args: unknown[]) => {
              const [a, b] = args as [string, unknown];
              if (prop === 'eq') filtros.push((r) => leia(r, a) === b);
              if (prop === 'neq') filtros.push((r) => leia(r, a) !== b);
              if (prop === 'contains')
                filtros.push((r) => {
                  const v = leia(r, a);
                  return Array.isArray(v) && (b as unknown[]).every((x) => v.includes(x));
                });
              if (prop === 'not') filtros.push((r) => leia(r, a) != null);
              return encadeia;
            };
          },
        }
      );
      return encadeia;
    },
  }),
}));

import { listSojaFarmersByUf, listFarmsWithCoords } from '../api/_lib/db';

/** Uma fazenda por kind, todas elegíveis por UF, cultura e pin. */
function semeia() {
  dados.farms = [
    {
      user_id: PRODUTOR,
      crop: ['soja'],
      lat: -15.6,
      lon: -56.1,
      users: { id: PRODUTOR, wa_id: '5565900000001', state: 'MT', channel: 'cloud', kind: 'produtor' },
    },
    {
      user_id: EMPRESA,
      crop: ['soja'],
      lat: -15.7,
      lon: -56.2,
      users: { id: EMPRESA, wa_id: '5565900000002', state: 'MT', channel: 'cloud', kind: 'empresa' },
    },
    {
      user_id: TESTE,
      crop: ['soja'],
      lat: -15.8,
      lon: -56.3,
      users: { id: TESTE, wa_id: '5565900000003', state: 'MT', channel: 'cloud', kind: 'teste' },
    },
  ];
}

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave';
  for (const k of Object.keys(dados)) delete dados[k];
  semeia();
});

describe('listSojaFarmersByUf — alvo do vazio sanitário', () => {
  it('devolve o produtor e mais ninguém', async () => {
    const alvos = await listSojaFarmersByUf('MT');
    expect(alvos.map((a) => a.userId)).toEqual([PRODUTOR]);
  });

  it('não devolve empresa', async () => {
    const alvos = await listSojaFarmersByUf('MT');
    expect(alvos.map((a) => a.userId)).not.toContain(EMPRESA);
  });

  it('não devolve fixture de teste — o Simulador Roca não vira farmer_alerts', async () => {
    const alvos = await listSojaFarmersByUf('MT');
    expect(alvos.map((a) => a.userId)).not.toContain(TESTE);
  });

  it('falha fechado: kind novo que ninguém previu não recebe alerta', async () => {
    (dados.farms as Record<string, unknown>[]).push({
      user_id: 'u-futuro',
      crop: ['soja'],
      lat: -15.9,
      lon: -56.4,
      users: { id: 'u-futuro', wa_id: '5565900000004', state: 'MT', channel: 'cloud', kind: 'cooperativa' },
    });
    const alvos = await listSojaFarmersByUf('MT');
    expect(alvos.map((a) => a.userId)).toEqual([PRODUTOR]);
  });

  it('sem produtor na UF, devolve vazio em vez de cair no de teste', async () => {
    dados.farms = (dados.farms as Record<string, unknown>[]).filter(
      (f) => (f.users as Record<string, unknown>).kind !== 'produtor'
    );
    expect(await listSojaFarmersByUf('MT')).toEqual([]);
  });
});

describe('listFarmsWithCoords — alvo de geada e queimada', () => {
  it('devolve o produtor e mais ninguém', async () => {
    const pins = await listFarmsWithCoords();
    expect(pins.map((p) => p.userId)).toEqual([PRODUTOR]);
  });

  it('não devolve empresa nem fixture de teste', async () => {
    const pins = await listFarmsWithCoords();
    const ids = pins.map((p) => p.userId);
    expect(ids).not.toContain(EMPRESA);
    expect(ids).not.toContain(TESTE);
  });

  it('preserva lat/lon do produtor — o filtro não pode quebrar o pin', async () => {
    const [pin] = await listFarmsWithCoords();
    expect(pin.lat).toBe(-15.6);
    expect(pin.lon).toBe(-56.1);
  });
});
