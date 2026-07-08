import { describe, it, expect } from 'vitest';
import { isReferralRequest } from '../api/_lib/pipeline';

describe('isReferralRequest', () => {
  it('detects explicit requests for an agrônomo', () => {
    for (const t of [
      'me indica um agrônomo',
      'quero falar com um agronomo',
      'preciso de um agrônomo aqui na região',
      'você consegue me conectar com um agrônomo?',
      'me arruma um agrônomo pra ver isso',
    ]) {
      expect(isReferralRequest(t), t).toBe(true);
    }
  });

  it('does not fire on incidental mentions or unrelated text', () => {
    for (const t of [
      'o agrônomo da cooperativa já passou aqui semana passada',
      'posso pulverizar hoje?',
      'que praga é essa na minha soja?',
      'bom dia',
    ]) {
      expect(isReferralRequest(t), t).toBe(false);
    }
  });
});
