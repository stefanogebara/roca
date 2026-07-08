import { describe, it, expect } from 'vitest';
import { isFieldHealthRequest } from '../api/_lib/pipeline';

describe('isFieldHealthRequest', () => {
  it('detects satellite / NDVI / vigor asks', () => {
    for (const t of [
      'me mostra a imagem de satélite da minha lavoura',
      'qual o ndvi da minha área?',
      'como está o vigor da lavoura',
      'como está minha lavoura?',
      'como tá a roça pelo satélite',
      'como vai minha plantação',
    ]) {
      expect(isFieldHealthRequest(t), t).toBe(true);
    }
  });

  it('does not fire on unrelated messages', () => {
    for (const t of [
      'posso pulverizar hoje?',
      'que praga é essa?',
      'bom dia',
      'quero um agrônomo',
    ]) {
      expect(isFieldHealthRequest(t), t).toBe(false);
    }
  });
});
