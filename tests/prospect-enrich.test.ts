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
import { afterEach, describe, expect, it, vi } from 'vitest';
import { extrairWhatsAppDeHtml, candidatosBackfill, mesmoNegocio, enriquecerDoSite } from '../api/_lib/prospect/enrich';

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

  /**
   * NÚMERO FORMATADO DENTRO DO LINK — o buraco que custou a Gonzaga (07/ago).
   *
   * O site dela (Wix) publica, literalmente:
   *   href="https://api.whatsapp.com/send?phone=+55 35 9943-2449"
   * Com espaços e traço DENTRO da URL. O regex antigo casava só `\d{10,15}`
   * colado, então esse link era invisível — e Wix é o que negócio pequeno usa.
   * Achei porque o smoke contra a web real voltou null num site que eu tinha
   * conferido à mão minutos antes.
   *
   * Quem valida continua sendo o normalizePhoneBR (que já joga fora tudo que
   * não é dígito). O extrator só precisa parar de descartar o link antes disso.
   */
  it('aceita o número FORMATADO dentro do link (caso real Gonzaga/Wix)', () => {
    expect(
      extrairWhatsAppDeHtml('<a href="https://api.whatsapp.com/send?phone=+55 35 9943-2449">Zap</a>')
    ).toBe('+5535999432449');
  });

  it('aceita o mesmo link percent-encoded (%2B / %20)', () => {
    expect(
      extrairWhatsAppDeHtml('<a href="https://api.whatsapp.com/send?phone=%2B55%2035%209943-2449">Zap</a>')
    ).toBe('+5535999432449');
  });

  it('aceita wa.me com o número formatado', () => {
    expect(extrairWhatsAppDeHtml('<a href="https://wa.me/55 35 99988-7766">zap</a>')).toBe('+5535999887766');
  });

  it('NÃO engole o resto da URL — ?text= não entra no número', () => {
    // O risco de afrouxar o regex: capturar "5535999887766?text=Ola" e virar
    // lixo. O `?` corta, e a classe só aceita dígito/espaço/traço/ponto/parêntese.
    expect(
      extrairWhatsAppDeHtml('<a href="https://wa.me/5535999887766?text=Ola%20tudo%20bem">zap</a>')
    ).toBe('+5535999887766');
  });

  it('NÃO inventa número a partir de texto solto depois do link', () => {
    expect(
      extrairWhatsAppDeHtml('<a href="https://wa.me/">vazio</a> ligue 35 3333-4444 das 8 às 18')
    ).toBeNull();
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

  it('seleciona ready/discovered SEM citação, nunca já-enriquecido', () => {
    const rows = [
      row({ id: 'fixo-ready' }),
      row({ id: 'ja-enriquecido', wa_phone_source: 'https://site.com' }),
      row({ id: 'celular', phone: '+5535999887766' }),
      row({ id: 'ja-enviado', send_status: 'sent' }),
      row({ id: 'descoberto', status: 'discovered' }),
      row({ id: 'descartado', status: 'discarded' }),
      row({ id: 'sem-telefone', phone: null }),
    ];
    // MUDANÇA DELIBERADA (03/ago): 'celular' agora ENTRA. O filtro por classe
    // presumia que celular cru já era enviável; desde o corte do sendablePhone
    // o que habilita é a citação, e celular sem citação precisa de
    // enriquecimento igual ao fixo (62 na base estavam invisíveis aqui).
    expect(candidatosBackfill(rows, 10).map((r) => r.id))
      .toEqual(['fixo-ready', 'celular', 'descoberto']);
  });

  it('sem telefone não entra — é a âncora do gate mesmoNegocio', () => {
    expect(candidatosBackfill([row({ id: 'nulo', phone: null })], 10)).toEqual([]);
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

describe('backfill — memória de tentativa (o bug da leva 2)', () => {
  // Visto ao vivo em 31/jul: a leva 1 consultou 15 e enriqueceu 1; a leva 2
  // re-consultou os MESMOS 14 fracassos e devolveu 0. Sem marca de tentativa,
  // "clique de novo pra continuar" era promessa falsa e quota em círculo.
  const agora = new Date('2026-07-31T12:00:00Z');
  const row = (over = {}) => ({
    id: 'x', name: 'Agro Teste', city: 'Lavras', status: 'ready',
    phone: '+553538211234', wa_phone_source: null, send_status: null,
    enrich_tried_at: null, ...over,
  });

  it('pula quem já foi tentado há pouco', () => {
    const rows = [
      row({ id: 'nunca-tentado' }),
      row({ id: 'tentado-ontem', enrich_tried_at: '2026-07-30T12:00:00Z' }),
    ];
    expect(candidatosBackfill(rows, 10, agora).map((r) => r.id)).toEqual(['nunca-tentado']);
  });

  it('re-tenta depois de 30 dias — site novo aparece', () => {
    const rows = [row({ id: 'tentado-ha-2-meses', enrich_tried_at: '2026-05-20T12:00:00Z' })];
    expect(candidatosBackfill(rows, 10, agora).map((r) => r.id)).toEqual(['tentado-ha-2-meses']);
  });
});

/**
 * Os caminhos candidatos. Este é o conserto do balde: até 03/ago a função lia
 * SÓ a home, e das 7 citações que a base tem, pelo menos duas moram em /contato
 * (grupograodeouro, coopama) — achadas por pesquisa manual, não por ela. O
 * acerto era 6,7% em 105 tentativas: teto do método, não da base.
 */
describe('enriquecerDoSite — procura além da home', () => {
  const paginas = (mapa: Record<string, string>) =>
    vi.stubGlobal('fetch', async (url: string) => {
      const path = new URL(url).pathname;
      const html = mapa[path];
      if (html === undefined) return { ok: false, status: 404, body: null };
      return { ok: true, status: 200, body: corpo(html) };
    });

  /** ReadableStream mínimo, como o código lê via getReader(). */
  const corpo = (html: string) => {
    const bytes = new TextEncoder().encode(html);
    let entregue = false;
    return {
      getReader: () => ({
        read: async () =>
          entregue ? { done: true, value: undefined } : ((entregue = true), { done: false, value: bytes }),
        cancel: async () => undefined,
      }),
    };
  };

  const ZAP = '<a href="https://wa.me/5535999887766">Zap</a>';
  afterEach(() => vi.unstubAllGlobals());

  it('acha na home e nem tenta os outros caminhos', async () => {
    paginas({ '/': ZAP });
    const r = await enriquecerDoSite('https://exemplo.com.br/');
    expect(r?.waPhone).toBe('+5535999887766');
    expect(r?.fonte).toContain('exemplo.com.br');
  });

  it('home sem link → acha em /contato (o caso grupograodeouro)', async () => {
    paginas({ '/': '<p>bem-vindo</p>', '/contato': ZAP });
    const r = await enriquecerDoSite('https://exemplo.com.br/');
    expect(r?.waPhone).toBe('+5535999887766');
  });

  it('a fonte cita a PÁGINA onde o link estava, não a home', async () => {
    // Prova que aponta pro lugar errado não é prova: quem for conferir a
    // citação precisa achar o link lá.
    paginas({ '/': '<p>nada</p>', '/contato': ZAP });
    const r = await enriquecerDoSite('https://exemplo.com.br/');
    expect(r?.fonte).toContain('/contato');
  });

  it('tenta /fale-conosco quando /contato não existe', async () => {
    paginas({ '/': '<p>nada</p>', '/fale-conosco': ZAP });
    expect((await enriquecerDoSite('https://exemplo.com.br/'))?.waPhone).toBe('+5535999887766');
  });

  it('nenhum caminho tem link → null, sem explodir', async () => {
    paginas({ '/': '<p>nada</p>', '/contato': '<p>nada</p>' });
    expect(await enriquecerDoSite('https://exemplo.com.br/')).toBeNull();
  });

  it('host morto aborta os caminhos seguintes — não queima 4 timeouts', async () => {
    let tentativas = 0;
    vi.stubGlobal('fetch', async () => {
      tentativas++;
      throw new Error('ENOTFOUND');
    });
    expect(await enriquecerDoSite('https://morto.com.br/')).toBeNull();
    expect(tentativas).toBe(1);
  });

  it('404 na home NÃO aborta — a página seguinte ainda pode ter', async () => {
    paginas({ '/contato': ZAP }); // home devolve 404
    expect((await enriquecerDoSite('https://exemplo.com.br/'))?.waPhone).toBe('+5535999887766');
  });
});
