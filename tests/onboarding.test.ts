/**
 * Onboarding — os primeiros cinco minutos. O que se mediu em 03/set nas duas
 * conversas reais de produtor: quem chegou ao pin recebeu o cartão em cinco
 * mensagens; quem não chegou parou na saudação. Estes testes fixam o caminho
 * curto até o pin e o que ele devolve.
 */
import { describe, it, expect } from 'vitest';
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
