/**
 * Card URL signing — forgery guard for the public /api/card renderer.
 * Contract: signed URLs verify regardless of param order; any tamper fails;
 * without a secret the whole mechanism is a no-op (dev).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  appendCardSig,
  verifyCardQuery,
  roundCoord,
  cardSecretConfigured,
  resetCardSecretWarning,
} from '../api/_lib/cardSign';

describe('card URL signing', () => {
  beforeEach(() => {
    process.env.REPORT_URL_SECRET = 'test-secret';
  });
  afterEach(() => {
    delete process.env.REPORT_URL_SECRET;
  });

  const qs = (url: string) => new URLSearchParams(url.slice(url.indexOf('?') + 1));

  it('signs and verifies a card URL', () => {
    const url = appendCardSig('https://x/api/card?type=frost&d0=2026-07-26&t0=-1.2');
    expect(url).toMatch(/&sig=[0-9a-f]{16}$/);
    expect(verifyCardQuery(qs(url))).toBe(true);
  });

  it('is param-order independent (canonicalized)', () => {
    const signed = appendCardSig('https://x/api/card?b=2&a=1');
    const sig = qs(signed).get('sig')!;
    expect(verifyCardQuery(new URLSearchParams(`a=1&b=2&sig=${sig}`))).toBe(true);
  });

  it('rejects tampered values and missing sig', () => {
    const url = appendCardSig('https://x/api/card?type=frost&t0=-1.2');
    const tampered = url.replace('-1.2', '-9.9');
    expect(verifyCardQuery(qs(tampered))).toBe(false);
    expect(verifyCardQuery(new URLSearchParams('type=frost&t0=-1.2'))).toBe(false);
  });

  // Contrato TROCADO de propósito em 04/ago (achado #18). Antes: sem segredo,
  // `verifyCardQuery` devolvia true "para dev" — e era um fusível de vidro, a
  // guarda contra falsificação de marca sumia junto com a env, no cenário em que
  // ninguém percebe. Agora recusa, e quem monta a resposta consulta
  // `cardSecretConfigured()` para não anexar um card que o endpoint vai negar.
  it('sem segredo: não assina, RECUSA, e avisa que os cards estão desligados', () => {
    delete process.env.REPORT_URL_SECRET;
    resetCardSecretWarning();
    const url = appendCardSig('https://x/api/card?type=frost');
    expect(url).not.toContain('sig=');
    expect(verifyCardQuery(new URLSearchParams('type=frost'))).toBe(false);
    expect(cardSecretConfigured()).toBe(false);
  });

  it('sem segredo, nem uma URL bem formada de antes passa', () => {
    // O ataque óbvio: assinar em dev (ou com um segredo vazado antigo) e mandar
    // depois. Sem segredo configurado nada é aceito, ponto.
    process.env.REPORT_URL_SECRET = 'segredo-antigo';
    const assinada = appendCardSig('https://x/api/card?type=frost&t0=-1.2');
    delete process.env.REPORT_URL_SECRET;
    expect(verifyCardQuery(qs(assinada))).toBe(false);
  });

  it('com segredo, cards voltam a ser permitidos', () => {
    process.env.REPORT_URL_SECRET = 'sk-teste';
    resetCardSecretWarning();
    expect(cardSecretConfigured()).toBe(true);
  });

  it('roundCoord keeps ~110 m precision', () => {
    expect(roundCoord(-20.256789)).toBe(-20.257);
    expect(roundCoord(-42.1)).toBe(-42.1);
  });
});
