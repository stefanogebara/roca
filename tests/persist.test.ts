/**
 * Escrita tipada — o antídoto pro "Anotado ✅" que não anotou.
 *
 * A auditoria chamou isso de "mentira silenciosa" e é a pior classe de bug que
 * temos: o produtor confia que a Stevi guardou a informação, para de anotar no
 * caderno dele, e meses depois descobre que não tinha nada. Diferente de um
 * erro visível, esse corrói exatamente a tese do produto.
 *
 * A defesa não é lembrar de checar o retorno — é tornar IMPOSSÍVEL produzir a
 * mensagem de confirmação sem ter o valor de sucesso na mão. Mesma lição do
 * AgentAction: o certo é fazer o errado não ser representável.
 */
import { describe, it, expect } from 'vitest';
import { persist, confirmarOuAvisar, validarCoordenada, validarCulturas } from '../api/_lib/persist';

describe('validarCoordenada — argumento inválido não chega no banco', () => {
  it('aceita coordenada plausível no Brasil', () => {
    expect(validarCoordenada(-21.55, -45.43)).toBeNull();
  });
  it('rejeita fora da faixa válida', () => {
    expect(validarCoordenada(91, 0)).toMatch(/latitude/i);
    expect(validarCoordenada(0, 181)).toMatch(/longitude/i);
  });
  it('rejeita NaN e infinito — vêm de parse silencioso', () => {
    expect(validarCoordenada(NaN, -45)).toBeTruthy();
    expect(validarCoordenada(-21, Infinity)).toBeTruthy();
  });
  it('rejeita (0,0) — Ilha Nula é o erro de parse mais comum que existe', () => {
    expect(validarCoordenada(0, 0)).toMatch(/0\s*,\s*0|nula/i);
  });
});

describe('validarCulturas', () => {
  it('aceita lista com culturas conhecidas', () => {
    expect(validarCulturas(['café', 'milho'])).toBeNull();
  });
  it('rejeita lista vazia — gravar vazio apaga o que o produtor já disse', () => {
    expect(validarCulturas([])).toMatch(/vazia/i);
  });
  it('rejeita cultura desconhecida em vez de gravar lixo', () => {
    expect(validarCulturas(['café', 'dragão'])).toMatch(/dragão/i);
  });
});

describe('persist — o resultado obriga a tratar a falha', () => {
  it('sucesso carrega o valor', async () => {
    const r = await persist('teste', () => Promise.resolve('id-123'));
    expect(r).toEqual({ ok: true, valor: 'id-123' });
  });

  it('null do banco é FALHA, não sucesso silencioso', async () => {
    const r = await persist('teste', () => Promise.resolve(null));
    expect(r.ok).toBe(false);
  });

  it('false do banco é FALHA', async () => {
    const r = await persist('teste', () => Promise.resolve(false));
    expect(r.ok).toBe(false);
  });

  it('exceção vira falha com motivo, nunca escapa', async () => {
    const r = await persist('teste', () => Promise.reject(new Error('conexão caiu')));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/conexão caiu/);
  });

  it('true é sucesso (escrita sem id de volta)', async () => {
    const r = await persist('teste', () => Promise.resolve(true));
    expect(r).toEqual({ ok: true, valor: true });
  });

  it('valor 0 e string vazia são sucessos legítimos, não falha', async () => {
    expect((await persist('t', () => Promise.resolve(0))).ok).toBe(true);
    expect((await persist('t', () => Promise.resolve(''))).ok).toBe(true);
  });
});

describe('confirmarOuAvisar — não dá pra confirmar sem ter o sucesso', () => {
  it('no sucesso usa a mensagem de confirmação, com o valor', () => {
    const msg = confirmarOuAvisar(
      { ok: true, valor: 'abc' },
      { confirma: (v) => `guardei (${v})`, avisa: () => 'não guardei' }
    );
    expect(msg).toBe('guardei (abc)');
  });

  it('na falha usa a mensagem de aviso, com o motivo', () => {
    const msg = confirmarOuAvisar(
      { ok: false, motivo: 'timeout' },
      { confirma: () => 'guardei', avisa: (m) => `deu ruim: ${m}` }
    );
    expect(msg).toBe('deu ruim: timeout');
  });

  it('a mensagem de aviso é obrigatória — sem ela não compila nem roda', () => {
    // @ts-expect-error `avisa` é obrigatório de propósito: era o buraco por
    // onde "Anotado ✅" saía sem escrita nenhuma.
    expect(() => confirmarOuAvisar({ ok: false, motivo: 'x' }, { confirma: () => 'ok' })).toThrow();
  });
});
