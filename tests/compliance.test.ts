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

  // ── Red-team: bypass shapes found in the 2026-07 security review ──

  it('blocks brand name + dose + bare "use" (no generic product word)', () => {
    const text = 'Use Priori Xtra 0,3 L/ha que resolve essa ferrugem.';
    const r = checkOutbound(text);
    expect(r.safe).toBe(false);
  });

  it('blocks brand name + dose even without an apply verb', () => {
    const text = 'Priori Xtra 0,3 L/ha dá conta da ferrugem na sua lavoura.';
    const r = checkOutbound(text);
    expect(r.safe).toBe(false);
  });

  it('blocks a per-plant dose (how café/citros are dosed)', () => {
    const text = 'Aplique 5 ml por planta que a broca some.';
    const r = checkOutbound(text);
    expect(r.safe).toBe(false);
  });

  it('blocks a per-pé dose', () => {
    const text = 'É só aplicar 200 g por pé de café.';
    const r = checkOutbound(text);
    expect(r.safe).toBe(false);
  });

  it('blocks a tank-mix dose per 100 litros (citros)', () => {
    const text = 'Pulverize 100 ml para cada 100 litros de água no pomar.';
    const r = checkOutbound(text);
    expect(r.safe).toBe(false);
  });

  it('blocks "faça uma aplicação de" + dose (verb gap)', () => {
    const text = 'Faça uma aplicação de 2 L/ha no início do florescimento.';
    const r = checkOutbound(text);
    expect(r.safe).toBe(false);
  });

  it('blocks "a recomendação é" + dose (verb gap)', () => {
    const text = 'A recomendação é 1,5 kg/ha contra a lagarta.';
    const r = checkOutbound(text);
    expect(r.safe).toBe(false);
  });

  it('blocks active ingredient + dose without apply verb', () => {
    const text = 'Azoxistrobina a 0,3 L/ha controla bem essa doença.';
    const r = checkOutbound(text);
    expect(r.safe).toBe(false);
  });

  it('still allows a brand mention WITHOUT a dose (info, not prescription)', () => {
    const text =
      'Existem produtos como Priori Xtra com registro no Agrofit, mas quem escolhe o produto e define a dose é o agrônomo, no receituário.';
    const r = checkOutbound(text);
    expect(r.safe).toBe(true);
  });

  it('still allows a lowercase common word that collides with a brand name, with a dose context', () => {
    // "ametista"/"ágata" are Agrofit brand names; lowercase common-noun usage
    // plus an unrelated area figure must not trip the brand check.
    const text = 'Sua colheita rendeu uns 3.000 kg por hectare, uma ametista de safra!';
    const r = checkOutbound(text);
    expect(r.safe).toBe(true);
  });
});

/**
 * O gate na linguagem do produtor pequeno (achado #12 da auditoria de 04/ago).
 *
 * O gate disparou ZERO vezes em 926 mensagens. Sem tabela de eventos não dá pra
 * saber se isso é bom comportamento do modelo ou gate cego — mas dá pra ver o
 * que ele NÃO sabia ler, e o que faltava era justamente o vocabulário de quem
 * pulveriza com bomba costal, não com pulverizador de barra:
 *
 *   "meio litro por bomba"   — a unidade real de quem carrega nas costas
 *   "0,5% na calda"          — concentração, não taxa por área
 *   "uma saca por hectare"
 *
 * E a segunda metade, que não é vocabulário e sim leitura da lei: sob a Lei
 * 14.785/2023 mandar aplicar uma MARCA já é prescrição, com ou sem dose.
 * "Aplique Priori Xtra" não precisa de número para ser receita.
 */
describe('vocabulário do pulverizador costal', () => {
  const barrado = (t: string) => expect(checkOutbound(t).safe).toBe(false);
  const passa = (t: string) => expect(checkOutbound(t).safe).toBe(true);

  it.each([
    'Aplique 500 ml por bomba de 20 litros.',
    'Use meio litro por bomba.',
    'Pulverize 0,5% na calda.',
    'Aplique 2 sacas por hectare.',
    'Recomendo 30 ml por litro de água.',
  ])('barra dose + instrução: %s', barrado);

  it('verbo + MARCA sem dose nenhuma já é prescrição', () => {
    barrado('Aplique Priori Xtra na sua lavoura.');
  });

  it('citar a marca sem mandar aplicar continua liberado', () => {
    // A Stevi pode dizer o que EXISTE registrado; o que ela não pode é receitar.
    passa('Existe registro de Priori Xtra para ferrugem asiática na soja.');
  });

  it('manejo sem produto nem dose continua passando', () => {
    passa('Monitore o talhão duas vezes por semana e faça rotação de mecanismos de ação.');
  });

  it('número solto não vira dose', () => {
    passa('A ferrugem apareceu em 3 talhões da região.');
  });
});
