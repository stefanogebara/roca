/**
 * Card "quem responde" — a página /verificar como imagem que viaja no grupo.
 * Fixa três coisas: o card nunca fabrica identidade (mesma regra da página),
 * o detector da pergunta "é golpe?/é robô?" acerta o formulaico e NÃO dispara
 * em pergunta agronômica, e a pipeline anexa o card com a caption certa.
 */
import { describe, it, expect } from 'vitest';
import { verifySvg, telBonito } from '../api/_lib/cards/verify';
import { svgToPng } from '../api/_lib/cards/render';
import { isIdentityQuestion } from '../api/_lib/verifyAsk';
import { verifyCardUrl, verifyCardCaption } from '../api/_lib/pipeline';

const base = {
  waNumber: '19705509125',
  host: 'roca-black.vercel.app',
  responsible: null,
  agronomo: null,
  crea: null,
  lgpdEmail: null,
};

describe('verifySvg', () => {
  it('leva o número, a divulgação de IA, a linha da prescrição e a página', () => {
    const svg = verifySvg(base);
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain('+1 (970) 550-9125');
    expect(svg).toContain('+19705509125');
    expect(svg).toMatch(/é um robô/i);
    expect(svg).toMatch(/não receita/i);
    expect(svg).toMatch(/Triagem, não prescrição/);
    expect(svg).toContain('roca-black.vercel.app/verificar');
    expect(svg).toContain('Sim, a Stevi');
  });

  it('NUNCA fabrica CREA, responsável ou e-mail quando o env está vazio', () => {
    const svg = verifySvg(base);
    expect(svg).not.toMatch(/CREA/);
    expect(svg).not.toMatch(/Responsável pela Stevi/);
    expect(svg).not.toMatch(/LGPD/);
  });

  it('mostra o agrônomo só com nome E CREA reais', () => {
    const com = verifySvg({ ...base, agronomo: 'Michel Silva', crea: 'CREA-MG 123456' });
    expect(com).toContain('Michel Silva · CREA-MG 123456');
    const semCrea = verifySvg({ ...base, agronomo: 'Michel Silva' });
    expect(semCrea).not.toContain('Michel Silva');
  });

  it('escapa valores do env (sem injeção no SVG)', () => {
    const svg = verifySvg({ ...base, responsible: '<b>x</b>' });
    expect(svg).not.toContain('<b>x</b>');
    expect(svg).toContain('&lt;b&gt;');
  });

  it('rasteriza a PNG quadrado', () => {
    const png = svgToPng(verifySvg({ ...base, responsible: 'Fulano', lgpdEmail: 'dados@stevi.agr.br' }), 1080);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  });
});

describe('telBonito', () => {
  it('formata +1 e +55; deixa o resto com o + na frente', () => {
    expect(telBonito('19705509125')).toBe('+1 (970) 550-9125');
    expect(telBonito('5534999887766')).toBe('+55 (34) 99988-7766');
    expect(telBonito('4915112345678')).toBe('+4915112345678');
  });
});

describe('isIdentityQuestion', () => {
  it.each([
    'vc é robô?',
    'isso é golpe?',
    'quem tá falando?',
    'quem é você',
    'isso aí é de verdade mesmo?',
    'é uma IA?',
    'quem responde por aqui?',
    'posso confiar nisso?',
    'Isso é robô né? Pode falar a verdade',
    'é gente ou máquina',
    'o que é a stevi',
  ])('dispara em "%s"', (t) => {
    expect(isIdentityQuestion(t)).toBe(true);
  });

  it.each([
    'posso pulverizar hoje?',
    'esse produto é confiável pra ferrugem?',
    'que praga é essa na folha da soja',
    'oi',
    'qual o preço do café hoje',
    'meu vizinho é agrônomo de verdade, ele disse pra rotacionar',
  ])('NÃO dispara em "%s"', (t) => {
    expect(isIdentityQuestion(t)).toBe(false);
  });

  it('ignora vazio e parágrafo longo', () => {
    expect(isIdentityQuestion(null)).toBe(false);
    expect(isIdentityQuestion('golpe '.repeat(60))).toBe(false);
  });
});

describe('verify card na pipeline', () => {
  it('URL sem dado (a identidade vem do env no endpoint) e caption apontando pra página', () => {
    expect(verifyCardUrl()).toMatch(/\/api\/card\?type=verify$/);
    expect(verifyCardCaption()).toMatch(/\/verificar$/);
    expect(verifyCardCaption()).not.toMatch(/wa\.me/);
  });
});
