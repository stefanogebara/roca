/**
 * Retenção (LGPD): a coluna de data de cada alvo existe, e falha não vira zero.
 *
 * O purge de `farmer_alerts` falhava em TODA execução desde que existe —
 * `purgeExpiredRows` cravava `created_at` e essa tabela carimba `sent_at`. O
 * erro ia pro log e o retorno era `{}`, indistinguível de "não tinha nada pra
 * apagar". Ou seja: 90 dias de retenção prometidos e nunca aplicados, sem
 * ninguém poder notar. Descoberto só porque um disparo manual do cron colocou o
 * log na tela.
 *
 * Os dois testes cobrem as duas metades do defeito: a coluna errada (conferida
 * contra as migrations, sem precisar de banco) e o silêncio (a falha tem que
 * chegar em `failed`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Erro por tabela, controlado pelo teste. Imita o Postgres: coluna que não
// existe volta como error, não como exceção.
let erraNaTabela: string | null = null;
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => ({
      delete: () => ({
        lt: (coluna: string) =>
          Promise.resolve(
            table === erraNaTabela
              ? { count: null, error: { message: `column ${table}.${coluna} does not exist` } }
              : { count: 2, error: null }
          ),
      }),
    }),
  }),
}));

import { PURGE_TARGETS, purgeExpiredRows } from '../api/_lib/db';

const MIGRATIONS = readdirSync('supabase/migrations')
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(join('supabase/migrations', f), 'utf8'))
  .join('\n');

/** A coluna aparece no CREATE TABLE do alvo, ou num ALTER ... ADD COLUMN. */
function schemaTemColuna(tabela: string, coluna: string): boolean {
  const criacao = new RegExp(`create table[^(]*\\b${tabela}\\s*\\(([\\s\\S]*?)\\n\\);`, 'i');
  const bloco = criacao.exec(MIGRATIONS)?.[1];
  if (bloco && new RegExp(`^\\s*${coluna}\\s`, 'im').test(bloco)) return true;
  const alterado = new RegExp(
    `alter table[^;]*\\b${tabela}\\b[^;]*add column\\s+(if not exists\\s+)?${coluna}\\b`,
    'i'
  );
  return alterado.test(MIGRATIONS);
}

describe('a coluna de data de cada alvo existe no schema', () => {
  it.each(PURGE_TARGETS.map((t) => [t.table, t.column ?? 'created_at'] as const))(
    '%s usa %s',
    (tabela, coluna) => {
      expect(schemaTemColuna(tabela, coluna)).toBe(true);
    }
  );

  it('o harness detecta coluna inexistente — senão o teste acima é decorativo', () => {
    expect(schemaTemColuna('farmer_alerts', 'created_at')).toBe(false);
    expect(schemaTemColuna('farmer_alerts', 'sent_at')).toBe(true);
  });
});

describe('purgeExpiredRows não deixa falha virar zero', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave-de-teste';
    erraNaTabela = null;
  });

  it('caminho feliz: tudo apagado, nada em failed', async () => {
    const res = await purgeExpiredRows();
    expect(res.failed).toEqual([]);
    expect(Object.keys(res.purged).sort()).toEqual(PURGE_TARGETS.map((t) => t.table).sort());
  });

  it('tabela que erra é REPORTADA, não engolida', async () => {
    erraNaTabela = 'farmer_alerts';
    const res = await purgeExpiredRows();

    expect(res.failed).toHaveLength(1);
    expect(res.failed[0].table).toBe('farmer_alerts');
    expect(res.failed[0].reason).toContain('does not exist');
    // E o mais importante: ela NÃO aparece como sucesso silencioso.
    expect(res.purged).not.toHaveProperty('farmer_alerts');
  });

  it('uma tabela quebrada não impede a limpeza das outras', async () => {
    erraNaTabela = 'farmer_alerts';
    const res = await purgeExpiredRows();
    expect(Object.keys(res.purged)).toHaveLength(PURGE_TARGETS.length - 1);
  });
});
