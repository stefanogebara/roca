/**
 * Retenção LGPD (purgeExpiredRows) — a promessa que nunca foi cumprida.
 *
 * `farmer_alerts` carimba `sent_at`; o purge comparava `created_at` nas SETE
 * tabelas. Todo run diário do monitor logava
 *
 *     [db] ERROR purge farmer_alerts failed: column farmer_alerts.created_at does not exist
 *
 * e seguia em frente. O retorno era `Record<tabela, count>` só com counts > 0,
 * então "falhou" e "não tinha nada pra apagar" eram o MESMO valor: ausência.
 * 90 dias prometidos, zero dia aplicado, e nada fora do log sabia disso.
 *
 * Três defeitos, três travas:
 *  1. a coluna é por alvo — e a checagem contra o SCHEMA, não contra o código,
 *     porque o defeito foi exatamente um nome de coluna que ninguém conferiu;
 *  2. falha vira DADO (`failed`), e tabela que rodou aparece em `purged` mesmo
 *     com zero — presença passa a significar "aplicado";
 *  3. `purgeReport` transforma isso em finding + check do canário, que é quem
 *     tem a máquina de transição pra avisar sem virar barulho diário.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Deletes observadas: uma por chamada de db.from(...).delete().lt(col, cutoff). */
interface DeleteCall {
  table: string;
  coluna: string;
  cutoff: string;
}
const calls: DeleteCall[] = [];
/** Erro a devolver por tabela (simula o Postgres reclamando da coluna). */
let erros: Record<string, string> = {};
/** Linhas apagadas por tabela; ausente = 0. */
let counts: Record<string, number> = {};

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from(table: string) {
      return {
        delete() {
          return {
            lt(coluna: string, cutoff: string) {
              calls.push({ table, coluna, cutoff });
              const error = erros[table];
              return Promise.resolve(
                error ? { count: null, error: { message: error } } : { count: counts[table] ?? 0, error: null }
              );
            },
          };
        },
      };
    },
  }),
}));

import { purgeExpiredRows, purgeReport, PURGE_TARGETS, type PurgeResult } from '../api/_lib/db';

beforeEach(() => {
  calls.length = 0;
  erros = {};
  counts = {};
  process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
});

describe('purgeExpiredRows — a coluna de data é por alvo', () => {
  it('poda farmer_alerts por sent_at, e o resto por created_at', async () => {
    await purgeExpiredRows();
    const porTabela = new Map(calls.map((c) => [c.table, c.coluna]));
    expect(porTabela.get('farmer_alerts')).toBe('sent_at'); // o bug
    for (const t of ['messages', 'ops_login_attempts', 'monitor_runs', 'prospect_messages', 'gym_runs', 'prospect_gym_runs']) {
      expect(porTabela.get(t), t).toBe('created_at');
    }
  });

  it('aplica o prazo de cada alvo no cutoff', async () => {
    const antes = Date.now();
    await purgeExpiredRows();
    const depois = Date.now();
    for (const t of PURGE_TARGETS) {
      const call = calls.find((c) => c.table === t.table);
      // O cutoff é `Date.now() - dias` calculado DENTRO do loop, então a idade
      // medida contra `antes` cabe na janela [prazo - duração do run, prazo].
      const idade = depois - Date.parse(call!.cutoff);
      expect(idade, t.table).toBeGreaterThanOrEqual(t.days * 86_400_000);
      expect(idade, t.table).toBeLessThanOrEqual(t.days * 86_400_000 + (depois - antes));
    }
  });

  it('visita todo alvo declarado', async () => {
    await purgeExpiredRows();
    expect(calls.map((c) => c.table)).toEqual(PURGE_TARGETS.map((t) => t.table));
  });
});

describe('purgeExpiredRows — falha ≠ tabela vazia', () => {
  it('tabela que rodou e não achou nada aparece com zero', async () => {
    const r = await purgeExpiredRows();
    expect(r.purged['farmer_alerts']).toBe(0); // presente = a promessa foi aplicada
    expect(r.failed).toEqual([]);
  });

  it('tabela que erra sai em failed, NÃO em purged — era isto que sumia', async () => {
    erros['farmer_alerts'] = 'column farmer_alerts.created_at does not exist';
    const r = await purgeExpiredRows();
    expect(r.purged).not.toHaveProperty('farmer_alerts');
    expect(r.failed).toEqual([
      { table: 'farmer_alerts', error: 'column farmer_alerts.created_at does not exist' },
    ]);
  });

  it('um alvo quebrado não impede os outros de podar', async () => {
    erros['farmer_alerts'] = 'boom';
    counts['messages'] = 12;
    const r = await purgeExpiredRows();
    expect(r.purged['messages']).toBe(12);
    expect(Object.keys(r.purged)).toHaveLength(PURGE_TARGETS.length - 1);
    expect(calls).toHaveLength(PURGE_TARGETS.length); // o loop continuou
  });
});

describe('purgeReport — a falha tem que SAIR do log', () => {
  const ok: PurgeResult = { purged: { messages: 3, farmer_alerts: 0 }, failed: [] };

  it('run limpo: conta o que removeu e o check fica verde', () => {
    const r = purgeReport(ok);
    expect(r.findings).toEqual(['Retenção: 3 registro(s) antigos removidos.']);
    expect(r.check).toMatchObject({ check: 'retenção LGPD', ok: true });
  });

  it('run limpo sem nada a podar não inventa finding — e continua verde', () => {
    const r = purgeReport({ purged: { messages: 0 }, failed: [] });
    expect(r.findings).toEqual([]);
    expect(r.check.ok).toBe(true);
  });

  it('falha vira finding NOMEANDO a tabela e o erro, e derruba o check', () => {
    const r = purgeReport({
      purged: { messages: 3 },
      failed: [{ table: 'farmer_alerts', error: 'column farmer_alerts.created_at does not exist' }],
    });
    const alarme = r.findings.find((f) => f.includes('NÃO aplicada'));
    expect(alarme).toBeDefined();
    expect(alarme).toContain('farmer_alerts');
    expect(alarme).toContain('does not exist');
    expect(r.check.ok).toBe(false);
    expect(r.check.detail).toContain('farmer_alerts');
  });

  it('o que apagou e o que falhou convivem no mesmo run', () => {
    const r = purgeReport({
      purged: { messages: 3 },
      failed: [{ table: 'farmer_alerts', error: 'boom' }],
    });
    expect(r.findings).toHaveLength(2); // removidos + NÃO aplicada
  });

  it('DISCRIMINA: zero apagado e falha não produzem o mesmo relatório', () => {
    const vazio = purgeReport({ purged: { farmer_alerts: 0 }, failed: [] });
    const quebrado = purgeReport({ purged: {}, failed: [{ table: 'farmer_alerts', error: 'boom' }] });
    expect(vazio.check.ok).not.toBe(quebrado.check.ok);
    expect(vazio.findings).not.toEqual(quebrado.findings);
  });
});

/**
 * Trava de SCHEMA, não de comportamento. O defeito não foi lógica — foi um nome
 * de coluna que só o banco podia desmentir, e nenhum teste de comportamento
 * pegaria (o mock obedece qualquer coluna que eu escrever). Aqui as migrations
 * são a fonte da verdade: todo alvo do purge tem que apontar pra uma coluna que
 * existe de fato. Serve principalmente pro PRÓXIMO alvo adicionado à lista.
 */
describe('PURGE_TARGETS × migrations', () => {
  const dir = join(__dirname, '..', 'supabase', 'migrations');
  const sql = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .join('\n');

  /** Colunas de uma tabela: as do CREATE TABLE mais as adicionadas por ALTER. */
  function colunasDe(tabela: string): Set<string> {
    const cols = new Set<string>();
    const create = new RegExp(
      `create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(?:public\\.)?${tabela}\\s*\\(([\\s\\S]*?)\\n\\);`,
      'i'
    ).exec(sql);
    if (create) {
      for (const linha of create[1].split('\n')) {
        const m = /^\s{2,}([a-z_][a-z0-9_]*)\s+\S/i.exec(linha);
        // 'unique (...)', 'primary key (...)', 'references ...' não são colunas.
        if (m && !['unique', 'primary', 'foreign', 'constraint', 'check'].includes(m[1].toLowerCase())) {
          cols.add(m[1]);
        }
      }
    }
    const alter = new RegExp(
      `alter\\s+table\\s+(?:public\\.)?${tabela}\\b([\\s\\S]*?);`,
      'gi'
    );
    for (const bloco of sql.matchAll(alter)) {
      for (const add of bloco[1].matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/gi)) {
        cols.add(add[1]);
      }
    }
    return cols;
  }

  it.each(PURGE_TARGETS.map((t) => [t.table, t.coluna ?? 'created_at'] as const))(
    '%s tem a coluna %s',
    (tabela, coluna) => {
      const cols = colunasDe(tabela);
      expect(cols.size, `nenhuma coluna lida de ${tabela} — parser quebrado?`).toBeGreaterThan(0);
      expect([...cols]).toContain(coluna);
    }
  );

  it('sanity: o parser sabe dizer NÃO — farmer_alerts não tem created_at', () => {
    // Se esta linha passar a falhar, o parser virou carimbo e os casos acima
    // ficam verdes à toa.
    expect([...colunasDe('farmer_alerts')]).not.toContain('created_at');
    expect([...colunasDe('farmer_alerts')]).toContain('sent_at');
  });
});

/**
 * Nada pode impedir o DELETE de um prospect.
 *
 * Apagar um prospect não é conveniência de faxina: é obrigação legal (LGPD Art.
 * 18) e é o que a retenção do achado #6 passou a fazer todo dia. Uma FK
 * `NO ACTION` apontando para `prospects` bloqueia as duas coisas — e em
 * silêncio, até existir a primeira linha filha.
 *
 * Foi o que aconteceu com `voice_calls`, criada em 04/ago pela integração de
 * voz: FK NO ACTION, zero linhas. Latente, não inofensivo — o webhook já estava
 * no ar ligando chamada a prospect pelo telefone. Bastava a primeira ligação
 * para que "apaga meus dados" falhasse com a transcrição da pessoa na base, e
 * para que o purge caísse inteiro (um DELETE com filtro é uma operação só: uma
 * linha presa derruba o lote).
 *
 * O teste é topológico porque a regra é topológica: vale para a PRÓXIMA tabela
 * que alguém pendurar em `prospects`, que é justamente quem ninguém vai lembrar
 * de conferir.
 */
describe('toda FK para prospects apaga em cascata', () => {
  const dirMig = join(__dirname, '..', 'supabase', 'migrations');
  const todoSql = readdirSync(dirMig)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(dirMig, f), 'utf8'))
    .join('\n');

  /** Cada `references ... prospects(id)` com o que vier depois, até o próximo
   * separador — é ali que o `on delete` aparece, quando aparece. */
  const referencias = [...todoSql.matchAll(/references\s+(?:public\.)?prospects\s*\(\s*id\s*\)([^,;\n]*)/gi)];

  it('o varredor acha as referências que sabemos existir', () => {
    // Sem isto, um regex quebrado passaria como "nenhuma violação encontrada".
    expect(referencias.length).toBeGreaterThanOrEqual(2);
  });

  it('nenhuma referência fica sem ON DELETE CASCADE', () => {
    for (const [trecho, cauda] of referencias.map((m) => [m[0], m[1]] as const)) {
      expect(cauda.toLowerCase(), `FK sem cascade: ${trecho.trim()}`).toMatch(/on\s+delete\s+cascade/);
    }
  });
});
