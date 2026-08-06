/**
 * In-product prospect sourcing — the discovery half of the funnel, automated.
 * Queries Google Places (Text Search, New API) for the ICP: agronomy
 * consultancies, revendas and cooperative branches across the Sul de Minas
 * city list, maps results to ProspectInput (phones validated by the P1 core,
 * never fabricated) and imports them as `discovered` for painel review.
 *
 * Numbers come from Google Business listings — publicly advertised business
 * contacts (the LGPD-safe class). Env-gated on GOOGLE_PLACES_API_KEY; without
 * it the ops action explains what to configure instead of failing silently.
 */

import { normalizePhoneBR, isMobileBR } from './core';
import { importProspects, type ProspectInput } from './db';
import { motivoForaDoICP } from './icp';
import { enriquecerDoSite } from './enrich';
import { withRetry } from '../retry';
import { createLogger } from '../logger';

const log = createLogger('prospect-source');

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';

// Sites consultados por rodada. 12 em paralelo cabem com folga no maxDuration
// da function (fetch individual tem timeout de 6s — ver enrich.ts).
const MAX_ENRICH_PER_RUN = 12;

/** The ICP search grid: what × where. Kept small per run (quota-friendly). */
export const ICP_QUERIES: Array<{ kind: string; term: string }> = [
  { kind: 'consultoria', term: 'consultoria agronômica' },
  { kind: 'consultoria', term: 'consultoria agrícola café' },
  { kind: 'revenda', term: 'revenda agrícola' },
  // NÃO usar 'agropecuária' solto: no Brasil isso é ração/pet/veterinário na
  // fachada, e o Places devolve pet shop. Em 29/jul uma loja só de pecuária
  // recebeu template de café e respondeu "agrícola não trabalhamos".
  { kind: 'revenda', term: 'revenda de insumos agrícolas' },
  { kind: 'revenda', term: 'loja de defensivos agrícolas' },
  { kind: 'cooperativa', term: 'cooperativa de cafeicultores' },
];

/**
 * A grade de municípios. TODA entrada carrega a UF: "Monte Santo" existe na
 * Bahia e "Campos Gerais" no Paraná — sem o estado o Places devolve negócio de
 * outra região e o disparo sai do Sul de Minas.
 *
 * As 12 primeiras são a grade original (25/jul). Em 04/ago elas se esgotaram —
 * 15 a 42 prospects cada, e o dedup passou a comer 100% de toda busca nova.
 * Grade esgotada não se conserta com rotação; se conserta com território. As 14
 * seguintes são municípios cafeeiros do Sul de Minas e da Mogiana paulista que
 * nunca foram varridos, escolhidos por peso na cafeicultura da região.
 */
export const ICP_CITIES = [
  // Grade original (25/jul) — já esgotada, mas fica: o Places renova listagens
  // e a rotação volta aqui a cada ~26 dias.
  'Varginha MG', 'Três Pontas MG', 'Guaxupé MG', 'Alfenas MG', 'Machado MG',
  'Poços de Caldas MG', 'Lavras MG', 'Nepomuceno MG', 'Boa Esperança MG',
  'Campos Gerais MG', 'Carmo de Minas MG', 'São Gonçalo do Sapucaí MG',
  // Expansão 04/ago — Sul de Minas cafeeiro, nunca varridos.
  'Três Corações MG', 'São Sebastião do Paraíso MG', 'Muzambinho MG',
  'Monte Santo de Minas MG', 'Cabo Verde MG', 'Botelhos MG', 'Andradas MG',
  'Santo Antônio do Amparo MG', 'Perdões MG', 'Cambuquira MG',
  'Elói Mendes MG', 'Paraguaçu MG',
  // Mogiana paulista — mesma cultura, mesma dor, fronteira contígua à base.
  'Franca SP', 'São João da Boa Vista SP',
];

export interface PlaceHit {
  name: string;
  phone: string | null;
  city: string | null;
  /** UF extraída do endereço do Places, no mesmo match da cidade. */
  uf: string | null;
  source: string;
  /** Site do negócio (Places websiteUri) — insumo do enriquecimento. */
  website: string | null;
}

/**
 * Compose the Places text queries for one run (bounded).
 *
 * `offset` rotaciona a janela de cidades. Sem ele, toda rodada varria as MESMAS
 * 4 primeiras da lista — Varginha, Três Pontas, Guaxupé e Alfenas desde 25/jul,
 * e as outras oito NUNCA. O dedup descartava quase tudo e a busca parecia
 * esgotada quando nunca tinha saído do mesmo quadrante.
 */
export function buildQueries(
  cities: string[] = ICP_CITIES,
  maxCities = 4,
  offset = 0
): Array<{ kind: string; q: string; city: string; uf: string }> {
  const out: Array<{ kind: string; q: string; city: string; uf: string }> = [];
  const n = cities.length;
  const janela = n
    ? Array.from({ length: Math.min(maxCities, n) }, (_, i) => cities[(offset + i) % n])
    : [];
  for (const city of janela) {
    // A UF vem do sufixo da grade — gravar 'MG' fixo mandou Franca SP pro
    // banco como mineira (04/ago, quando a Mogiana entrou na grade).
    const uf = city.match(/\s(MG|SP)$/)?.[1] ?? 'MG';
    for (const { kind, term } of ICP_QUERIES) {
      out.push({ kind, q: `${term} em ${city}`, city: city.replace(/\s+(MG|SP)$/, ''), uf });
    }
  }
  return out;
}

/**
 * Offset do dia (BRT): a rotação avança sozinha a cada dia de varredura.
 *
 * O dia do ano entra DIRETO, sem multiplicador. A versão anterior fazia
 * `(diaDoAno * 4) % 12` na intenção de "pular uma janela inteira por dia" — e
 * como 4 e 12 compartilham fator, a conta só produzia TRÊS offsets (0, 4, 8).
 * As janelas intermediárias nunca existiam, 31/jul e 03/ago caíram no mesmo
 * offset, e em 04/ago a busca voltou pro offset 0 — Varginha, Três Pontas,
 * Guaxupé e Alfenas, as quatro cidades mais varridas da base. O dedup comeu
 * 100% do resultado e o painel devolveu zero importados.
 *
 * Deslizando de uma cidade por dia, a janela nunca repete o mesmo conjunto em
 * dias seguidos e a grade inteira é coberta — passo 1 e tamanho 12 são
 * coprimos por construção, o que o teste de 12 dias garante.
 */
export function offsetDoDia(now: Date = new Date()): number {
  const brt = new Date(now.getTime() - 3 * 3600_000);
  const inicioAno = Date.UTC(brt.getUTCFullYear(), 0, 0);
  const diaDoAno = Math.floor((brt.getTime() - inicioAno) / 86_400_000);
  return diaDoAno % ICP_CITIES.length;
}

/**
 * As `n` cidades com MENOS prospects na base — onde a busca ainda rende.
 *
 * Substitui a escolha por calendario, que tem um defeito que nenhuma correcao
 * de formula resolve: ela nao sabe onde ja varremos. Em 04/ago, com a formula
 * ja consertada, o dia caiu justamente nas cidades de 15-42 prospects e a busca
 * teria voltado zero de novo.
 *
 * Varrer onde falta e auto-corretivo: cidade nunca varrida (zero) entra na
 * frente, cidade esgotada so volta quando as outras alcancarem. Sem tabela
 * nova e sem estado — a propria base e o registro. Empate resolve pela ordem
 * da grade, entao cron e botao do painel no mesmo dia varrem o mesmo conjunto
 * e o dedup entre eles continua barato.
 */
export function cidadesMaisCarentes(
  cidades: readonly string[],
  contagem: ReadonlyMap<string, number>,
  n: number
): string[] {
  return cidades
    .map((cidade, ordem) => ({ cidade, ordem, tem: contagem.get(cidade) ?? 0 }))
    .sort((a, b) => a.tem - b.tem || a.ordem - b.ordem)
    .slice(0, Math.max(0, n))
    .map((x) => x.cidade);
}

/**
 * Conta prospects por cidade da grade. O nome na base vem sem UF (o Places
 * devolve "Varginha"), entao a chave e normalizada pra bater com ICP_CITIES.
 * Falha de leitura devolve mapa vazio — e ai todas contam zero e a escolha cai
 * na ordem da grade, que e um default seguro, nunca um erro fatal.
 */
export async function contarPorCidade(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    const { getDb } = await import('../db');
    const { data, error } = await getDb().from('prospects').select('city');
    if (error) {
      log.error('contarPorCidade falhou:', error.message);
      return out;
    }
    const semUf = new Map<string, number>();
    for (const r of (data ?? []) as Array<{ city: string | null }>) {
      const c = (r.city ?? '').trim().toLowerCase();
      if (c) semUf.set(c, (semUf.get(c) ?? 0) + 1);
    }
    for (const alvo of ICP_CITIES) {
      const chave = alvo.replace(/\s+(MG|SP)$/, '').trim().toLowerCase();
      out.set(alvo, semUf.get(chave) ?? 0);
    }
  } catch (e) {
    log.error('contarPorCidade falhou:', (e as Error).message);
  }
  return out;
}

/** Map a Places result to a ProspectInput (validated phone or invalid). */
export function toProspectInput(
  hit: PlaceHit,
  kind: string,
  city: string,
  uf: string
): ProspectInput {
  const phone = normalizePhoneBR(hit.phone);
  return {
    name: hit.name.slice(0, 120),
    phone,
    wa_status: phone ? 'pending' : 'invalid',
    kind: kind.slice(0, 40),
    city: (hit.city ?? city).slice(0, 80),
    // Cidade e UF andam juntas: se o endereço do Places forneceu o par, ele
    // vence; senão vale o da query da grade. Nunca 'MG' fixo.
    uf: hit.uf ?? uf,
    source: hit.source.slice(0, 300),
  };
}

async function searchOnce(apiKey: string, q: string): Promise<PlaceHit[]> {
  const res = await withRetry(() =>
    fetch(PLACES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.displayName,places.nationalPhoneNumber,places.formattedAddress,places.googleMapsUri,places.websiteUri',
      },
      body: JSON.stringify({ textQuery: q, languageCode: 'pt-BR', regionCode: 'BR', pageSize: 10 }),
    })
  );
  if (!res.ok) throw new Error(`Places ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const data = (await res.json()) as {
    places?: Array<{
      displayName?: { text?: string };
      nationalPhoneNumber?: string;
      formattedAddress?: string;
      googleMapsUri?: string;
      websiteUri?: string;
    }>;
  };
  return (data.places ?? [])
    .filter((p) => p.displayName?.text)
    .map((p) => {
      // Cidade e UF saem do MESMO match ("..., Franca - SP, ..."): par
      // consistente ou nada. Só MG aqui deixava toda cidade paulista sem match.
      const end = p.formattedAddress?.match(/,\s*([^,]+)\s*-\s*(MG|SP)\b/);
      return {
        name: p.displayName!.text as string,
        phone: p.nationalPhoneNumber ?? null,
        city: end?.[1]?.trim() ?? null,
        uf: end?.[2] ?? null,
        source: p.googleMapsUri ?? 'google-places',
        website: p.websiteUri ?? null,
      };
    });
}

export interface SourceReport {
  configured: boolean;
  queries: number;
  found: number;
  imported: number;
  withPhone: number;
  /** WhatsApp citado achado no site (wa.me) — ver enrich.ts. */
  enriquecidos: number;
  /** Quantos o filtro de ICP barrou (pet/ração/veterinária). */
  descartadosICP: number;
  /** Quem foi barrado e por qual sinal — descarte silencioso vira base
   * encolhendo sem explicação. */
  descartadosExemplos: string[];
  error?: string;
}

/** Run one sourcing sweep. Bounded (maxCities × ICP_QUERIES × 10 results). */
export async function runSourcing(maxCities = 4): Promise<SourceReport> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return {
      configured: false, queries: 0, found: 0, imported: 0, withPhone: 0,
      enriquecidos: 0, descartadosICP: 0, descartadosExemplos: [],
      error: 'GOOGLE_PLACES_API_KEY não configurada (Vercel env) — busca automática desligada.',
    };
  }

  // Onde a busca ainda rende, medido na propria base — ver cidadesMaisCarentes.
  const contagem = await contarPorCidade();
  const alvos = cidadesMaisCarentes(ICP_CITIES, contagem, maxCities);
  const queries = buildQueries(alvos, maxCities, 0);
  // O site acompanha o input ate a fase de enriquecimento (toProspectInput nao
  // o carrega — website nao e coluna do prospect, e insumo).
  const rows: Array<{ input: ProspectInput; website: string | null }> = [];
  // Reportado, nunca silencioso: um filtro que descarta sem dizer o quê vira
  // uma base que encolhe sem explicação.
  const descartados: string[] = [];
  let failures = 0;
  for (const { kind, q, city, uf } of queries) {
    try {
      for (const hit of await searchOnce(apiKey, q)) {
        // Barrar pet/ração/veterinária ANTES da fila: um disparo errado queima
        // reputação, gasta cap e arrisca denúncia. Ver icp.ts.
        const motivo = motivoForaDoICP(hit.name, hit.source);
        if (motivo) {
          descartados.push(`${hit.name} (${motivo})`);
          continue;
        }
        rows.push({ input: toProspectInput(hit, kind, city, uf), website: hit.website });
      }
    } catch (e) {
      failures++;
      log.error(`sourcing query failed (${q}):`, (e as Error).message);
    }
  }

  // In-run dedup by phone/name before hitting the DB (importProspects dedups
  // against existing rows by phone).
  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    const key = r.input.phone ?? `name:${r.input.name.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Enriquecimento: buscar o wa.me no site de quem ainda nao tem CELULAR.
  // Medido (30/jul, 42 envios): leitura ~38% em numero enriquecido vs ~5% no
  // cru do Places — e o maior salto do funil. Orcamento por rodada + fetches em
  // paralelo para caber no maxDuration da function; fail-soft: site fora do ar
  // nao trava o sourcing.
  const paraEnriquecer = unique
    .filter((r) => r.website && (!r.input.phone || !isMobileBR(r.input.phone)))
    .slice(0, MAX_ENRICH_PER_RUN);
  let enriquecidos = 0;
  await Promise.all(
    paraEnriquecer.map(async (r) => {
      const hit = await enriquecerDoSite(r.website as string);
      if (hit) {
        r.input.wa_phone = hit.waPhone;
        r.input.wa_phone_source = hit.fonte;
        enriquecidos++;
      }
    })
  );

  const imported = await importProspects(unique.map((r) => r.input));
  const report: SourceReport = {
    configured: true,
    queries: queries.length,
    found: rows.length,
    imported,
    withPhone: unique.filter((r) => r.input.phone).length,
    enriquecidos,
    descartadosICP: descartados.length,
    descartadosExemplos: descartados.slice(0, 10),
    ...(failures ? { error: `${failures} consulta(s) falharam` } : {}),
  };
  log.info(`sourcing: ${JSON.stringify(report)}`);
  return report;
}
