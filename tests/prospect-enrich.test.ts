/**
 * Enriquecimento automático: achar o WhatsApp CITADO no site do prospect.
 *
 * Por que isso é a alavanca (medido em 30/jul, nos 42 envios reais): 8 dos 9
 * templates LIDOS foram para números enriquecidos (wa_phone com fonte) — leitura
 * de ~38% entre enriquecidos contra ~5% nos números crus do Places. O gargalo
 * do funil não era o texto: era mandar mensagem pra fixo de balcão que ninguém
 * olha. Até aqui o enriquecimento era manual (a pill "fixo — vale enriquecer").
 *
 * Filosofia do core (sendablePhone): wa_phone exige evidência POSITIVA citada.
 * Um link wa.me É essa evidência — o próprio negócio publicou "me chame neste
 * WhatsApp". Um tel: ou um celular solto no rodapé NÃO é (celular existe sem
 * WhatsApp), então o extrator deliberadamente os ignora: falso "zap confirmado"
 * é pior que nenhum, porque vira envio queimando reputação.
 */
import { describe, it, expect } from 'vitest';
import { extrairWhatsAppDeHtml } from '../api/_lib/prospect/enrich';

describe('extrairWhatsAppDeHtml — só evidência positiva', () => {
  it('acha o wa.me clássico', () => {
    expect(extrairWhatsAppDeHtml('<a href="https://wa.me/5535999887766">Fale conosco</a>')).toBe('+5535999887766');
  });

  it('acha wa.me com ?text= e sem protocolo', () => {
    expect(extrairWhatsAppDeHtml('<a href="wa.me/5535999887766?text=Ol%C3%A1">zap</a>')).toBe('+5535999887766');
  });

  it('acha api.whatsapp.com/send?phone=', () => {
    expect(
      extrairWhatsAppDeHtml('<a href="https://api.whatsapp.com/send?phone=5535988776655&text=oi">WhatsApp</a>')
    ).toBe('+5535988776655');
  });

  it('aceita FIXO citado — coccamig publica wa.me do próprio fixo', () => {
    // A citação é o que importa: 9 das nossas 14 entregas foram pra fixo.
    expect(extrairWhatsAppDeHtml('<a href="https://wa.me/553532142166">atendimento</a>')).toBe('+553532142166');
  });

  it('com vários links, prefere o CELULAR', () => {
    const html =
      '<a href="https://wa.me/553532142166">loja</a> <a href="https://wa.me/5535999887766">vendas</a>';
    expect(extrairWhatsAppDeHtml(html)).toBe('+5535999887766');
  });

  it('IGNORA tel: e celular solto no texto — não são prova de WhatsApp', () => {
    expect(extrairWhatsAppDeHtml('<a href="tel:+5535999887766">ligue</a> ou (35) 99988-7766')).toBeNull();
  });

  it('número inválido no wa.me não passa do normalizador', () => {
    expect(extrairWhatsAppDeHtml('<a href="https://wa.me/123">zap</a>')).toBeNull();
  });

  it('html sem nada devolve null, sem explodir', () => {
    expect(extrairWhatsAppDeHtml('<html><body>Bem-vindo à loja</body></html>')).toBeNull();
    expect(extrairWhatsAppDeHtml('')).toBeNull();
  });
});
