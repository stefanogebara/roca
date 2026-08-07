/**
 * De onde mais dá pra tirar um WhatsApp CITADO (07/ago).
 *
 * O diagnóstico que motivou isto: dos 9 alvos melhor pesquisados da base
 * (consultoria pequena, dono citável), **1** tem site próprio. O resto vive em
 * Instagram, Linktree e diretório. O extrator só sabia ler site, então a
 * máquina secou: 0 de 114 `ready` enviáveis, e o backfill automático rendeu
 * 6 citações em 215 tentativas (2,8%).
 *
 * A regra NÃO muda — e é ela que dá o desenho: só vale link publicado pelo
 * PRÓPRIO negócio (wa.me / api.whatsapp.com / whatsapp://). O que muda é onde
 * a gente procura. Micro-negócio agro põe o Zap no Linktree da bio, não num
 * site que ele não tem.
 *
 * Ordem por rendimento esperado, e cada fonte é um fetch com orçamento:
 *   site (home → subpáginas) → agregador de bio → Instagram/Facebook
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  classificarFonte,
  extrairFontesSecundarias,
  enriquecerContato,
} from '../api/_lib/prospect/enrich';

// ── Fixture de rede: mapa de URL completa → html ────────────────────────────
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

/** Registra as URLs pedidas, para provar orçamento e ordem. */
let pedidas: string[] = [];
const rede = (mapa: Record<string, string>) => {
  pedidas = [];
  vi.stubGlobal('fetch', async (url: string) => {
    pedidas.push(url);
    const chave = Object.keys(mapa).find((k) => url === k || url === k + '/' || url.replace(/\/$/, '') === k);
    if (chave === undefined) return { ok: false, status: 404, body: null };
    return { ok: true, status: 200, body: corpo(mapa[chave]) };
  });
};

const ZAP = '<a href="https://wa.me/5535999887766">Fala comigo no zap</a>';
afterEach(() => vi.unstubAllGlobals());

describe('classificarFonte — cada tipo de link pede um tratamento', () => {
  it('reconhece os agregadores de bio comuns no Brasil', () => {
    for (const u of [
      'https://linktr.ee/agroteste',
      'https://www.linktr.ee/agroteste',
      'https://beacons.ai/agroteste',
      'https://bio.link/agroteste',
      'https://campsite.bio/agroteste',
      'https://lnk.bio/agroteste',
    ]) {
      expect(classificarFonte(u), u).toBe('agregador');
    }
  });

  it('reconhece Instagram e Facebook, inclusive os hosts móveis', () => {
    expect(classificarFonte('https://www.instagram.com/msrural.consultoria/')).toBe('instagram');
    expect(classificarFonte('https://instagram.com/emerjconsultoria')).toBe('instagram');
    expect(classificarFonte('https://m.facebook.com/agroteste')).toBe('facebook');
    expect(classificarFonte('https://www.facebook.com/agroteste')).toBe('facebook');
  });

  it('qualquer outro http(s) é site', () => {
    expect(classificarFonte('https://gonzagaconsultoria.com/')).toBe('site');
  });

  it('lixo e protocolo estranho são inválidos — nunca viram fetch', () => {
    expect(classificarFonte('ftp://arquivo')).toBe('invalida');
    expect(classificarFonte('nao é url')).toBe('invalida');
    expect(classificarFonte('')).toBe('invalida');
  });
});

describe('extrairFontesSecundarias — o pulo do site para a bio', () => {
  it('acha Linktree, Instagram e Facebook no html', () => {
    const html = `
      <a href="https://linktr.ee/agroteste">Links</a>
      <a href="https://www.instagram.com/agroteste/">Insta</a>
      <a href="https://facebook.com/agroteste">Face</a>
      <a href="https://google.com">outro</a>`;
    const f = extrairFontesSecundarias(html, 'https://exemplo.com.br');
    expect(f).toContain('https://linktr.ee/agroteste');
    expect(f.some((u) => u.includes('instagram.com/agroteste'))).toBe(true);
    expect(f.some((u) => u.includes('google.com'))).toBe(false);
  });

  it('AGREGADOR VEM PRIMEIRO — é o que rende, IG quase sempre é muro de login', () => {
    const html = `
      <a href="https://www.instagram.com/agroteste/">Insta</a>
      <a href="https://linktr.ee/agroteste">Links</a>`;
    expect(classificarFonte(extrairFontesSecundarias(html, 'https://x.com.br')[0])).toBe('agregador');
  });

  it('resolve link relativo contra a base e não repete o mesmo destino', () => {
    const html = `<a href="//linktr.ee/agroteste">a</a><a href="https://linktr.ee/agroteste">b</a>`;
    const f = extrairFontesSecundarias(html, 'https://exemplo.com.br');
    expect(f.filter((u) => u.includes('linktr.ee')).length).toBe(1);
  });

  it('html sem nada devolve lista vazia, sem explodir', () => {
    expect(extrairFontesSecundarias('<p>oi</p>', 'https://x.com.br')).toEqual([]);
    expect(extrairFontesSecundarias('', 'https://x.com.br')).toEqual([]);
  });
});

describe('enriquecerContato — a cadeia inteira', () => {
  it('Linktree direto (o caso do Places que devolve a bio como site)', async () => {
    // Micro-negócio costuma cadastrar o Linktree como "site" no Google.
    rede({ 'https://linktr.ee/agroteste': ZAP });
    const r = await enriquecerContato('https://linktr.ee/agroteste');
    expect(r?.waPhone).toBe('+5535999887766');
    expect(r?.fonte).toContain('linktr.ee/agroteste');
  });

  it('site sem zap → pula pro Linktree que ele mesmo linka', async () => {
    rede({
      'https://exemplo.com.br': `<p>nada aqui</p><a href="https://linktr.ee/agroteste">meus links</a>`,
      'https://linktr.ee/agroteste': ZAP,
    });
    const r = await enriquecerContato('https://exemplo.com.br');
    expect(r?.waPhone).toBe('+5535999887766');
    // A citação aponta pra ONDE o link estava — quem for conferir tem que achar.
    expect(r?.fonte).toContain('linktr.ee/agroteste');
  });

  it('zap na home encerra — não gasta fetch em fonte secundária', async () => {
    rede({ 'https://exemplo.com.br': `${ZAP}<a href="https://linktr.ee/agroteste">links</a>` });
    const r = await enriquecerContato('https://exemplo.com.br');
    expect(r?.waPhone).toBe('+5535999887766');
    expect(pedidas.some((u) => u.includes('linktr.ee'))).toBe(false);
  });

  it('Instagram que devolve muro de login não inventa nada', async () => {
    rede({ 'https://www.instagram.com/agroteste': '<html>Login • Instagram</html>' });
    expect(await enriquecerContato('https://www.instagram.com/agroteste')).toBeNull();
  });

  it('mas Instagram que expõe wa.me na bio (og:description) conta', async () => {
    rede({
      'https://www.instagram.com/agroteste':
        '<meta property="og:description" content="Consultoria de café. Zap: https://wa.me/5535999887766">',
    });
    expect((await enriquecerContato('https://www.instagram.com/agroteste'))?.waPhone).toBe('+5535999887766');
  });

  it('ORÇAMENTO: a cadeia inteira não estoura o maxDuration da function', async () => {
    // Cada fetch tem timeout de 6s e a function tem 60s. Sem teto, um site com
    // 30 links de rede social viraria 30 fetches sequenciais e o backfill
    // morreria no meio, deixando a fila pela metade sem dizer por quê.
    const muitos = Array.from({ length: 12 }, (_, i) => `<a href="https://linktr.ee/a${i}">l${i}</a>`).join('');
    rede({ 'https://exemplo.com.br': `<p>nada</p>${muitos}` });
    await enriquecerContato('https://exemplo.com.br');
    expect(pedidas.length).toBeLessThanOrEqual(8);
  });

  it('host morto não vira quatro timeouts', async () => {
    let n = 0;
    vi.stubGlobal('fetch', async () => {
      n++;
      throw new Error('ENOTFOUND');
    });
    expect(await enriquecerContato('https://morto.com.br')).toBeNull();
    expect(n).toBe(1);
  });

  it('url inválida não vira fetch nenhum', async () => {
    rede({});
    expect(await enriquecerContato('não é url')).toBeNull();
    expect(pedidas.length).toBe(0);
  });

  it('a regra NÃO afrouxou: tel: no Linktree continua não sendo prova', async () => {
    rede({ 'https://linktr.ee/agroteste': '<a href="tel:+5535999887766">Ligue</a>' });
    expect(await enriquecerContato('https://linktr.ee/agroteste')).toBeNull();
  });
});
