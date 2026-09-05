/**
 * Onboarding — os primeiros cinco minutos. O que se mediu em 03/set nas duas
 * conversas reais de produtor: quem chegou ao pin recebeu o cartão em cinco
 * mensagens; quem não chegou parou na saudação. Estes testes fixam o caminho
 * curto até o pin e o que ele devolve.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { asksForPin, PIN_ASK_MARK, CROP_BUTTONS } from '../api/_lib/onboarding';
import { saudacaoDeEntrada } from '../api/_lib/growth';
import { parseCrops, isCropsOnlyMessage } from '../api/_lib/tools/crops';

describe('asksForPin — a marca que liga o botão nativo de localização', () => {
  it('reconhece a frase que toda resposta nossa usa pra pedir o pin', () => {
    expect(asksForPin(`Ainda não tenho a localização. Manda o pin aqui (${PIN_ASK_MARK}).`)).toBe(true);
  });
  it('não dispara em resposta comum, vazia ou nula', () => {
    expect(asksForPin('Pode pulverizar agora: Delta T 6 °C.')).toBe(false);
    expect(asksForPin('')).toBe(false);
    expect(asksForPin(null)).toBe(false);
  });
});

describe('saudação sem origem — curta e terminando no pin', () => {
  const t = saudacaoDeEntrada(null);
  it('pede o pin com a marca do botão nativo', () => {
    expect(asksForPin(t)).toBe(true);
  });
  it('promete o que o pin devolve: janela de hoje e alerta proativo', () => {
    expect(t).toMatch(/pulverizar hoje/i);
    expect(t).toMatch(/geada/i);
  });
  it('mantém a linha da prescrição e cabe numa mensagem interativa', () => {
    expect(t).toMatch(/quem receita produto é o agrônomo/i);
    expect(t.length).toBeLessThanOrEqual(1024);
    expect(t).not.toMatch(/Como posso ajudar/i);
  });
  it('não rouba a saudação de feira nem a de indicação', () => {
    expect(saudacaoDeEntrada('fecon')).toMatch(/te encontrar na/i);
    expect(saudacaoDeEntrada('michel')).toMatch(/te mandou aqui/i);
  });
});

describe('botões de cultura pós-pin', () => {
  it('são ≤3, ≤20 chars, e cada título é uma resposta que parseCrops entende', () => {
    expect(CROP_BUTTONS.length).toBeLessThanOrEqual(3);
    for (const b of CROP_BUTTONS) {
      expect(b.length).toBeLessThanOrEqual(20);
      expect(parseCrops(b)).toHaveLength(1);
      expect(isCropsOnlyMessage(b)).toBe(true); // cai na rota cropsOnly, sem código novo
    }
  });
  it('café vem primeiro — é o beachhead', () => {
    expect(parseCrops(CROP_BUTTONS[0])).toEqual(['café']);
  });
});

/**
 * Invariante de classe, não de caso: o botão nativo é ligado por uma marca
 * literal no texto. Qualquer resposta que peça o pin com "📎 → Localização"
 * mas escreva a marca diferente sai sem botão — e ninguém percebe, porque o
 * texto continua certo. Foi o que aconteceu com a resposta de "não achei
 * vegetação" em 03/set. Este teste varre a fonte para que não volte.
 */
describe('toda menção ao clipe na fonte usa a marca exata', () => {
  const raiz = join(process.cwd(), 'api', '_lib') + '/';

  function arquivos(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? arquivos(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : []
    );
  }

  it('nenhum "📎 → Localização" aparece sem o "clipe" na frente', () => {
    const infratores: string[] = [];
    for (const f of arquivos(raiz)) {
      for (const [i, linha] of readFileSync(f, 'utf8').split('\n').entries()) {
        if (linha.includes('📎 → Localização') && !linha.includes(PIN_ASK_MARK)) {
          infratores.push(`${f.slice(raiz.length)}:${i + 1}`);
        }
      }
    }
    expect(infratores).toEqual([]);
  });
});
