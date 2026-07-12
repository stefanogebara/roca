/**
 * Prospect → partner promotion — the funnel's payoff. A replied prospect the
 * founder judges ready becomes an active `partners` row: from then on the lead
 * matcher can hand them consented farmer leads, and their inbound messages
 * route to the partner dossier path (the pipeline checks partners before
 * prospects). Founder-clicked in the painel — the human IS the qualification
 * gate; nothing here auto-promotes.
 */

import { getDb } from '../db';
import { geocodeCityBR } from '../tools/geo';
import { parseCrops } from '../tools/crops';
import { createLogger } from '../logger';
import type { ProspectRow } from './db';
import type { Qualification } from './agent';

const log = createLogger('prospect-promote');

// Same default the partners schema uses; founders can widen per-partner later.
const DEFAULT_RADIUS_KM = 60;

// coverage_label lands verbatim in farmer-facing copy (consentAskText's
// "atende ${coverage_label}") and its source is LLM-mined from a
// prospect-controlled conversation — cap it.
const COVERAGE_MAX_CHARS = 80;

export interface PartnerDraft {
  name: string;
  phone: string;
  coverage_label: string | null;
  crops: string[] | null;
  radius_km: number;
}

/**
 * Pure: derive the partners-row draft from the prospect + mined qualification.
 * Crops are normalized through the same parser the farm uses (parseCrops), so
 * partner crops and farm crops meet in one vocabulary — partnerCovers does
 * exact-label overlap. Nothing recognizable → null, which the matcher treats
 * as "any crop": broader is safer than a wrong exclusion.
 */
export function partnerFromProspect(
  p: Pick<ProspectRow, 'name' | 'phone' | 'city' | 'uf'>,
  q: Qualification | null
): PartnerDraft | { error: string } {
  if (!p.phone) return { error: 'prospect sem telefone válido' };
  const coverageBits = (q?.coverage ?? []).filter(Boolean);
  const rawCoverage = coverageBits.length
    ? coverageBits.join(', ')
    : [p.city, p.uf].filter(Boolean).join(', ');
  const coverage_label = rawCoverage
    ? rawCoverage.replace(/\s+/g, ' ').trim().slice(0, COVERAGE_MAX_CHARS)
    : null;
  const cropLabels = Array.from(new Set((q?.crops ?? []).flatMap((c) => parseCrops(String(c)))));
  return {
    name: p.name,
    phone: p.phone,
    coverage_label,
    crops: cropLabels.length ? cropLabels : null,
    radius_km: DEFAULT_RADIUS_KM,
  };
}

export interface PromoteResult {
  ok: boolean;
  error?: string;
  partnerId?: string;
  /** false ⇒ the partner exists but has no coordinates: geographic matching
   * stays inert until lat/lon are set (re-promoting retries the geocode). */
  geocoded: boolean;
  /** A partners row already existed for this phone (idempotent re-promote). */
  already?: boolean;
}

/**
 * Promote one prospect: geocode its city (fail-soft), create the partners row
 * (idempotent on phone — an existing row is never clobbered, only null coords
 * are backfilled), then move the prospect to the terminal 'partner' status.
 */
export async function promoteProspectToPartner(prospectId: string): Promise<PromoteResult> {
  const db = getDb();
  const { data, error } = await db.from('prospects').select('*').eq('id', prospectId).maybeSingle();
  if (error || !data) return { ok: false, geocoded: false, error: 'prospect não encontrado' };
  const p = data as ProspectRow;
  // Only a prospect who actually replied can convert ('partner' allowed for the
  // idempotent re-promote). Promoting a never-messaged row would also inflate
  // the funnel's reply rate (computeFunnelStats counts partner as replied).
  if (p.status !== 'replied' && p.status !== 'partner') {
    return { ok: false, geocoded: false, error: 'só prospects que responderam podem ser promovidos' };
  }

  const q = (data as { qualification?: Qualification | null }).qualification ?? null;
  const draft = partnerFromProspect(p, q);
  if ('error' in draft) return { ok: false, geocoded: false, error: draft.error };

  // Hard gate, fail closed: an opted-out number never becomes a partner (a
  // partner later receives business-initiated lead templates). If a real
  // partnership was agreed, the founder removes the opt-out row deliberately.
  const opt = await db
    .from('prospect_optouts')
    .select('phone')
    .eq('phone', draft.phone)
    .maybeSingle();
  if (opt.error) return { ok: false, geocoded: false, error: 'não deu pra verificar o opt-out — tente de novo' };
  if (opt.data) {
    return {
      ok: false,
      geocoded: false,
      error: 'este número pediu SAIR (opt-out) — se a parceria foi combinada de verdade, remova o opt-out no banco primeiro',
    };
  }

  const existing = await db
    .from('partners')
    .select('id, lat, lon, active')
    .eq('phone', draft.phone)
    .maybeSingle();
  const existingRow = existing.data as { id: string; lat: number | null; active: boolean } | null;

  // Coverage centroid for the geographic matcher — only fetched when the
  // partner doesn't already have one. Fail-soft: a partner without coordinates
  // exists but never geo-matches (partnerCovers skips null coords).
  const needsCoords = !existingRow || existingRow.lat == null;
  const coords = needsCoords && p.city ? await geocodeCityBR(p.city, p.uf) : null;

  let partnerId: string;
  let already = false;
  let hasCoords: boolean;
  if (existingRow) {
    already = true;
    partnerId = existingRow.id;
    hasCoords = existingRow.lat != null || !!coords;
    // Backfill ONLY missing coordinates — founder edits in the DB stay intact.
    if (existingRow.lat == null && coords) {
      const upd = await db
        .from('partners')
        .update({ lat: coords.lat, lon: coords.lon })
        .eq('id', partnerId);
      if (upd.error) log.error('coord backfill failed:', upd.error.message);
    }
    // The founder just clicked "promote" — the evident intent is an ACTIVE
    // partner; a silently-inert conversion would look done and match nothing.
    if (existingRow.active === false) {
      const upd = await db.from('partners').update({ active: true }).eq('id', partnerId);
      if (upd.error) log.error('partner reactivation failed:', upd.error.message);
      else log.info(`partner ${partnerId} reactivated by promotion`);
    }
  } else {
    const ins = await db
      .from('partners')
      .insert({
        name: draft.name,
        phone: draft.phone,
        coverage_label: draft.coverage_label,
        lat: coords?.lat ?? null,
        lon: coords?.lon ?? null,
        radius_km: draft.radius_km,
        crops: draft.crops,
        active: true,
      })
      .select('id')
      .single();
    if (ins.error) {
      log.error('partner insert failed:', ins.error.message);
      return { ok: false, geocoded: !!coords, error: 'não consegui criar o parceiro' };
    }
    partnerId = (ins.data as { id: string }).id;
    hasCoords = !!coords;
  }

  const upd = await db
    .from('prospects')
    .update({ status: 'partner', updated_at: new Date().toISOString() })
    .eq('id', prospectId);
  // Partner exists either way; a failed status flip just leaves the card on
  // 'replied' — re-promoting is idempotent and completes the transition.
  if (upd.error) log.error('prospect status flip failed after promotion:', upd.error.message);

  log.info(`promoted prospect ${prospectId} → partner ${partnerId} (coords=${hasCoords})`);
  return { ok: true, partnerId, geocoded: hasCoords, already };
}
