/**
 * Auto-verificação do alerta — a resposta estrutural ao incidente de 03/ago.
 *
 * Naquele dia o canal de alerta da empresa estava morto havia semanas (Twilio
 * sandbox, 63015) e ninguém sabia, porque a API devolve "accepted" e falha
 * depois, em silêncio. A lição virou regra no lessons.md: ACEITE NÃO É ENTREGA.
 *
 * Aqui essa regra vira mecanismo: todo alerta por WhatsApp guarda o wamid, o
 * callback de status da Meta marca a entrega, e o que ficar pendente tempo
 * demais é escalado por outro canal. O alarme passa a ter alarme.
 */
import { describe, it, expect } from 'vitest';
import { classificarCallback, precisaEscalar, type AlertaPendente } from '../api/_lib/alertDelivery';

const agora = new Date('2026-08-03T12:00:00Z');
const min = (n: number) => new Date(agora.getTime() - n * 60_000).toISOString();

describe('classificarCallback — o que o status da Meta significa pro alerta', () => {
  it('delivered e read contam como entregue', () => {
    expect(classificarCallback('delivered')).toBe('entregue');
    expect(classificarCallback('read')).toBe('entregue');
  });

  it('sent NÃO é entrega — é o mesmo "accepted" que nos enganou', () => {
    // O Twilio dizia "queued" e falhava depois. 'sent' é a versão Meta disso:
    // saiu daqui, ninguém garante que chegou. Continua pendente.
    expect(classificarCallback('sent')).toBe('pendente');
  });

  it('failed é falha explícita — escala na hora, sem esperar o timeout', () => {
    expect(classificarCallback('failed')).toBe('falhou');
  });
});

describe('precisaEscalar — quem ficou no limbo', () => {
  const a = (over: Partial<AlertaPendente> = {}): AlertaPendente => ({
    id: 'x',
    created_at: min(30),
    delivered_at: null,
    escalated_at: null,
    ...over,
  });

  it('pendente além da janela: escala', () => {
    expect(precisaEscalar(a({ created_at: min(30) }), agora)).toBe(true);
  });

  it('pendente ainda dentro da janela: espera — callback da Meta demora', () => {
    expect(precisaEscalar(a({ created_at: min(3) }), agora)).toBe(false);
  });

  it('já entregue: nunca escala', () => {
    expect(precisaEscalar(a({ delivered_at: min(20) }), agora)).toBe(false);
  });

  it('já escalado: não escala de novo — escalada repetida vira spam ignorado', () => {
    expect(precisaEscalar(a({ escalated_at: min(10) }), agora)).toBe(false);
  });
});
