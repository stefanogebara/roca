/**
 * O nono dígito: a Meta devolve o remetente SEM ele, e nós perdíamos o prospect.
 *
 * Medido em 05/ago, 10:02, logo depois do disparo. Enviamos para dois números e
 * as respostas chegaram de um `wa_id` mais curto:
 *
 *   GA Agrosoluções    enviado +55 35 9 9750-6635   respondeu 55 35 9750-6635
 *   Rural Consultoria  enviado +55 38 9 8874-0493   respondeu 55 38 8874-0493
 *
 * É comportamento conhecido do WhatsApp no Brasil: contas antigas mantêm o JID
 * de 8 dígitos, e a Cloud API entrega o JID, não o número que discamos. O
 * `normalizePhoneBR` devolvia NULL para essas duas — 8 dígitos começando com 9
 * caía no ramo de fixo, que exige começar em 2-5.
 *
 * A cascata a partir do null, em ordem de gravidade:
 *
 * 1. LGPD. `handleProspectInbound` faz `normalizePhoneBR(waFrom)` e RETORNA na
 *    linha seguinte quando dá null — antes de checar opt-out. Um "sair" vindo
 *    desses números nunca era visto, e o bump continuava. É exatamente o que a
 *    máquina de opt-out existe para impedir.
 * 2. Produto. Sem achar o prospect, a mensagem caía no fluxo de PRODUTOR e a
 *    Stevi respondia "sou sua ajudante de lavoura 🌱" para uma empresa de
 *    software agro e para uma consultoria.
 * 3. Dado. 12 linhas em `users` são empresas criadas por esse caminho, e elas
 *    contaram em WAU e caderno.
 * 4. E foi a causa a montante do loop de 03/ago: a Corpal Tratores está nessa
 *    lista de 12. O autoatendimento dela nunca deveria ter chegado na Stevi — o
 *    porteiro da Vitória o teria parqueado no primeiro turno. O guard de eco de
 *    04/ago tratou o sintoma; a doença era esta.
 *
 * O conserto é ADITIVO: só transforma em número o que hoje vira null. Nenhuma
 * entrada que já era aceita muda de valor.
 */
import { describe, it, expect } from 'vitest';
import { normalizePhoneBR, isMobileBR } from '../api/_lib/prospect/core';

describe('celular sem o nono dígito (o que a Meta entrega)', () => {
  it('os DOIS casos reais de 05/ago passam a casar com o que enviamos', () => {
    expect(normalizePhoneBR('553597506635')).toBe('+5535997506635');
    expect(normalizePhoneBR('553888740493')).toBe('+5538988740493');
  });

  it('casa com a forma canônica — é isso que faz o opt-out funcionar', () => {
    // O opt-out é gravado pelo número normalizado do inbound e conferido no
    // disparo pelo `wa_phone` guardado. Se os dois não normalizarem igual, o
    // pedido de sair fica num telefone e o envio olha outro.
    expect(normalizePhoneBR('553597506635')).toBe(normalizePhoneBR('+5535997506635'));
  });

  it.each([
    ['553599853341', '+5535999853341'],
    ['553597621990', '+5535997621990'], // Corpal Tratores, a do loop de 03/ago
    ['5511988887777', '+5511988887777'], // já canônico, não muda
  ])('%s -> %s', (entrada, esperado) => {
    expect(normalizePhoneBR(entrada)).toBe(esperado);
  });

  it('assinantes antigos de 8 dígitos começando em 6, 7 ou 8 também são celular', () => {
    // Antes do nono dígito, celular no Brasil começava em 6-9. Fixo é 2-5.
    expect(normalizePhoneBR('553588740493')).toBe('+5535988740493');
    expect(normalizePhoneBR('553578740493')).toBe('+5535978740493');
    expect(normalizePhoneBR('553568740493')).toBe('+5535968740493');
  });

  it('o resultado é reconhecido como celular', () => {
    expect(isMobileBR(normalizePhoneBR('553597506635'))).toBe(true);
  });
});

describe('o que NÃO pode mudar', () => {
  it('fixo de 8 dígitos continua fixo — nada de inventar um 9 nele', () => {
    // Este é o caso da coccamig: fixo com wa.me publicado, que RECEBE WhatsApp.
    // Enfiar um 9 aqui inventaria um número que não existe.
    expect(normalizePhoneBR('19 3822-1234')).toBe('+551938221234');
    expect(normalizePhoneBR('553532142166')).toBe('+553532142166');
  });

  it('celular já completo não ganha um segundo 9', () => {
    expect(normalizePhoneBR('+55 11 99900-2121')).toBe('+5511999002121');
    expect(normalizePhoneBR('11999002121')).toBe('+5511999002121');
  });

  it('lixo continua sendo null — o conserto não afrouxa a validação', () => {
    for (const ruim of ['', null, undefined, '123', '999999999999999', 'abc', '00 90000-0000', '11 09900-2121']) {
      expect(normalizePhoneBR(ruim as string), String(ruim)).toBeNull();
    }
  });

  it('DDD inválido segue rejeitado mesmo na forma curta', () => {
    expect(normalizePhoneBR('550997506635')).toBeNull(); // DDD 09
  });
});
