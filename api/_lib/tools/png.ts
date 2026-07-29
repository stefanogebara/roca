/**
 * Encoder PNG mínimo — truecolor RGB, 8 bits, sem filtro.
 *
 * Existe para a miniatura de satélite ("sua lavoura vista de cima") deixar de
 * depender do titiler.xyz, que é endpoint de DEMONSTRAÇÃO da Development Seed.
 * Nenhuma dependência nova: o zlib do Node faz a compressão, e o resto do PNG
 * é cabeçalho, CRC e três chunks.
 *
 * Escopo de propósito estreito: a fonte é o asset TCI do Sentinel-2, que já
 * chega RGB de 8 bits. Sem paleta, sem canal alfa, sem entrelaçamento — nada
 * disso é necessário aqui, e cada um seria código sem teste real.
 *
 * Filtro None em toda linha. Filtro adaptativo comprimiria melhor, mas numa
 * imagem de 384 px o ganho é irrelevante perto do risco de errar a predição.
 */

import { deflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Tabela de CRC-32 (polinômio 0xEDB88320), montada uma vez.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Um chunk PNG: tamanho, tipo, dados, CRC(tipo+dados). */
function chunk(tipo: string, dados: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(dados.length, 0);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo), 0);
  return Buffer.concat([len, corpo, crc]);
}

/**
 * Codifica RGB entrelaçado (r,g,b,r,g,b,…) num PNG.
 *
 * Lança quando o tamanho não fecha com largura × altura × 3 — silenciar isso
 * produziria uma imagem deslocada, que abre em alguns visualizadores e passa
 * despercebida.
 */
export function encodePng(rgb: Uint8Array, width: number, height: number): Buffer {
  const esperado = width * height * 3;
  if (rgb.length !== esperado) {
    throw new Error(`tamanho não fecha: ${rgb.length} bytes para ${width}×${height} RGB (3 canais) = ${esperado}`);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type 2 = truecolor RGB
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // filtro adaptativo (o único definido)
  ihdr[12] = 0; // sem entrelaçamento

  // Cada scanline leva um byte de filtro na frente. Filtro 0 = None.
  const stride = width * 3;
  const cru = Buffer.alloc(height * (1 + stride));
  for (let y = 0; y < height; y++) {
    const dst = y * (1 + stride);
    cru[dst] = 0;
    cru.set(rgb.subarray(y * stride, (y + 1) * stride), dst + 1);
  }

  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(cru, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
