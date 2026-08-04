/**
 * `supabase/migrations/` tem que descrever o banco inteiro.
 *
 * Em 04/ago quatro migrations estavam aplicadas em produção sem arquivo no
 * repo, aplicadas direto pelo MCP. Duas consequências, e a segunda é a pior:
 *
 * 1. Um banco novo não sobe. `20260727194854_prospect_wa_phone.sql` faz RENAME
 *    de `mobile_phone`, e a migration que criava essa coluna não existia no
 *    repo — a cadeia quebra na hora.
 *
 * 2. Trava cega. O `tests/retencao.test.ts` confere os alvos do purge contra as
 *    migrations, e o de FK confere o CASCADE contra as migrations. Se o repo
 *    descreve um banco MENOR que o real, essas travas passam sem olhar
 *    justamente as tabelas que ninguém registrou — dão segurança sem dar
 *    verificação. Trava cega é pior que trava nenhuma, porque cala o alarme.
 *
 * Este teste é a régua da regra: toda tabela e toda coluna que o CÓDIGO usa
 * precisa estar descrita em alguma migration. Ele não fala com o banco (CI não
 * tem credencial); a lista de referência é extraída do próprio código, que é o
 * que de fato depende do schema.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(__dirname, '..', 'supabase', 'migrations');
const arquivos = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const sql = arquivos.map((f) => readFileSync(join(dir, f), 'utf8')).join('\n').toLowerCase();

/** Toda tabela citada em `.from('x')` no código de produção. */
function tabelasUsadasPeloCodigo(): Set<string> {
  const raiz = join(__dirname, '..', 'api');
  const achadas = new Set<string>();
  const ande = (p: string): void => {
    for (const e of readdirSync(p, { withFileTypes: true })) {
      const full = join(p, e.name);
      if (e.isDirectory()) ande(full);
      else if (e.name.endsWith('.ts')) {
        for (const m of readFileSync(full, 'utf8').matchAll(/\.from\(\s*'([a-z_]+)'\s*\)/g)) {
          achadas.add(m[1]);
        }
      }
    }
  };
  ande(raiz);
  return achadas;
}

describe('as migrations descrevem o banco que o código usa', () => {
  it('o varredor acha tabelas — senão este arquivo é teatro', () => {
    const t = tabelasUsadasPeloCodigo();
    expect(t.size).toBeGreaterThan(15);
    expect(t.has('prospects')).toBe(true);
  });

  it('toda tabela usada tem CREATE TABLE em alguma migration', () => {
    const semMigration = [...tabelasUsadasPeloCodigo()].filter(
      (t) => !new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(?:public\\.)?${t}\\s*\\(`).test(sql)
    );
    expect(semMigration, `tabelas sem migration: ${semMigration.join(', ')}`).toEqual([]);
  });

  it('nenhum RENAME/ALTER cai sobre coluna que nunca foi criada', () => {
    // O defeito concreto de 27/jul: rename de `mobile_phone` sem o create.
    for (const m of sql.matchAll(/rename\s+column\s+([a-z_]+)\s+to\s+([a-z_]+)/g)) {
      const antiga = m[1];
      const criada =
        new RegExp(`add\\s+column\\s+(?:if\\s+not\\s+exists\\s+)?${antiga}\\b`).test(sql) ||
        new RegExp(`^\\s*${antiga}\\s+\\S`, 'm').test(sql);
      expect(criada, `rename de coluna nunca criada: ${antiga}`).toBe(true);
    }
  });

  it('o create de uma coluna vem ANTES do rename dela', () => {
    // Ordem por nome de arquivo é a ordem de aplicação. Um create que chega
    // depois do rename passa na checagem acima e quebra o banco novo do mesmo
    // jeito — foi por isso que os arquivos de 27/jul foram renumerados para os
    // timestamps reais do banco.
    for (const m of sql.matchAll(/rename\s+column\s+([a-z_]+)\s+to\s+/g)) {
      const antiga = m[1];
      const posCreate = sql.search(new RegExp(`add\\s+column\\s+(?:if\\s+not\\s+exists\\s+)?${antiga}\\b`));
      expect(posCreate, `create de ${antiga} não encontrado`).toBeGreaterThan(-1);
      expect(posCreate, `create de ${antiga} vem depois do rename`).toBeLessThan(m.index!);
    }
  });
});
