/**
 * Dedup do importProspects para linha SEM telefone.
 *
 * O caso real (06/ago): AGRO COFFEE ×4, Fazenda Terra Nova ×4 na base — todas
 * sem número utilizável. O dedup era só por phone, e linha sem phone entrava
 * SEMPRE ("keep for review"): cada rodada de sourcing que reencontrava o mesmo
 * negócio phoneless inseria de novo. Review vale UMA vez; a partir da segunda
 * é ruído que infla fila e métrica.
 *
 * A régua nova: sem phone, o par (name, city) — case-insensitive — é a
 * identidade. Já existe na base ou no próprio lote → pula.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

type Row = Record<string, unknown>;
const state: {
  existingPhones: Array<{ phone: string | null }>;
  existingNames: Array<{ name: string; city: string | null }>;
  inserted: Row[][];
} = { existingPhones: [], existingNames: [], inserted: [] };

vi.mock('../api/_lib/db', () => ({
  getDb: () => ({
    from: () => ({
      select: (cols: string) => ({
        in: async () =>
          cols.includes('phone')
            ? { data: state.existingPhones, error: null }
            : { data: state.existingNames, error: null },
      }),
      insert: (rows: Row[]) => {
        state.inserted.push(rows);
        return { select: async () => ({ data: rows.map((_, i) => ({ id: `id-${i}` })), error: null }) };
      },
    }),
  }),
}));

import { importProspects } from '../api/_lib/prospect/db';

const semFone = (name: string, city = 'Campos Gerais') =>
  ({ name, kind: 'consultoria', city, uf: 'MG', phone: null, source: 'places' }) as never;

beforeEach(() => {
  state.existingPhones = [];
  state.existingNames = [];
  state.inserted = [];
});

describe('importProspects — linha sem telefone', () => {
  it('pula quando (name, city) já existe na base — o caso AGRO COFFEE ×4', async () => {
    state.existingNames = [{ name: 'AGRO COFFEE', city: 'Campos Gerais' }];
    const n = await importProspects([semFone('AGRO COFFEE')]);
    expect(n).toBe(0);
    expect(state.inserted).toEqual([]);
  });

  it('pula a duplicata dentro do MESMO lote', async () => {
    const n = await importProspects([semFone('Fazenda Terra Nova'), semFone('Fazenda Terra Nova')]);
    expect(n).toBe(1);
  });

  it('a comparação é case-insensitive — Places não é consistente com caixa', async () => {
    state.existingNames = [{ name: 'Agro Coffee', city: 'campos gerais' }];
    const n = await importProspects([semFone('AGRO COFFEE')]);
    expect(n).toBe(0);
  });

  it('nome novo sem phone continua entrando — review vale UMA vez', async () => {
    const n = await importProspects([semFone('Consultoria Inédita')]);
    expect(n).toBe(1);
  });

  it('mesmo nome em CIDADE diferente não é duplicata (filial legítima)', async () => {
    state.existingNames = [{ name: 'Rede do Campo', city: 'Alfenas' }];
    const n = await importProspects([semFone('Rede do Campo', 'Muzambinho')]);
    expect(n).toBe(1);
  });
});
