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

export const ICP_CITIES = [
  'Varginha MG', 'Três Pontas MG', 'Guaxupé MG', 'Alfenas MG', 'Machado MG',
  'Poços de Caldas MG', 'Lavras MG', 'Nepomuceno MG', 'Boa Esperança MG',
  'Campos Gerais MG', 'Carmo de Minas MG', 'São Gonçalo do Sapucaí MG',
];

export interface PlaceHit {
  name: string;
  phone: string | null;
  city: string | null;
  source: string;
  /** Site do negócio (Places websiteUri) — insumo do enriquecimento. */
  website: string | null;
}

/** Compose the Places text queries for one run (bounded). */
export function buildQueries(cities: string[] = ICP_CITIES, maxCities = 4): Array<{ kind: string; q: string; city: string }> {
  const out: Array<{ kind: string; q: string; city: string }> = [];
  for (const city of cities.slice(0, maxCities)) {
    for (const { kind, term } of ICP_QUERIES) {
      out.push({ kind, q: `${term} em ${city}`, city: city.replace(/\s+MG$/, '') });
    }
  }
  return out;
}

/** Map a Places result to a ProspectInput (validated phone or invalid). */
export function toProspectInput(
  hit: PlaceHit,
  kind: string,
  city: string
): ProspectInput {
  const phone = normalizePhoneBR(hit.phone);
  return {
    name: hit.name.slice(0, 120),
    phone,
    wa_status: phone ? 'pending' : 'invalid',
    kind: kind.slice(0, 40),
    city: (hit.city ?? city).slice(0, 80),
    uf: 'MG',
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
    .map((p) => ({
      name: p.displayName!.text as string,
      phone: p.nationalPhoneNumber ?? null,
      city: p.formattedAddress?.match(/,\s*([^,]+)\s*-\s*MG/)?.[1]?.trim() ?? null,
      source: p.googleMapsUri ?? 'google-places',
      website: p.websiteUri ?? null,
    }));
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

  const queries = buildQueries(ICP_CITIES, maxCities);
  // O site acompanha o input ate a fase de enriquecimento (toProspectInput nao
  // o carrega — website nao e coluna do prospect, e insumo).
  const rows: Array<{ input: ProspectInput; website: string | null }> = [];
  // Reportado, nunca silencioso: um filtro que descarta sem dizer o quê vira
  // uma base que encolhe sem explicação.
  const descartados: string[] = [];
  let failures = 0;
  for (const { kind, q, city } of queries) {
    try {
      for (const hit of await searchOnce(apiKey, q)) {
        // Barrar pet/ração/veterinária ANTES da fila: um disparo errado queima
        // reputação, gasta cap e arrisca denúncia. Ver icp.ts.
        const motivo = motivoForaDoICP(hit.name, hit.source);
        if (motivo) {
          descartados.push(`${hit.name} (${motivo})`);
          continue;
        }
        rows.push({ input: toProspectInput(hit, kind, city), website: hit.website });
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
