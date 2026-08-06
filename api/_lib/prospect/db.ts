/**
 * Prospect persistence — kept out of the big (and busy) _lib/db.ts. Reuses the
 * shared service-role client. All reads/writes for the prospecting engine + ops.
 */

import { getDb } from '../db';
import { createLogger } from '../logger';
import type { ProspectStatus, WaStatus } from './core';

const log = createLogger('prospect-db');

export interface ProspectRow {
  id: string;
  name: string;
  kind: string;
  city: string | null;
  uf: string | null;
  phone: string | null;
  /** Number confirmed on WhatsApp by enrichment; may be a landline. Preferred
   * over `phone` for sending — see core.sendablePhone. */
  wa_phone: string | null;
  /** Where wa_phone was seen. Mandatory for wa_phone to be used. */
  wa_phone_source: string | null;
  /** Last delivery error from Meta's callback (only 131026 condemns a number). */
  wa_error: string | null;
  wa_status: WaStatus;
  source: string;
  status: ProspectStatus;
  notes: string | null;
  sent_at: string | null;
  send_status: string | null;
  wamid: string | null;
  template_used: string | null;
  touches: number;
  /** Tentativas de furar atendimento automático — ver agent.PORTEIRO_MAX. */
  porteiro_tentativas: number;
  created_at: string;
  updated_at: string;
}

/** Prospects marked ready with a validated number and not yet contacted. */
export async function loadReadyProspects(limit = 200): Promise<ProspectRow[]> {
  const db = getDb();
  const { data, error } = await db
    .from('prospects')
    .select('*')
    .eq('status', 'ready')
    .eq('wa_status', 'valid')
    .is('send_status', null)
    .not('phone', 'is', null)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) {
    log.error('loadReadyProspects failed:', error.message);
    return [];
  }
  return (data ?? []) as ProspectRow[];
}

/**
 * The opt-out blocklist as a set of E.164 numbers. FAILS CLOSED: if we can't
 * read the blocklist we must NOT send (sending to an opted-out number is an LGPD
 * violation + a ban risk), so this throws and the dispatch aborts. A null result
 * with no error is also treated as unverifiable → throw.
 */
export async function loadOptouts(): Promise<Set<string>> {
  const db = getDb();
  const { data, error } = await db.from('prospect_optouts').select('phone');
  if (error || data == null) {
    throw new Error(`loadOptouts unavailable: ${error?.message ?? 'null result'}`);
  }
  return new Set((data as Array<{ phone: string }>).map((r) => r.phone));
}

/**
 * How many prospects were already contacted since a given instant (daily cap).
 * FAILS CLOSED: on error we throw so the run aborts rather than resetting the cap
 * to 0 and over-sending from a fresh number.
 */
export async function countSentSince(sinceIso: string): Promise<number> {
  const db = getDb();
  const { count, error } = await db
    .from('prospects')
    .select('id', { count: 'exact', head: true })
    .gte('sent_at', sinceIso);
  if (error || count == null) {
    throw new Error(`countSentSince unavailable: ${error?.message ?? 'null count'}`);
  }
  return count;
}

/**
 * Sends that FAILED post-accept since `sinceIso` (Meta accepted, delivery was
 * denied). Feeds the intra-day circuit breaker: the health thermometer needs 20
 * sends in a 7-day window before it grades, which is too slow to stop a day
 * like 21/jul, when 16 of 16 failed across three cron runs.
 * Throws — the caller fails closed, like every other safety precondition.
 */
export async function countFailedSince(sinceIso: string): Promise<number> {
  const db = getDb();
  const { count, error } = await db
    .from('prospects')
    .select('id', { count: 'exact', head: true })
    .eq('send_status', 'failed')
    .gte('sent_at', sinceIso);
  if (error || count == null) {
    throw new Error(`countFailedSince unavailable: ${error?.message ?? 'null count'}`);
  }
  return count;
}

/**
 * Atomically claim a prospect for the intro send (send_status null → 'sending',
 * one SQL statement). Two dispatch runs can overlap — the cron firing while a
 * founder presses "Disparar" in the painel — and both read the same eligible
 * rows; whoever claims a row first owns it, the other MUST skip. Re-checks
 * status='ready' so a founder discarding the prospect mid-run (pacing makes a
 * run span minutes) also voids the claim. The claim stamps sent_at NOW: the
 * daily cap counts sent_at, so cap is consumed at claim time and an overlapping
 * run's recount sees it (recordSend refreshes the timestamp; a failed attempt
 * keeps counting toward the cap — deliberately conservative pacing). Returns
 * false when the row was already claimed/changed. FAILS CLOSED on error (a row
 * we can't claim is a row we don't send). A crash after claiming strands the
 * row at 'sending' — surfaced in the painel with a "Liberar reenvio" reset —
 * because a lost send is recoverable and a double send is not.
 */
export async function claimProspectForSend(id: string): Promise<boolean> {
  const db = getDb();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from('prospects')
    .update({ send_status: 'sending', sent_at: now, updated_at: now })
    .eq('id', id)
    .eq('status', 'ready')
    .is('send_status', null)
    .select('id');
  if (error) {
    log.error('claimProspectForSend failed (treated as not claimed):', error.message);
    return false;
  }
  return (data ?? []).length > 0;
}


// Give-up window: a contacted prospect whose last touch got no reply for this
// many days is dead, not "waiting". (Era "intro ou bump"; o bump morreu em
// 05/ago — hoje o único toque que carimba sent_at é o intro.)
// Clamped: a misparsed env must neither detonate (0/NaN would stale everything
// or throw) nor silently disable the sweep.
const STALE_DAYS_RAW = Number(process.env.PROSPECT_STALE_AFTER_DAYS || '14');
const STALE_AFTER_DAYS = Number.isFinite(STALE_DAYS_RAW) && STALE_DAYS_RAW >= 3 ? STALE_DAYS_RAW : 14;

/**
 * Terminal state for never-repliers: 'contacted' with no reply since the last
 * touch → 'stale'. Keeps the funnel stats honest and the painel free of
 * zombies; a founder can still reactivate from the painel (stale → discovered).
 * A reply arriving later still works — markProspectReplied matches by phone,
 * not status. Returns how many rows transitioned.
 */
export async function markStaleProspects(
  days = STALE_AFTER_DAYS,
  now = new Date()
): Promise<number> {
  const db = getDb();
  const cutoff = new Date(now.getTime() - days * 86_400_000).toISOString();
  const { data, error } = await db
    .from('prospects')
    .update({ status: 'stale', updated_at: now.toISOString() })
    .eq('status', 'contacted')
    .lt('sent_at', cutoff)
    .select('id');
  if (error) {
    log.error('markStaleProspects failed:', error.message);
    return 0;
  }
  return (data ?? []).length;
}

/**
 * Founder-clicked return of a stale/discarded prospect to the review queue.
 * Clears the send tracking (send_status + touches) so an approved row is
 * genuinely re-sendable — without this a once-contacted row re-enters the
 * funnel as an un-dispatchable zombie that renders as "contatado". The
 * deliberate re-outreach decision is gated by the painel confirm.
 */
export async function reactivateProspect(id: string): Promise<boolean> {
  const db = getDb();
  const { data, error } = await db
    .from('prospects')
    // wamid clears for the same late-callback reason as resetProspectSend.
    .update({ status: 'discovered', send_status: null, wamid: null, touches: 0, updated_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['stale', 'discarded'])
    .select('id');
  if (error) {
    log.error('reactivateProspect failed:', error.message);
    return false;
  }
  return (data ?? []).length > 0;
}

/**
 * Ops recovery for a stuck claim ('sending' after a crash) or a failed send:
 * clears send_status so the prospect re-enters the dispatch queue. Guarded to
 * those two states only — resetting a 'sent' row would re-blast the number.
 */
export async function resetProspectSend(id: string): Promise<boolean> {
  const db = getDb();
  const { data, error } = await db
    .from('prospects')
    // wamid clears too: a late Meta redelivery for the OLD send must never
    // match the row while a fresh send is in flight ('sending' accepts
    // callbacks by design — the heal path).
    .update({ send_status: null, wamid: null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .in('send_status', ['sending', 'failed'])
    .select('id');
  if (error) {
    log.error('resetProspectSend failed:', error.message);
    return false;
  }
  return (data ?? []).length > 0;
}

/**
 * Mark a prospect contacted after a successful template send. THROWS on failure:
 * the message already went out, so an unrecorded send is a duplicate-send hazard
 * next run — the caller must stop the batch and page ops to reconcile the wamid,
 * not silently continue.
 */
export async function recordSend(
  id: string,
  fields: { wamid: string; template: string }
): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('prospects')
    .update({
      send_status: 'sent',
      status: 'contacted',
      sent_at: new Date().toISOString(),
      wamid: fields.wamid,
      template_used: fields.template,
      touches: 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw new Error(`recordSend failed for ${id} (wamid ${fields.wamid}): ${error.message}`);
}



/** Mark a prospect's send as failed (surfaced in ops; never silently dropped). */
export async function recordSendFailed(id: string): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('prospects')
    .update({ send_status: 'failed', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) log.error('recordSendFailed failed:', error.message);
}

/** All prospects for the ops table, newest first. */
export async function listProspects(limit = 500): Promise<ProspectRow[]> {
  const db = getDb();
  const { data, error } = await db
    .from('prospects')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    log.error('listProspects failed:', error.message);
    return [];
  }
  return (data ?? []) as ProspectRow[];
}

export interface ProspectInput {
  name: string;
  phone: string | null;
  wa_status: WaStatus;
  kind: string;
  city: string | null;
  uf: string | null;
  source: string;
  /** WhatsApp citado pelo proprio negocio (wa.me no site) — ver enrich.ts.
   * Medido: leitura ~38% em enriquecidos vs ~5% em numero cru do Places. */
  wa_phone?: string | null;
  wa_phone_source?: string | null;
}

/**
 * Bulk-insert prospects, skipping phones that already exist. We dedup explicitly
 * (rather than ON CONFLICT) because the phone unique index is partial
 * (`where phone is not null`), which ON CONFLICT can't target. Rows without a
 * phone (invalid) are always inserted so ops can see and fix them. Returns the
 * number of rows newly inserted.
 */
export async function importProspects(rows: ProspectInput[]): Promise<number> {
  if (!rows.length) return 0;
  const db = getDb();

  const phones = [...new Set(rows.map((r) => r.phone).filter((v): v is string => !!v))];
  const existing = new Set<string>();
  if (phones.length) {
    const { data, error } = await db.from('prospects').select('phone').in('phone', phones);
    if (error) throw new Error(`importProspects dedup query failed: ${error.message}`);
    for (const r of (data ?? []) as Array<{ phone: string | null }>) if (r.phone) existing.add(r.phone);
  }

  // Linha SEM phone entra para review — mas review vale UMA vez. O dedup era
  // só por phone, então cada rodada de sourcing que reencontrava o mesmo
  // negócio phoneless inseria de novo (AGRO COFFEE ×4 na base, 06/ago). Sem
  // phone, a identidade é (name, city), case-insensitive — o Places não é
  // consistente com caixa. Cidade diferente NÃO é duplicata: filial legítima.
  // Ressalva: o `.in('name', …)` do banco é exact-case (não há ilike de lista);
  // a comparação insensitive vale plenamente dentro do lote e para a cidade.
  // Mesmo fornecedor devolve a mesma caixa, então cobre o caso real — o índice
  // único parcial em (lower(name), lower(city)) where phone is null é a rede.
  const nameKey = (name: string, city: string | null | undefined) =>
    `${name.trim().toLowerCase()}|${(city ?? '').trim().toLowerCase()}`;
  const phonelessNames = [...new Set(rows.filter((r) => !r.phone).map((r) => r.name))];
  const existingNames = new Set<string>();
  if (phonelessNames.length) {
    const { data, error } = await db.from('prospects').select('name, city').in('name', phonelessNames);
    // Fail-soft de propósito: esta query é defesa contra RUÍDO (duplicata de
    // review), não contra envio — quebrar o sourcing inteiro por causa dela
    // seria pagar mais caro que o problema que ela evita.
    if (error) log.error('importProspects phoneless dedup query failed:', error.message);
    for (const r of (data ?? []) as Array<{ name: string; city: string | null }>)
      existingNames.add(nameKey(r.name, r.city));
  }

  const seen = new Set<string>();
  const toInsert = rows.filter((r) => {
    if (!r.phone) {
      const key = nameKey(r.name, r.city);
      if (existingNames.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    }
    if (existing.has(r.phone) || seen.has(r.phone)) return false; // dedup vs DB + within batch
    seen.add(r.phone);
    return true;
  });
  if (!toInsert.length) return 0;

  const { data, error } = await db.from('prospects').insert(toInsert).select('id');
  if (error) {
    log.error('importProspects failed:', error.message);
    throw new Error(error.message);
  }
  return (data ?? []).length;
}

/** Set a prospect's pipeline status (e.g. ready / discarded) from the ops console. */
export async function setProspectStatus(id: string, status: ProspectStatus): Promise<boolean> {
  const db = getDb();
  const { error } = await db
    .from('prospects')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    log.error('setProspectStatus failed:', error.message);
    return false;
  }
  // Promotion to 'ready' IS the review act: a sourced number ('pending', i.e.
  // format-validated but scraped) becomes 'valid'. Never resurrects 'invalid'.
  if (status === 'ready') {
    const { error: waErr } = await db
      .from('prospects')
      .update({ wa_status: 'valid' })
      .eq('id', id)
      .eq('wa_status', 'pending');
    if (waErr) log.error('wa_status promotion failed:', waErr.message);
  }
  return true;
}

/** Find a prospect by its E.164 phone (to recognise inbound replies from prospects). */
/**
 * Acha o prospect por QUALQUER um dos dois números — `phone` (cadastro) ou
 * `wa_phone` (o citado, para onde a gente de fato envia).
 *
 * Casar só por `phone` era um buraco medido: em 04/ago, 27 prospects tinham
 * `wa_phone` diferente do `phone`, e a gente manda para o `wa_phone`. Ou seja,
 * é DE LÁ que eles respondem, e a resposta não era reconhecida. Dois casos reais
 * (AGROTEKNE e AgroRural, ambos revenda, template lido) responderam, caíram como
 * "produtor" no pipeline e receberam oferta de diagnóstico de folha — enquanto a
 * Vitória tentava recrutá-los como parceiros. Pior: um "para de mandar mensagem"
 * vindo desse número não era reconhecido como opt-out.
 *
 * Duas consultas simples em vez de um filtro montado: o repo não tem nenhum
 * `.or()`/`.filter()` com string interpolada, e manter essa propriedade vale
 * mais que uma ida a menos ao banco.
 */
/** Um prospect pelo id. Usado pela resposta manual (reply.ts). */
export async function getProspectById(id: string): Promise<ProspectRow | null> {
  const db = getDb();
  const { data, error } = await db.from('prospects').select('*').eq('id', id).maybeSingle();
  if (error) {
    log.error('getProspectById failed:', error.message);
    return null;
  }
  return (data as ProspectRow) ?? null;
}

export async function findProspectByPhone(phone: string): Promise<ProspectRow | null> {
  const db = getDb();
  const { data, error } = await db.from('prospects').select('*').eq('phone', phone).maybeSingle();
  if (error) {
    log.error('findProspectByPhone failed:', error.message);
    return null;
  }
  if (data) return data as ProspectRow;

  const { data: porWa, error: erroWa } = await db
    .from('prospects')
    .select('*')
    .eq('wa_phone', phone)
    .maybeSingle();
  if (erroWa) {
    log.error('findProspectByPhone (wa_phone) failed:', erroWa.message);
    return null;
  }
  return (porWa as ProspectRow) ?? null;
}

/**
 * Apaga a linha do prospect por qualquer um dos dois números. O CASCADE de
 * `prospect_messages.prospect_id` leva o thread junto.
 *
 * `prospect_optouts` NÃO é tocada de propósito: ela é keyed por telefone, sem FK
 * para cá, e é a prova de que a pessoa pediu para sair. Apagar a supressão junto
 * com o dado faria o sourcing redescobrir a mesma empresa amanhã.
 */
export async function deleteProspectByPhone(phone: string): Promise<boolean> {
  const db = getDb();
  // Dois deletes com .eq() em vez de um .or() com string montada: o repo não
  // tem NENHUM filtro interpolado hoje, e essa propriedade vale mais que uma
  // ida a menos ao banco. Idempotente — apagar zero linhas não é erro.
  for (const coluna of ['phone', 'wa_phone'] as const) {
    const { error } = await db.from('prospects').delete().eq(coluna, phone);
    if (error) {
      log.error(`deleteProspectByPhone (${coluna}) failed:`, error.message);
      return false;
    }
  }
  return true;
}

/** Mark a prospect as having replied (engagement signal for ops). */
export async function markProspectReplied(id: string): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('prospects')
    .update({ status: 'replied', send_status: 'replied', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) log.error('markProspectReplied failed:', error.message);
}

/** Add a phone to the hard opt-out blocklist (idempotent on the unique index). */
/** Teto do verbatim: evidência, não arquivo. Casa com o comentário da coluna. */
const VERBATIM_MAX = 500;

/**
 * Registrar opt-out. `reason` é a CATEGORIA (de onde veio); `verbatim` é o que a
 * pessoa escreveu — a evidência que sustenta o registro para LGPD. Até 04/ago só
 * havia a categoria, e ela era uma string fixa nossa.
 */
export async function addOptout(phone: string, reason: string, verbatim?: string | null): Promise<void> {
  const db = getDb();
  const { error } = await db.from('prospect_optouts').upsert(
    {
      phone,
      reason,
      // Truncar, nunca descartar: uma mensagem enorme não pode fazer a prova
      // sumir. `undefined` viraria "não mexe na coluna" no upsert, então o
      // ausente é explicitamente null.
      verbatim: verbatim ? verbatim.slice(0, VERBATIM_MAX) : null,
    },
    { onConflict: 'phone' }
  );
  if (error) log.error('addOptout failed:', error.message);
}

// ── Conversation agent support (prospect_messages + agent toggle) ────────────

export interface ProspectMessage {
  direction: 'in' | 'out';
  kind: string;
  text: string | null;
  created_at: string;
}

/** Append a message to a prospect's thread (best-effort). */
export async function logProspectMessage(
  prospectId: string,
  direction: 'in' | 'out',
  kind: string,
  text: string | null
): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('prospect_messages')
    .insert({ prospect_id: prospectId, direction, kind, text });
  if (error) log.error('logProspectMessage failed:', error.message);
}

/** Load a prospect's thread, oldest first (bounded). */
export async function getProspectThread(
  prospectId: string,
  limit = 30
): Promise<ProspectMessage[]> {
  const db = getDb();
  const { data, error } = await db
    .from('prospect_messages')
    .select('direction, kind, text, created_at')
    .eq('prospect_id', prospectId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) {
    log.error('getProspectThread failed:', error.message);
    return [];
  }
  return (data ?? []) as ProspectMessage[];
}

/** Founder takeover switch: enable/disable the conversation agent. */
export async function setProspectAgentEnabled(prospectId: string, enabled: boolean): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('prospects')
    .update({ agent_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('id', prospectId);
  if (error) log.error('setProspectAgentEnabled failed:', error.message);
}

/** Merge extracted qualification into the prospect row (nulls don't overwrite). */
export async function mergeProspectQualification(
  prospectId: string,
  q: Record<string, unknown>
): Promise<void> {
  const db = getDb();
  const { data } = await db.from('prospects').select('qualification').eq('id', prospectId).maybeSingle();
  const current = ((data as { qualification: Record<string, unknown> | null } | null)?.qualification) ?? {};
  const merged: Record<string, unknown> = { ...current };
  for (const [k, v] of Object.entries(q)) {
    if (v !== null && v !== undefined) merged[k] = v;
  }
  const { error } = await db
    .from('prospects')
    .update({ qualification: merged, updated_at: new Date().toISOString() })
    .eq('id', prospectId);
  if (error) log.error('mergeProspectQualification failed:', error.message);
}

/** Count one more attempt at getting past an automated attendant. */
export async function bumpPorteiroTentativas(id: string): Promise<void> {
  const db = getDb();
  const { data, error } = await db.from('prospects').select('porteiro_tentativas').eq('id', id).maybeSingle();
  if (error) throw new Error(`bumpPorteiroTentativas read failed: ${error.message}`);
  const atual = (data as { porteiro_tentativas?: number } | null)?.porteiro_tentativas ?? 0;
  const { error: upErr } = await db
    .from('prospects')
    .update({ porteiro_tentativas: atual + 1, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (upErr) throw new Error(`bumpPorteiroTentativas write failed: ${upErr.message}`);
}
