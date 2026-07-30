/**
 * O número público da Stevi: um lugar só, e o site seguindo a env.
 *
 * Por que isto existe: o número aparece no QR impresso, no .vcf, no rodapé de
 * todo card e nos links de compartilhamento — a volta do produtor pro canal.
 * Estava resolvido em seis pontos do código com o mesmo literal repetido, e
 * `web/index.html` (estático) não seguia env nenhuma. Trocar o número deixaria
 * metade do kit apontando pro novo e a landing pro morto.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { publicWaNumber, DEFAULT_PUBLIC_WA_NUMBER, resetWaNumberWarning } from '../api/_lib/waNumber';
// @ts-expect-error — plain .mjs helper, no types
import { injectWaNumber } from '../scripts/build-web.mjs';

const envAntes = { ...process.env };
beforeEach(() => {
  resetWaNumberWarning();
  delete process.env.PUBLIC_WA_NUMBER;
});
afterEach(() => {
  process.env = { ...envAntes };
});

describe('publicWaNumber', () => {
  it('usa a env quando configurada', () => {
    process.env.PUBLIC_WA_NUMBER = '553599998888';
    expect(publicWaNumber()).toBe('553599998888');
  });

  it('normaliza pra dígitos — wa.me e o TEL do vCard não querem `+` nem espaço', () => {
    process.env.PUBLIC_WA_NUMBER = '+55 (35) 9999-8888';
    expect(publicWaNumber()).toBe('553599998888');
  });

  it('cai no embutido quando a env falta — apagar a volta seria pior', () => {
    expect(publicWaNumber()).toBe(DEFAULT_PUBLIC_WA_NUMBER);
  });

  it('e o fallback NÃO é silencioso', () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    publicWaNumber();
    const linhas = stderr.mock.calls.map((c) => String(c[0])).join('\n');
    expect(linhas).toContain('PUBLIC_WA_NUMBER');
    stderr.mockRestore();
  });

  it('avisa uma vez, não a cada card renderizado', () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    publicWaNumber();
    publicWaNumber();
    publicWaNumber();
    expect(stderr.mock.calls.length).toBe(1);
    stderr.mockRestore();
  });

  it('env presente não loga nada', () => {
    process.env.PUBLIC_WA_NUMBER = '553599998888';
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    publicWaNumber();
    expect(stderr).not.toHaveBeenCalled();
    stderr.mockRestore();
  });

  it('env com lixo sem dígito nenhum cai no embutido, e avisa', () => {
    process.env.PUBLIC_WA_NUMBER = 'trocar-depois';
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    expect(publicWaNumber()).toBe(DEFAULT_PUBLIC_WA_NUMBER);
    expect(stderr).toHaveBeenCalled();
    stderr.mockRestore();
  });
});

describe('o site estático segue a env', () => {
  const html = () => readFileSync('web/index.html', 'utf8');

  it('o HTML de origem traz o número embutido (é o que o build substitui)', () => {
    expect(html()).toContain(DEFAULT_PUBLIC_WA_NUMBER);
  });

  it('injectWaNumber troca TODAS as ocorrências, não a primeira', () => {
    const original = html();
    const ocorrencias = original.split(DEFAULT_PUBLIC_WA_NUMBER).length - 1;
    expect(ocorrencias).toBeGreaterThan(1); // são 4 hoje; o bug seria trocar 1

    const saida = injectWaNumber(original, '553599998888');
    expect(saida).not.toContain(DEFAULT_PUBLIC_WA_NUMBER);
    expect(saida.split('553599998888').length - 1).toBe(ocorrencias);
  });

  it('não mexe em mais nada do HTML', () => {
    const original = html();
    const saida = injectWaNumber(original, DEFAULT_PUBLIC_WA_NUMBER);
    expect(saida).toBe(original);
  });

  it('o default do build e o do runtime são o MESMO número', () => {
    // Divergir aqui é o pior caso da migração: metade do kit num número, metade
    // no outro, e nada falhando alto.
    const buildSrc = readFileSync('scripts/build-web.mjs', 'utf8');
    const doBuild = /const DEFAULT_WA = '(\d+)'/.exec(buildSrc)?.[1];
    expect(doBuild).toBe(DEFAULT_PUBLIC_WA_NUMBER);
  });
});
