/**
 * O produtor é UM, mesmo trocando de transporte.
 *
 * O Twilio entrega `+5511…` e a Meta entrega `5511…`. `upsertUser` gravava o
 * valor cru, então o mesmo produtor viraria duas linhas em `users` — histórico,
 * culturas, fazenda e consentimento LGPD divididos entre elas. Quem voltasse num
 * rollback apareceria como usuário novo, sem consentimento registrado, no exato
 * cenário em que ninguém tem tempo de investigar.
 *
 * O teste do Twilio é o que impede o conserto de virar outro bug: guardar sem
 * `+` só é seguro porque o adapter recoloca o `+` no fio. Sem isso, o alerta de
 * geada das linhas antigas (channel null, que roteiam por Twilio) sairia para
 * `whatsapp:5511…` e falharia.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { canonicalWaId } from '../api/_lib/db';
import { TwilioAdapter } from '../api/_lib/transport/twilio';

describe('canonicalWaId', () => {
  it('tira o `+` do formato Twilio', () => {
    expect(canonicalWaId('+5511999990000')).toBe('5511999990000');
  });

  it('deixa o formato da Meta intacto', () => {
    expect(canonicalWaId('5511999990000')).toBe('5511999990000');
  });

  it('os dois transportes convergem no MESMO id — é o ponto todo', () => {
    expect(canonicalWaId('+5511999990000')).toBe(canonicalWaId('5511999990000'));
  });

  it('limpa separadores que um humano digitaria', () => {
    expect(canonicalWaId('+55 (11) 99999-0000')).toBe('5511999990000');
  });

  it('é idempotente — normalizar de novo não muda nada', () => {
    const uma = canonicalWaId('+5511999990000');
    expect(canonicalWaId(uma)).toBe(uma);
  });

  it('PRESERVA o código do país, ao contrário de normalizePhoneBR', () => {
    // normalizePhoneBR arranca o 55 e valida DDD brasileiro — devolveria null
    // pro número americano do próprio produto, e um wa_id sem código de país
    // não tem como ser respondido.
    expect(canonicalWaId('+19705509125')).toBe('19705509125');
    expect(canonicalWaId('5511999990000').startsWith('55')).toBe(true);
  });
});

describe('o Twilio recoloca o `+` que o armazenamento não guarda', () => {
  const envAntes = { ...process.env };
  let enviado: Record<string, string> = {};

  beforeEach(() => {
    process.env.TWILIO_ACCOUNT_SID = 'AC-teste';
    process.env.TWILIO_AUTH_TOKEN = 'token-teste';
    process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886';
    enviado = {};
    vi.stubGlobal('fetch', async (_url: string, init: { body?: string }) => {
      enviado = Object.fromEntries(new URLSearchParams(init.body ?? ''));
      return { ok: true, status: 200, text: async () => '{}', json: async () => ({}) };
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...envAntes };
  });

  it('destinatário canônico (sem `+`) vira E.164 no fio', async () => {
    await new TwilioAdapter().send({ to: '5511999990000', text: 'oi' });
    expect(enviado.To).toBe('whatsapp:+5511999990000');
  });

  it('e um `+` que sobrou de linha antiga não vira `++`', async () => {
    await new TwilioAdapter().send({ to: '+5511999990000', text: 'oi' });
    expect(enviado.To).toBe('whatsapp:+5511999990000');
  });
});
