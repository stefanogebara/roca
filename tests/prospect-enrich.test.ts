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
import { extrairWhatsAppDeHtml, candidatosBackfill, mesmoNegocio } from '../api/_lib/prospect/enrich';

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

/**
 * Backfill da fila velha — enriquecer quem JÁ está na base.
 *
 * Por quê: 31/jul, 6 convites saíram e 5 bateram em número sem WhatsApp — tudo
 * fila antiga, importada antes do enriquecimento existir (44 fixos crus). O
 * sourcing novo enriquece na entrada; o backfill re-consulta o Places pelo nome
 * pra achar o site de quem já está dentro.
 *
 * O risco central: casar com OUTRA empresa e gravar o WhatsApp do negócio
 * errado — que depois vira template indo pra quem nunca ouviu falar da gente.
 * Por isso o gate é TELEFONE, não nome: só aceitamos o hit do Places se o
 * número dele bater com o que já temos na linha. Nome parecido não basta.
 */
describe('backfill — seleção de candidatos', () => {
  const row = (over = {}) => ({
    id: 'x', name: 'Agro Teste', city: 'Lavras', status: 'ready',
    phone: '+553538211234', wa_phone_source: null, send_status: null, ...over,
  });

  it('seleciona ready/discovered com fixo cru, nunca já-enriquecido', () => {
    const rows = [
      row({ id: 'fixo-ready' }),
      row({ id: 'ja-enriquecido', wa_phone_source: 'https://site.com' }),
      row({ id: 'celular', phone: '+5535999887766' }),
      row({ id: 'ja-enviado', send_status: 'sent' }),
      row({ id: 'descoberto', status: 'discovered' }),
      row({ id: 'descartado', status: 'discarded' }),
    ];
    expect(candidatosBackfill(rows, 10).map((r) => r.id)).toEqual(['fixo-ready', 'descoberto']);
  });

  it('ready vem antes de discovered — a fila de disparo é quem manda', () => {
    const rows = [row({ id: 'b', status: 'discovered' }), row({ id: 'a' })];
    expect(candidatosBackfill(rows, 10).map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('respeita o limite por rodada', () => {
    const rows = Array.from({ length: 9 }, (_, i) => row({ id: 'r' + i }));
    expect(candidatosBackfill(rows, 3)).toHaveLength(3);
  });
});

describe('backfill — gate de identidade por telefone', () => {
  it('aceita quando o telefone do Places bate com o nosso', () => {
    expect(mesmoNegocio('+553538211234', '(35) 3821-1234')).toBe(true);
  });

  it('recusa telefone diferente — nome parecido não é a mesma empresa', () => {
    expect(mesmoNegocio('+553538211234', '(35) 3821-9999')).toBe(false);
  });

  it('recusa quando o Places não traz telefone — sem âncora, sem match', () => {
    expect(mesmoNegocio('+553538211234', null)).toBe(false);
    expect(mesmoNegocio(null, '(35) 3821-1234')).toBe(false);
  });
});
