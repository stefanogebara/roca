/**
 * Ferramentas server-side do agente de voz (api/el-tools.ts).
 *
 * Por que este arquivo existe: na primeira ligação de saída real (08/ago,
 * conv_8501kzgm...) a Vitória conduziu a conversa inteira, o prospect aceitou
 * receber indicações — e o `registrar_resultado` devolveu 404 porque o número
 * não estava na tabela `prospects`. Resultado: o desfecho da ligação foi
 * jogado no lixo E o produtor ouviu "parece que deu um erro" no telefone.
 *
 * A regra que estes testes travam: numa ligação de PROSPECÇÃO, o número novo é
 * o caso normal, não a exceção. Registrar o desfecho nunca pode depender de o
 * prospect já existir — se não existe, cria.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const SECRET = 'segredo_teste';

/** Banco simulado: tabelas em memória, encadeamento igual ao do supabase-js. */
function fakeDb(prospects: Array<{ id: string; phone: string }>) {
  const inseridos: Record<string, unknown[]> = { prospects: [], prospect_messages: [] };
  const api = {
    from(tabela: string) {
      const q: Record<string, unknown> = {};
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: () => Promise.resolve({ data: [] }),
        maybeSingle: () => {
          const achado = tabela === 'prospects'
            ? prospects.find((p) => p.phone === (q.phone as string)) ?? null
            : null;
          return Promise.resolve({ data: achado, error: null });
        },
        insert: (linha: Record<string, unknown>) => {
          inseridos[tabela].push(linha);
          const criado = { id: `novo_${inseridos[tabela].length}`, ...linha };
          if (tabela === 'prospects') prospects.push(criado as { id: string; phone: string });
          return {
            select: () => ({ single: () => Promise.resolve({ data: criado, error: null }) }),
            then: (r: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(r),
          };
        },
      };
      // O `.eq('phone', x)` precisa registrar o valor pro maybeSingle achar.
      chain.eq = ((col: string, val: unknown) => { q[col] = val; return chain; }) as never;
      return chain;
    },
    _inseridos: inseridos,
  };
  return api;
}

let db: ReturnType<typeof fakeDb>;
vi.mock('../api/_lib/db', () => ({ getDb: () => db }));
vi.mock('../api/_lib/logger', () => ({
  createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}));

// Import estático: o vi.mock acima é hoisted pelo vitest, então o handler já
// nasce com o db simulado. (Top-level await aqui quebraria o tsc do projeto.)
import handler from '../api/el-tools';

function chamar(body: unknown) {
  const req = { method: 'POST', headers: { 'x-el-tools-secret': SECRET }, body } as never;
  const res = {
    statusCode: 0,
    payload: undefined as unknown,
    status(c: number) { this.statusCode = c; return this; },
    json(p: unknown) { this.payload = p; return this; },
  };
  return handler(req, res as never).then(() => res);
}

beforeEach(() => {
  process.env.EL_TOOLS_SECRET = SECRET;
  db = fakeDb([{ id: 'p_conhecido', phone: '+5535999111222' }]);
});

describe('registrar — o desfecho da ligação nunca se perde', () => {
  it('prospect JÁ conhecido: grava a nota na thread dele', async () => {
    const res = await chamar({
      action: 'registrar', phone: '+5535999111222', nota: 'aceitou receber indicações',
    });
    expect(res.statusCode).toBe(200);
    const notas = db._inseridos.prospect_messages as Array<Record<string, unknown>>;
    expect(notas).toHaveLength(1);
    expect(notas[0].prospect_id).toBe('p_conhecido');
    expect(String(notas[0].text)).toContain('aceitou receber indicações');
  });

  it('número NOVO: cria o prospect e grava a nota — nunca 404', async () => {
    // Esta é a regressão real da conv_8501kzgm...: numa ligação de prospecção,
    // número sem histórico é o caso comum. 404 aqui perde o desfecho da
    // conversa inteira e faz o agente falar "deu um erro" no telefone.
    const res = await chamar({
      action: 'registrar', phone: '+5511999002121', nota: 'quer contato direto com produtores',
    });
    expect(res.statusCode).toBe(200);
    expect(db._inseridos.prospects).toHaveLength(1);
    const notas = db._inseridos.prospect_messages as Array<Record<string, unknown>>;
    expect(notas).toHaveLength(1);
    expect(String(notas[0].text)).toContain('quer contato direto');
  });

  it('sem nota: 400 — aqui recusar é certo, não há desfecho pra guardar', async () => {
    const res = await chamar({ action: 'registrar', phone: '+5511999002121', nota: '  ' });
    expect(res.statusCode).toBe(400);
  });
});

describe('auth e contexto', () => {
  it('sem o secret correto: 401 e nada toca o banco', async () => {
    const req = { method: 'POST', headers: {}, body: { action: 'registrar' } } as never;
    const res = { statusCode: 0, status(c: number) { this.statusCode = c; return this; }, json() { return this; } };
    await handler(req, res as never);
    expect(res.statusCode).toBe(401);
    expect(db._inseridos.prospect_messages).toHaveLength(0);
  });

  it('contexto de número novo: 200 com conhecido=false (não é erro)', async () => {
    const res = await chamar({ action: 'contexto', phone: '+5511999002121' });
    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({ success: true, data: { conhecido: false } });
  });
});
