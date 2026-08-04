/**
 * A truncagem do verbatim mora na camada de dados (achado #16).
 *
 * Num lugar só, porque `addOptout` tem dois chamadores hoje (opt-out inbound e
 * exclusão LGPD) e ambos precisam do mesmo teto. Truncar em cada chamador é
 * como o limite se perde no terceiro.
 *
 * Truncar, nunca descartar: uma mensagem enorme não pode fazer a prova do
 * pedido sumir — é justamente o registro que sustenta o opt-out para LGPD.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const upserts: Array<Record<string, unknown>> = [];

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      upsert: (row: Record<string, unknown>) => {
        upserts.push(row);
        return Promise.resolve({ error: null });
      },
    }),
  }),
}));

import { addOptout } from '../api/_lib/prospect/db';

beforeEach(() => {
  upserts.length = 0;
  process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave-de-teste';
});

describe('addOptout', () => {
  it('corta em 500 e guarda o começo, que é onde está o pedido', async () => {
    await addOptout('+5535999887766', 'inbound opt-out', 'para de mandar ' + 'x'.repeat(5000));
    const v = String(upserts[0].verbatim);
    expect(v.length).toBe(500);
    expect(v.startsWith('para de mandar')).toBe(true);
  });

  it('sem verbatim grava null explícito — undefined não mexeria na coluna', async () => {
    await addOptout('+5535999887766', 'exclusão LGPD solicitada pelo titular');
    expect(upserts[0].verbatim).toBeNull();
  });

  it('a categoria continua separada da evidência', async () => {
    await addOptout('+5535999887766', 'inbound opt-out', 'sair');
    expect(upserts[0]).toMatchObject({ reason: 'inbound opt-out', verbatim: 'sair' });
  });
});
