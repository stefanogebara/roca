/**
 * Enriquecimento automático de WhatsApp a partir do site do prospect.
 *
 * A alavanca, medida nos 42 envios reais (30/jul): 8 dos 9 templates LIDOS
 * foram para números enriquecidos — ~38% de leitura entre enriquecidos contra
 * ~5% nos números crus do Places. O funil não morria no texto; morria em fixo
 * de balcão que ninguém olha. Enriquecer era manual; isto automatiza no
 * sourcing.
 *
 * Regra do core (sendablePhone): wa_phone exige evidência POSITIVA e citada.
 * Só contam links de WhatsApp publicados pelo próprio negócio (wa.me,
 * api.whatsapp.com, whatsapp://) — tel: e celular solto em texto ficam de fora
 * de propósito: celular existe sem WhatsApp, e um falso "zap confirmado" vira
 * envio que queima a reputação do nosso número.
 */

import { normalizePhoneBR, isMobileBR } from './core';
import { getDb } from '../db';
import { withRetry } from '../retry';
import { createLogger } from '../logger';

const log = createLogger('prospect-enrich');

// Links que o próprio negócio publica apontando pro WhatsApp dele.
const WA_LINK_RE =
  /(?:https?:\/\/)?(?:wa\.me\/|api\.whatsapp\.com\/send\/?\?[^"'\s>]*?phone=|whatsapp:\/\/send\/?\?[^"'\s>]*?phone=)\+?(\d{10,15})/gi;

/**
 * Extrai o WhatsApp citado num HTML. Vários links: prefere celular (entrega
 * medida maior), senão o primeiro válido. Null quando não há evidência.
 */
export function extrairWhatsAppDeHtml(html: string): string | null {
  const achados: string[] = [];
  for (const m of (html ?? '').matchAll(WA_LINK_RE)) {
    const norm = normalizePhoneBR(m[1]);
    if (norm && !achados.includes(norm)) achados.push(norm);
  }
  if (!achados.length) return null;
  return achados.find(isMobileBR) ?? achados[0];
}

const FETCH_TIMEOUT_MS = 6_000;
const MAX_HTML_BYTES = 300_000;

/**
 * Busca o site e procura o WhatsApp citado. Fail-soft por construção: site
 * fora do ar, lento ou gigante devolve null e o sourcing segue — enriquecer é
 * bônus, nunca bloqueio.
 */
export async function enriquecerDoSite(url: string): Promise<{ waPhone: string; fonte: string } | null> {
  return (await caminharSite(url)).achado;
}

/**
 * A caminhada pelo site, com o que a cadeia maior precisa saber depois dela.
 *
 * Devolve o HTML da home junto porque `enriquecerContato` precisa dele para
 * achar o Linktree da bio — e buscá-lo de novo seria um fetch a mais por
 * prospect sem site com Zap, que é justamente o caso comum. `hostMorto`
 * atravessa pelo mesmo motivo: host que não responde não merece uma segunda
 * perna de tentativas.
 */
interface CaminhadaSite {
  achado: { waPhone: string; fonte: string } | null;
  homeHtml: string | null;
  hostMorto: boolean;
}

async function caminharSite(url: string): Promise<CaminhadaSite> {
  const vazio: CaminhadaSite = { achado: null, homeHtml: null, hostMorto: false };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return vazio;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return vazio;
  let homeHtml: string | null = null;

  // HIPÓTESE NÃO CONFIRMADA — mantida de propósito, mas não a trate como fato.
  //
  // Duas das 7 citações históricas moram em /contato (grupograodeouro, coopama),
  // então presumi que ler além da home destravaria o enriquecimento. Medido no
  // backfill de 03/ago: das 11 citações novas, **11 vieram da home e ZERO de
  // subpágina**, em 142 consultas. Quem de fato rendeu foi outra mudança da
  // mesma leva — tirar o filtro por classe de número do candidatosBackfill.
  //
  // Provável explicação: site que publica Zap costuma ter o botão flutuante na
  // home também, e /contato de muitos é renderizado em JS (o HTML cru não traz
  // o link). Os dois casos históricos vieram de pesquisa manual mais funda.
  //
  // Ficam como seguro barato: só disparam quando a home não tem link, são
  // fail-soft e abortam em host morto. Se um dia custarem latência que importe,
  // este é o primeiro lugar a cortar — não há evidência defendendo eles.
  for (const caminho of CAMINHOS_CANDIDATOS) {
    const alvo = new URL(caminho || parsed.pathname, parsed);
    const r = await buscarPagina(alvo);
    if (r.html) {
      if (homeHtml === null) homeHtml = r.html; // a primeira que responde é a home
      const waPhone = extrairWhatsAppDeHtml(r.html);
      // A fonte cita a PÁGINA onde o link estava, não a home — a citação é a
      // prova, e prova que aponta pro lugar errado não é prova.
      if (waPhone) return { achado: { waPhone, fonte: alvo.href.slice(0, 300) }, homeHtml, hostMorto: false };
    }
    // Host morto/inalcançável: insistir nos subcaminhos é queimar timeout por
    // nada. Página ausente (404) não diz nada sobre as outras — segue.
    if (r.hostMorto) return { achado: null, homeHtml, hostMorto: true };
  }
  return { achado: null, homeHtml, hostMorto: false };
}

/** Caminhos tentados, em ordem, até o primeiro link encontrado. */
const CAMINHOS_CANDIDATOS = ['', '/contato', '/fale-conosco', '/atendimento'];

// ── Fontes além do site: bio-link, Instagram, Facebook ──────────────────────
//
// Por que isto existe (07/ago): dos 9 alvos melhor pesquisados da base
// (consultoria pequena, dono citável), UM tem site próprio. O resto vive em
// Instagram, Linktree e diretório de terceiros. Como `enriquecerDoSite` só
// sabia ler site, a máquina secou — 0 de 114 `ready` enviáveis, e o backfill
// automático rendeu 6 citações em 215 tentativas (2,8%).
//
// A regra do `sendablePhone` NÃO afrouxa, e é ela que dá o desenho: continua
// valendo só link publicado pelo PRÓPRIO negócio. O que muda é ONDE procurar.
// Micro-negócio agro não tem site; ele tem um Linktree na bio do Instagram com
// o botão de WhatsApp em cima.

/** Agregadores de bio-link. Página estática, um fetch, alto rendimento. */
const AGREGADORES = new Set([
  'linktr.ee', 'linktree.com', 'beacons.ai', 'bio.link', 'campsite.bio',
  'linkbio.co', 'lnk.bio', 'solo.to', 'linkme.bio', 'bio.site', 'many.link',
  'znap.link', 'flowpage.com', 'linkfly.to', 'linklist.bio',
]);

export type TipoDeFonte = 'site' | 'agregador' | 'instagram' | 'facebook' | 'invalida';

/** Que tipo de fonte é esta URL. `invalida` nunca vira fetch. */
export function classificarFonte(url: string): TipoDeFonte {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return 'invalida';
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'invalida';
  const host = u.hostname.replace(/^(www\.|m\.)/, '').toLowerCase();
  if (AGREGADORES.has(host)) return 'agregador';
  if (host === 'instagram.com') return 'instagram';
  if (host === 'facebook.com' || host === 'fb.com') return 'facebook';
  return 'site';
}

/**
 * Quantas fontes secundárias vale a pena seguir. Cada uma é um fetch de até 6s
 * e a function tem 60s; a cadeia já gastou até 4 no site. Teto de 3 mantém o
 * pior caso em ~7 fetches. Sem teto, um site com 30 ícones de rede social
 * viraria 30 fetches sequenciais e o backfill morreria no meio da fila.
 */
const MAX_FONTES_SECUNDARIAS = 3;

/**
 * Links de bio/rede social achados num HTML, absolutos e sem repetição.
 *
 * Ordem por RENDIMENTO ESPERADO, não por ordem de aparição: agregador primeiro
 * (página estática, o botão de Zap costuma estar lá), depois Instagram e
 * Facebook — que na prática quase sempre devolvem muro de login, mas custam um
 * fetch limitado e de vez em quando trazem o wa.me no og:description.
 */
export function extrairFontesSecundarias(html: string, base: string): string[] {
  const peso: Record<string, number> = { agregador: 0, instagram: 1, facebook: 2 };
  const achados: Array<{ url: string; ordem: number }> = [];
  const vistos = new Set<string>();
  for (const m of (html ?? '').matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    let abs: string;
    try {
      abs = new URL(m[1], base).href;
    } catch {
      continue;
    }
    const tipo = classificarFonte(abs);
    if (tipo !== 'agregador' && tipo !== 'instagram' && tipo !== 'facebook') continue;
    // Dedup pelo DESTINO, não pela string: "//linktr.ee/x" e
    // "https://linktr.ee/x" são o mesmo fetch.
    const chave = abs.replace(/^https?:\/\/(www\.|m\.)?/, '').replace(/\/$/, '').toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    achados.push({ url: abs, ordem: peso[tipo] });
  }
  return achados.sort((a, b) => a.ordem - b.ordem).map((a) => a.url);
}

/**
 * A cadeia inteira: site → subpáginas → bio-link/rede social.
 *
 * Substitui `enriquecerDoSite` nos chamadores (sourcing e backfill). Ela
 * continua exportada e é a primeira perna desta cadeia — o que mudou é que
 * agora existe uma segunda perna quando o negócio não tem site com Zap.
 *
 * Fail-soft do começo ao fim: qualquer perna que falhe devolve null e a
 * próxima segue. Enriquecer é bônus, nunca bloqueio de sourcing.
 */
export async function enriquecerContato(
  urlInicial: string
): Promise<{ waPhone: string; fonte: string } | null> {
  const tipo = classificarFonte(urlInicial);
  if (tipo === 'invalida') return null;

  // Agregador/rede social como ponto de partida: página única, sem subcaminhos
  // que façam sentido (linktr.ee/x/contato não existe). Um fetch e pronto.
  if (tipo !== 'site') {
    const r = await buscarPagina(new URL(urlInicial));
    if (!r.html) return null;
    const waPhone = extrairWhatsAppDeHtml(r.html);
    return waPhone ? { waPhone, fonte: urlInicial.slice(0, 300) } : null;
  }

  // Perna 1: o site (home + subcaminhos), exatamente como antes.
  const site = await caminharSite(urlInicial);
  if (site.achado) return site.achado;
  // Host que não respondeu não ganha segunda perna: seria queimar mais timeout
  // no mesmo silêncio. E a home já veio da perna 1 — nenhum fetch repetido.
  if (site.hostMorto || !site.homeHtml) return null;

  // Perna 2: o que a home dele aponta (Linktree da bio, Instagram, Facebook).
  for (const fonte of extrairFontesSecundarias(site.homeHtml, urlInicial).slice(0, MAX_FONTES_SECUNDARIAS)) {
    const r = await buscarPagina(new URL(fonte));
    if (!r.html) continue;
    const waPhone = extrairWhatsAppDeHtml(r.html);
    // A citação aponta pra ONDE o link estava: quem for conferir precisa achar
    // o Zap naquela página, não na home que só linkava pra ela.
    if (waPhone) return { waPhone, fonte: fonte.slice(0, 300) };
  }
  return null;
}

/**
 * Uma página. `hostMorto` separa "site fora do ar" de "essa página não existe":
 * o primeiro condena as tentativas seguintes, o segundo não diz nada sobre elas.
 */
async function buscarPagina(alvo: URL): Promise<{ html: string | null; hostMorto: boolean }> {
  try {
    const res = await fetch(alvo.href, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SteviBot/1.0; +https://roca-black.vercel.app)' },
    });
    // 4xx/5xx é sobre ESTA página; o host respondeu, então não condena as
    // outras. Só o catch (DNS, conexão, timeout) fala do host.
    if (!res.ok) return { html: null, hostMorto: false };
    // Cap de tamanho lendo o stream: text() numa página gigante estoura memória
    // de function por causa de um site ruim.
    const reader = res.body?.getReader();
    if (!reader) return { html: null, hostMorto: false };
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
    void reader.cancel().catch(() => undefined);
    const html = new TextDecoder('utf-8', { fatal: false }).decode(
      chunks.length === 1 ? chunks[0] : concat(chunks, total)
    );
    return { html, hostMorto: false };
  } catch (e) {
    log.info(`enrich fetch falhou (${alvo.hostname}${alvo.pathname}): ${(e as Error).message}`);
    return { html: null, hostMorto: true };
  }
}

// ── Backfill da fila velha ──────────────────────────────────────────────────
// O sourcing novo enriquece na ENTRADA; quem entrou antes (31/jul: 44 fixos
// crus na fila) fica pra trás e segue tropeçando em número sem WhatsApp — 5
// dos 6 convites de 31/jul falharam assim. O backfill re-consulta o Places
// pelo nome pra achar o site e roda o mesmo extrator.

/** O mínimo que uma linha precisa expor pra seleção do backfill. */
export interface BackfillRow {
  id: string;
  name: string;
  city: string | null;
  /** UF do prospect — a query de reencontro no Places usa cidade+UF reais;
   * 'MG' fixo mandava buscar "Franca MG" para prospect paulista. */
  uf?: string | null;
  status: string;
  phone: string | null;
  wa_phone_source: string | null;
  send_status: string | null;
  /** Ultima tentativa de backfill — com ou sem sucesso. Sem esta marca, cada
   * rodada re-consultava os mesmos fracassos (visto ao vivo em 31/jul). */
  enrich_tried_at?: string | null;
}

/** Depois de 30 dias vale tentar de novo: site novo aparece. */
const RETENTATIVA_MS = 30 * 86_400_000;

/**
 * Quem vale a consulta: ready/discovered, nunca enviado, com telefone (âncora
 * do gate mesmoNegocio) e SEM citação. Ready primeiro — é quem está a caminho
 * do disparo.
 *
 * Não filtra mais por classe de número. O `!isMobileBR` daqui presumia que
 * celular cru já era enviável; desde o corte de 03/ago (sendablePhone) o que
 * habilita é a CITAÇÃO, então celular sem citação precisa de enriquecimento
 * igual ao fixo — são 62 na base, que estavam invisíveis pra este backfill.
 * É a mesma lição de 27/jul, terceira vez: o eixo é a evidência sobre aquele
 * número, nunca a classe dele.
 */
export function candidatosBackfill<T extends BackfillRow>(rows: T[], limite: number, now: Date = new Date()): T[] {
  const elegivel = (r: T): boolean =>
    (r.status === 'ready' || r.status === 'discovered') &&
    !r.send_status &&
    !r.wa_phone_source &&
    !!r.phone &&
    (!r.enrich_tried_at || now.getTime() - Date.parse(r.enrich_tried_at) > RETENTATIVA_MS);
  return rows
    .filter(elegivel)
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'ready' ? -1 : 1))
    .slice(0, Math.max(0, limite));
}

/**
 * Gate de identidade: o hit do Places é a MESMA empresa?
 *
 * Âncora é o telefone, nunca o nome: duas "Agro Center" na mesma cidade são
 * negócios diferentes, e gravar o WhatsApp do errado vira template indo pra
 * quem nunca ouviu falar da gente. Sem telefone no hit, sem match — conservador
 * por construção.
 */
export function mesmoNegocio(nosso: string | null | undefined, doHit: string | null | undefined): boolean {
  const a = normalizePhoneBR(nosso);
  const b = normalizePhoneBR(doHit);
  return !!a && !!b && a === b;
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c.subarray(0, Math.min(c.byteLength, total - off)), off);
    off += c.byteLength;
    if (off >= total) break;
  }
  return out;
}

// Consultas por rodada do backfill. Todas em paralelo: 15 buscas no Places +
// até 15 fetches de site (timeout 6s cada) cabem no maxDuration de 60s da
// function com folga. Rodadas repetidas cobrem o resto da fila.
const BACKFILL_POR_RODADA = 15;

export interface BackfillReport {
  configurado: boolean;
  candidatos: number;
  consultados: number;
  /** Places confirmou a MESMA empresa (telefone bateu) e tinha site. */
  comSite: number;
  enriquecidos: number;
  exemplos: string[];
  error?: string;
}

/**
 * Re-consulta o Places pelo nome de quem já está na base com fixo cru, acha o
 * site, roda o extrator de wa.me e grava o número citado. O gate mesmoNegocio
 * (telefone) impede enriquecer com o WhatsApp de outra empresa.
 */
export async function runBackfill(limite = BACKFILL_POR_RODADA): Promise<BackfillReport> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return {
      configurado: false, candidatos: 0, consultados: 0, comSite: 0, enriquecidos: 0, exemplos: [],
      error: 'GOOGLE_PLACES_API_KEY não configurada — o backfill roda só em produção.',
    };
  }
  const db = getDb();
  const { data, error } = await db
    .from('prospects')
    .select('id, name, city, uf, status, phone, wa_phone_source, send_status, enrich_tried_at')
    .in('status', ['ready', 'discovered']);
  if (error) {
    return {
      configurado: true, candidatos: 0, consultados: 0, comSite: 0, enriquecidos: 0, exemplos: [],
      error: `não consegui ler a fila: ${error.message}`,
    };
  }

  const alvos = candidatosBackfill((data ?? []) as BackfillRow[], limite);
  let comSite = 0;
  let enriquecidos = 0;
  const exemplos: string[] = [];

  await Promise.all(
    alvos.map(async (p) => {
      try {
        const res = await withRetry(() =>
          fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': 'places.displayName,places.nationalPhoneNumber,places.websiteUri',
            },
            body: JSON.stringify({
              textQuery: `${p.name} ${p.city ?? ''} ${p.uf ?? 'MG'}`.trim(),
              languageCode: 'pt-BR',
              regionCode: 'BR',
              pageSize: 3,
            }),
          })
        );
        if (!res.ok) return;
        const body = (await res.json()) as {
          places?: Array<{ nationalPhoneNumber?: string; websiteUri?: string }>;
        };
        // O gate: só o hit cujo TELEFONE bate é a mesma empresa.
        const hit = (body.places ?? []).find((h) => mesmoNegocio(p.phone, h.nationalPhoneNumber ?? null));
        if (!hit?.websiteUri) return;
        comSite++;
        const achado = await enriquecerContato(hit.websiteUri);
        if (!achado) return;
        const upd = await db
          .from('prospects')
          .update({ wa_phone: achado.waPhone, wa_phone_source: achado.fonte, updated_at: new Date().toISOString() })
          .eq('id', p.id);
        if (upd.error) {
          log.error(`backfill update falhou (${p.name}):`, upd.error.message);
          return;
        }
        enriquecidos++;
        if (exemplos.length < 8) exemplos.push(p.name);
      } catch (e) {
        log.info(`backfill pulou ${p.name}: ${(e as Error).message}`);
      }
    })
  );

  // Marca de tentativa em TODOS os consultados, com ou sem achado — e o que
  // faz "clique de novo" avancar pela fila em vez de andar em circulo.
  if (alvos.length) {
    const marca = await db
      .from('prospects')
      .update({ enrich_tried_at: new Date().toISOString() })
      .in('id', alvos.map((p) => p.id));
    if (marca.error) log.error('backfill: marca de tentativa falhou:', marca.error.message);
  }

  const report: BackfillReport = {
    configurado: true,
    candidatos: alvos.length,
    consultados: alvos.length,
    comSite,
    enriquecidos,
    exemplos,
  };
  log.info(`backfill: ${JSON.stringify(report)}`);
  return report;
}
