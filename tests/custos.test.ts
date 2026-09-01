/**
 * Grounding de custo de produção (tools/custos.ts). O detector precisa pegar a
 * pergunta de custo SEM roubar a rota de cotação (prices) nem o caminho geral
 * de quem só falou "quanto custa" de coisa avulsa; o bloco precisa citar a
 * fonte citável (Campo Futuro) e proibir número inventado.
 */
import { describe, it, expect } from 'vitest';
import { isCostQuestion, custosGroundingBlock } from '../api/_lib/tools/custos';
import { isPriceRequest } from '../api/_lib/pipeline';

describe('isCostQuestion', () => {
  it('pega as formas reais de perguntar custo de produção', () => {
    for (const t of [
      'quanto custa produzir uma saca de café hoje?',
      'qual o custo de produção do café?',
      'custo médio da produção de soja',
      'quanto eu gasto pra produzir um hectare de milho?',
      'quanto se gasta pra produzir café na minha região?',
      'qual meu custo por saca?',
      'custo por hectare de soja tá em quanto?',
    ]) {
      expect(isCostQuestion(t), t).toBe(true);
    }
  });

  it('NÃO pega cotação nem "quanto custa" avulso', () => {
    for (const t of [
      'cotação do café',
      'quanto tá a saca do café?',
      'quanto custa um trator usado?',
      'quanto custa a assinatura?',
      'que praga é essa?',
      'posso pulverizar hoje?',
    ]) {
      expect(isCostQuestion(t), t).toBe(false);
    }
  });

  it('não colide com a rota de cotação — cada pergunta tem um dono', () => {
    // Custo de produção não é cotação (e vice-versa): a rota prices continua
    // atendendo preço, e o grounding de custo só entra no caminho de raciocínio.
    expect(isPriceRequest('quanto custa produzir uma saca de café?')).toBe(false);
    expect(isCostQuestion('quanto tá a saca do café?')).toBe(false);
  });
});

describe('custosGroundingBlock', () => {
  const block = custosGroundingBlock();

  it('cita a fonte citável e a estrutura de custo', () => {
    expect(block).toMatch(/Campo Futuro/);
    expect(block).toMatch(/CNA\/Senar/);
    expect(block).toMatch(/COE/);
    expect(block).toMatch(/COT/);
  });

  it('proíbe número de memória e explica o que é a propriedade modal', () => {
    expect(block).toMatch(/NUNCA afirme um valor/i);
    expect(block).toMatch(/modal/i);
  });

  it('NÃO embute número de custo — boletim é mensal, número aqui envelhece', () => {
    expect(block).not.toMatch(/R\$\s*\d/);
  });

  it('puxa pro caderno — o custo DELE é dado que só a Stevi coleta', () => {
    expect(block).toMatch(/caderno/i);
  });
});
