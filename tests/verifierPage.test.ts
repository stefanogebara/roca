import { describe, it, expect } from 'vitest';
import { verifierHtml, type VerifierConfig } from '../api/_lib/verifierPage';

const base: VerifierConfig = {
  waNumber: '19705509125',
  responsible: null,
  agronomo: null,
  crea: null,
  lgpdEmail: null,
};

describe('verifierHtml', () => {
  it('always shows the honest disclosure content + the number + CTA', () => {
    const h = verifierHtml(base);
    expect(h).toMatch(/^<!doctype html>/i);
    expect(h).toMatch(/é um robô/i); // discloses it's AI
    expect(h).toMatch(/não receita/i); // discloses it doesn't prescribe
    expect(h).toMatch(/receituário/i);
    expect(h).toMatch(/\+1/); // the +1 explanation
    expect(h).toContain('+19705509125');
    // CTA must open the chat with a prefilled message (attribution: veio da
    // página de verificação), never an empty chat at the moment of highest intent.
    expect(h).toContain('https://wa.me/19705509125?text=');
    expect(h).toMatch(/apaga meus dados/i); // LGPD right
  });

  it('NEVER fabricates a CREA or responsável when the env is unset', () => {
    const h = verifierHtml(base);
    expect(h).not.toMatch(/CREA/); // the agronomic block is omitted, not faked
    expect(h).not.toMatch(/Responsável pela Stevi/);
    expect(h).not.toContain('mailto:');
  });

  it('renders the agronomic trust anchor only with BOTH a real CREA and a name', () => {
    const withCrea = verifierHtml({ ...base, agronomo: 'Michel Silva', crea: 'CREA-MG 123456' });
    expect(withCrea).toContain('Michel Silva');
    expect(withCrea).toContain('CREA-MG 123456');
    expect(withCrea).toMatch(/registrado no CREA/i);
    // a name without a CREA still shows nothing (no half-legitimacy claim)
    expect(verifierHtml({ ...base, agronomo: 'Michel Silva' })).not.toMatch(/CREA/);
  });

  it('shows responsável + LGPD e-mail only when provided', () => {
    const h = verifierHtml({ ...base, responsible: 'Fulano', lgpdEmail: 'dados@stevi.agr.br' });
    expect(h).toContain('Fulano');
    expect(h).toContain('mailto:dados@stevi.agr.br');
  });

  it('escapes interpolated identity values (no HTML injection)', () => {
    const h = verifierHtml({ ...base, responsible: '<script>x</script>' });
    expect(h).not.toContain('<script>x</script>');
    expect(h).toContain('&lt;script&gt;');
  });
});

describe('declaração de operadores (LGPD art. 9º/33)', () => {
  it('nomeia quem mais processa os dados, incluindo a Kapso e a IA no exterior', () => {
    const h = verifierHtml(base);
    expect(h).toMatch(/Kapso/); // terceiro que recebe os webhooks da conta WhatsApp
    expect(h).toMatch(/Meta|WhatsApp/);
    expect(h).toMatch(/Estados Unidos/i); // transferência internacional declarada
    expect(h).toMatch(/intelig[êe]ncia artificial/i);
  });

  it('NÃO afirma consentimento — descreve o que de fato acontece (aviso na 1ª conversa)', () => {
    const h = verifierHtml(base);
    // O código só registra a ENTREGA do aviso (db.markConsentNotified); dizer
    // "com seu consentimento" era uma alegação que o sistema não sustenta.
    expect(h).not.toMatch(/com seu consentimento/i);
    expect(h).toMatch(/te aviso|aviso disso|na primeira conversa/i);
  });

  it('não promete o que não pode provar sobre terceiros (sem alegar contrato/DPA)', () => {
    const h = verifierHtml(base);
    expect(h).not.toMatch(/sob contrato|contrato assinado|DPA/i);
  });
});
