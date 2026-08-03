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
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  // A home não é onde o "Zap" costuma morar. Das 7 citações que a base tem
  // hoje, pelo menos duas vieram de /contato (grupograodeouro, coopama) — e
  // essas foram achadas por pesquisa manual, porque esta função só lia a home.
  // Era 6,7% de acerto em 105 tentativas: teto do método, não da base.
  for (const caminho of CAMINHOS_CANDIDATOS) {
    const alvo = new URL(caminho || parsed.pathname, parsed);
    const r = await buscarPagina(alvo);
    if (r.html) {
      const waPhone = extrairWhatsAppDeHtml(r.html);
      // A fonte cita a PÁGINA onde o link estava, não a home — a citação é a
      // prova, e prova que aponta pro lugar errado não é prova.
      if (waPhone) return { waPhone, fonte: alvo.href.slice(0, 300) };
    }
    // Host morto/inalcançável: insistir nos subcaminhos é queimar timeout por
    // nada. Página ausente (404) não diz nada sobre as outras — segue.
    if (r.hostMorto) return null;
  }
  return null;
}

/** Caminhos tentados, em ordem, até o primeiro link encontrado. */
const CAMINHOS_CANDIDATOS = ['', '/contato', '/fale-conosco', '/atendimento'];

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
    .select('id, name, city, status, phone, wa_phone_source, send_status, enrich_tried_at')
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
              textQuery: `${p.name} ${p.city ?? ''} MG`.trim(),
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
        const achado = await enriquecerDoSite(hit.websiteUri);
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
