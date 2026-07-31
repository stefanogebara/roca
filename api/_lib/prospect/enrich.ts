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

  try {
    const res = await fetch(parsed.href, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SteviBot/1.0; +https://roca-black.vercel.app)' },
    });
    if (!res.ok) return null;
    // Cap de tamanho lendo o stream: text() numa página gigante estoura memória
    // de function por causa de um site ruim.
    const reader = res.body?.getReader();
    if (!reader) return null;
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
    const waPhone = extrairWhatsAppDeHtml(html);
    return waPhone ? { waPhone, fonte: parsed.href.slice(0, 300) } : null;
  } catch (e) {
    log.info(`enrich fetch falhou (${parsed.hostname}): ${(e as Error).message}`);
    return null;
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
}

/**
 * Quem vale a consulta: ready/discovered, nunca enviado, telefone fixo cru e
 * sem enriquecimento prévio. Ready primeiro — é quem está a caminho do disparo.
 */
export function candidatosBackfill<T extends BackfillRow>(rows: T[], limite: number): T[] {
  const elegivel = (r: T): boolean =>
    (r.status === 'ready' || r.status === 'discovered') &&
    !r.send_status &&
    !r.wa_phone_source &&
    !!r.phone &&
    !isMobileBR(r.phone);
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
    .select('id, name, city, status, phone, wa_phone_source, send_status')
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
