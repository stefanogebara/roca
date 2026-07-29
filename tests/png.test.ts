/**
 * Encoder PNG mínimo. Existe para a miniatura de satélite deixar de depender
 * do titiler.xyz (endpoint de demonstração de terceiro) sem trazer dependência
 * nova — o zlib do Node faz a compressão.
 *
 * O teste que importa é o de ida-e-volta: inflar o IDAT tem que devolver
 * exatamente as scanlines que entraram, com o byte de filtro na frente de cada
 * linha. Se o empacotamento estiver errado, o PNG ainda "abre" em alguns
 * visualizadores e sai com as cores deslocadas — erro que passa despercebido.
 */
import { describe, it, expect } from 'vitest';
import { inflateSync } from 'node:zlib';
import { encodePng } from '../api/_lib/tools/png';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Lê os chunks do PNG: [tipo, dados]. */
function chunks(png: Buffer): Array<[string, Buffer]> {
  const out: Array<[string, Buffer]> = [];
  let i = 8;
  while (i < png.length) {
    const len = png.readUInt32BE(i);
    const tipo = png.toString('ascii', i + 4, i + 8);
    out.push([tipo, png.subarray(i + 8, i + 8 + len)]);
    i += 12 + len; // len + tipo + dados + crc
  }
  return out;
}

describe('encodePng', () => {
  // 2×2, RGB: vermelho, verde / azul, branco
  const rgb = new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255]);

  it('começa com a assinatura PNG', () => {
    expect(encodePng(rgb, 2, 2).subarray(0, 8)).toEqual(SIG);
  });

  it('o IHDR declara tamanho, 8 bits e RGB truecolor', () => {
    const ihdr = chunks(encodePng(rgb, 2, 2)).find(([t]) => t === 'IHDR')![1];
    expect(ihdr.readUInt32BE(0)).toBe(2); // largura
    expect(ihdr.readUInt32BE(4)).toBe(2); // altura
    expect(ihdr[8]).toBe(8); // bit depth
    expect(ihdr[9]).toBe(2); // color type 2 = truecolor RGB
  });

  it('tem IHDR, IDAT e IEND, nessa ordem', () => {
    const tipos = chunks(encodePng(rgb, 2, 2)).map(([t]) => t);
    expect(tipos[0]).toBe('IHDR');
    expect(tipos).toContain('IDAT');
    expect(tipos[tipos.length - 1]).toBe('IEND');
  });

  // O teste forte: os pixels sobrevivem ao encode.
  it('inflar o IDAT devolve as scanlines originais, com byte de filtro', () => {
    const idat = chunks(encodePng(rgb, 2, 2)).find(([t]) => t === 'IDAT')![1];
    const cru = inflateSync(idat);
    // 2 linhas × (1 byte de filtro + 2 px × 3 canais)
    expect(cru.length).toBe(2 * (1 + 6));
    expect(cru[0]).toBe(0); // filtro None na linha 0
    expect(Array.from(cru.subarray(1, 7))).toEqual([255, 0, 0, 0, 255, 0]);
    expect(cru[7]).toBe(0); // filtro None na linha 1
    expect(Array.from(cru.subarray(8, 14))).toEqual([0, 0, 255, 255, 255, 255]);
  });

  it('aguenta imagem de 1 pixel', () => {
    const p = encodePng(new Uint8Array([1, 2, 3]), 1, 1);
    expect(p.subarray(0, 8)).toEqual(SIG);
    const cru = inflateSync(chunks(p).find(([t]) => t === 'IDAT')![1]);
    expect(Array.from(cru)).toEqual([0, 1, 2, 3]);
  });

  it('recusa dados que não fecham com largura × altura × 3', () => {
    expect(() => encodePng(new Uint8Array([1, 2, 3]), 2, 2)).toThrow(/3 canais|tamanho/i);
  });

  it('o CRC de cada chunk confere (senão o navegador rejeita a imagem)', () => {
    const png = encodePng(rgb, 4, 1);
    let i = 8;
    while (i < png.length) {
      const len = png.readUInt32BE(i);
      const crcLido = png.readUInt32BE(i + 8 + len);
      // Recalcula sobre tipo+dados, que é o escopo definido pela spec.
      const alvo = png.subarray(i + 4, i + 8 + len);
      let c = 0xffffffff;
      for (const b of alvo) {
        c ^= b;
        for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
      }
      expect((c ^ 0xffffffff) >>> 0).toBe(crcLido);
      i += 12 + len;
    }
  });
});
