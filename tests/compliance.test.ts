import { describe, it, expect } from 'vitest';
import { checkOutbound } from '../api/_lib/compliance';

describe('checkOutbound', () => {
  it('passes an informational answer about a disease', () => {
    const text =
      'Pelas fotos parece ferrugem asiática. O importante é monitorar e conversar com seu agrônomo sobre rotação de fungicidas.';
    const r = checkOutbound(text);
    expect(r.safe).toBe(true);
    expect(r.text).toBe(text);
  });

  it('passes a mention that a registry entry exists (info, not prescription)', () => {
    const text =
      'Existe registro no Agrofit de fungicidas dos grupos triazol e carboxamida para ferrugem na soja. A escolha e a dose quem define é o agrônomo no receituário.';
    const r = checkOutbound(text);
    expect(r.safe).toBe(true);
  });

  it('blocks an explicit apply + dose instruction', () => {
    const text = 'Aplique o produto na dose de 0,5 L/ha na sua soja agora.';
    const r = checkOutbound(text);
    expect(r.safe).toBe(false);
    expect(r.flags.length).toBeGreaterThan(0);
    expect(r.text).toMatch(/receituário/i);
  });

  it('blocks pulverize + kg/ha rate', () => {
    const text = 'Pode pulverizar 2 kg por hectare desse fungicida.';
    const r = checkOutbound(text);
    expect(r.safe).toBe(false);
  });

  it('allows calagem advice with a rate (not a pesticide prescription)', () => {
    // Liming guidance is a legitimate, safe nudge; even with a number it is not
    // an application instruction combined with a defensivo/product.
    const text =
      'Seu solo é ácido, típico de Latossolo. Vale pensar em calagem — faça uma análise de solo com seu agrônomo pra definir a quantidade.';
    const r = checkOutbound(text);
    expect(r.safe).toBe(true);
  });

  it('does not flag a plain dose number with no instruction/product', () => {
    const text = 'A área tem uns 10 hectares, certo?';
    const r = checkOutbound(text);
    expect(r.safe).toBe(true);
  });
});
