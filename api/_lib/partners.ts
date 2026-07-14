/**
 * Partner network — the farmer↔agronomist handoff, run by the agent end to end.
 *
 * Flow (all through the business number, never a founder's personal WhatsApp):
 *   1. Farmer asks for an agrônomo → geographic match against active partners
 *      (farm pin within the partner's coverage radius, crop overlap when known).
 *   2. Match → Stevi asks the farmer's EXPLICIT consent to share (LGPD: the
 *      referral opt-in is not consent to hand data to a third party).
 *   3. Farmer says yes → the partner gets the approved lead template
 *      (business-initiated ⇒ template per Meta policy); the farmer gets an
 *      honest loop-close.
 *   4. Partner replies (24h window now open) → the dossier goes out free-form:
 *      farmer contact + the agronomo brief. Lead auto-moves to 'contacted'.
 *
 * Fail-soft everywhere: a partner-layer problem must never break the farmer
 * conversation; degraded paths alert the founders instead of going silent.
 */

import { getDb } from './db';
import { haversineKm } from './tools/fires';
import { alertFounders } from './alert';
import { createLogger } from './logger';

const log = createLogger('partners');

// ── Lead SLA ─────────────────────────────────────────────────────────────────

const SLA_HOURS = 24;

/**
 * A lead is STALE when the partner was pinged, never opened the 24h window
 * (no dossier delivered), and the founder hasn't been alerted yet. Pure —
 * the alert stamp is the once-only dedup.
 */
export function isLeadStale(
  lead: {
    partner_notified_at: string | null;
    delivered_at: string | null;
    sla_alerted_at: string | null;
  },
  now: Date,
  hours = SLA_HOURS
): boolean {
  if (!lead.partner_notified_at || lead.delivered_at || lead.sla_alerted_at) return false;
  return now.getTime() - new Date(lead.partner_notified_at).getTime() >= hours * 3_600_000;
}

/**
 * Page the founder once per lead that's been sitting with a silent partner
 * past the SLA — a consented farmer is WAITING behind every one of these,
 * and lead rot is the fastest way to burn both sides of the marketplace.
 * Returns how many alerts fired. Runs from the daily monitor.
 */
export async function alertStaleLeads(now = new Date()): Promise<number> {
  const db = getDb();
  const cutoff = new Date(now.getTime() - SLA_HOURS * 3_600_000).toISOString();
  const { data, error } = await db
    .from('referral_requests')
    .select('id, uf, topic, partner_notified_at')
    .not('partner_notified_at', 'is', null)
    .is('delivered_at', null)
    .is('sla_alerted_at', null)
    .lt('partner_notified_at', cutoff);
  if (error) {
    log.error('stale-lead query failed:', error.message);
    return 0;
  }
  let alerted = 0;
  for (const lead of (data ?? []) as Array<{
    id: string;
    uf: string | null;
    topic: string | null;
    partner_notified_at: string;
  }>) {
    const hours = Math.round(
      (now.getTime() - new Date(lead.partner_notified_at).getTime()) / 3_600_000
    );
    await alertFounders(
      `⏰ Lead parado: parceiro avisado há ${hours}h e não respondeu — produtor${lead.uf ? ` de ${lead.uf}` : ''} esperando` +
        (lead.topic ? ` ("${lead.topic.slice(0, 60)}")` : '') +
        '. Cobra o parceiro ou reatribui.'
    );
    const upd = await db
      .from('referral_requests')
      .update({ sla_alerted_at: now.toISOString() })
      .eq('id', lead.id);
    if (upd.error) log.error('sla stamp failed:', upd.error.message);
    alerted++;
  }
  return alerted;
}

export interface PartnerRow {
  id: string;
  name: string;
  phone: string;
  coverage_label: string | null;
  lat: number | null;
  lon: number | null;
  radius_km: number;
  crops: string[] | null;
  active: boolean;
}

/** First name for message copy ("Michel Silva (Gaia Tech)" → "Michel"). */
export function partnerFirstName(name: string): string {
  return name.split(/[\s(]/)[0] || name;
}

// ── Consent detection (farmer's reply to the share ask) ─────────────────────
// Negatives checked FIRST: "não pode" contains "pode".

const CONSENT_NO_RE =
  /\b(n[ãa]o|nunca|prefiro\s+n[ãa]o|deixa\s+(pra\s+l[áa]|quieto)|agora\s+n[ãa]o|depois|melhor\s+n[ãa]o)\b/i;
const CONSENT_YES_RE =
  /\b(sim|pode|claro|com\s+certeza|manda|beleza|blz|ok|okay|uhum|aham|autorizo|quero|bora|demorou|fechado|show|top|por\s+favor|isso)\b|👍|✅/iu;

export function isConsentNo(text: string): boolean {
  return CONSENT_NO_RE.test(text);
}
export function isConsentYes(text: string): boolean {
  return !isConsentNo(text) && CONSENT_YES_RE.test(text);
}

// ── Matching ─────────────────────────────────────────────────────────────────

export function partnerCovers(
  p: Pick<PartnerRow, 'lat' | 'lon' | 'radius_km' | 'crops' | 'active'>,
  farm: { lat: number; lon: number; crop?: string[] | null }
): boolean {
  if (!p.active || p.lat == null || p.lon == null) return false;
  if (haversineKm({ lat: p.lat, lon: p.lon }, { lat: farm.lat, lon: farm.lon }) > p.radius_km) return false;
  // Crop filter only applies when BOTH sides declare crops.
  if (p.crops?.length && farm.crop?.length) {
    return farm.crop.some((c) => p.crops!.includes(c));
  }
  return true;
}

/** Nearest active partner covering the farm pin (null when nobody does). */
export async function matchPartnerForFarm(userId: string): Promise<PartnerRow | null> {
  const db = getDb();
  const [{ data: farm }, { data: partners }] = await Promise.all([
    db.from('farms').select('lat, lon, crop').eq('user_id', userId).maybeSingle(),
    db.from('partners').select('*').eq('active', true),
  ]);
  const f = farm as { lat: number | null; lon: number | null; crop: string[] | null } | null;
  if (!f?.lat || !f?.lon) return null;
  const covering = ((partners ?? []) as PartnerRow[])
    .filter((p) => partnerCovers(p, { lat: f.lat as number, lon: f.lon as number, crop: f.crop }))
    .sort(
      (a, b) =>
        haversineKm({ lat: a.lat as number, lon: a.lon as number }, { lat: f.lat as number, lon: f.lon as number }) -
        haversineKm({ lat: b.lat as number, lon: b.lon as number }, { lat: f.lat as number, lon: f.lon as number })
    );
  return covering[0] ?? null;
}

export async function getPartner(id: string): Promise<PartnerRow | null> {
  const db = getDb();
  const { data } = await db.from('partners').select('*').eq('id', id).maybeSingle();
  return (data as PartnerRow) ?? null;
}

export async function findPartnerByPhone(phone: string): Promise<PartnerRow | null> {
  const db = getDb();
  const { data } = await db.from('partners').select('*').eq('phone', phone).maybeSingle();
  return (data as PartnerRow) ?? null;
}

// ── Handoff lifecycle on referral_requests ───────────────────────────────────

export interface PendingHandoff {
  id: string;
  user_id: string;
  crop: string[] | null;
  topic: string | null;
}

/** Latest referral for this user matched to a partner but not yet consented. */
export async function latestUnconsentedReferral(
  userId: string
): Promise<{ id: string; partner_id: string; topic: string | null; crop: string[] | null } | null> {
  const db = getDb();
  const { data } = await db
    .from('referral_requests')
    .select('id, partner_id, topic, crop')
    .eq('user_id', userId)
    .not('partner_id', 'is', null)
    .is('share_consent_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { id: string; partner_id: string; topic: string | null; crop: string[] | null }) ?? null;
}

export async function setReferralPartner(referralId: string, partnerId: string): Promise<void> {
  const db = getDb();
  const { error } = await db.from('referral_requests').update({ partner_id: partnerId }).eq('id', referralId);
  if (error) log.error('setReferralPartner failed:', error.message);
}

export async function recordShareConsent(referralId: string): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('referral_requests')
    .update({ share_consent_at: new Date().toISOString() })
    .eq('id', referralId);
  if (error) throw new Error(`recordShareConsent failed: ${error.message}`);
}

export async function markPartnerNotified(referralId: string): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('referral_requests')
    .update({ partner_notified_at: new Date().toISOString(), status: 'contacted' })
    .eq('id', referralId);
  if (error) log.error('markPartnerNotified failed:', error.message);
}

/** Consented + notified leads for this partner whose dossier hasn't gone out. */
export async function pendingDeliveries(partnerId: string): Promise<PendingHandoff[]> {
  const db = getDb();
  const { data, error } = await db
    .from('referral_requests')
    .select('id, user_id, crop, topic')
    .eq('partner_id', partnerId)
    .not('share_consent_at', 'is', null)
    .is('delivered_at', null)
    .order('created_at', { ascending: true })
    .limit(5);
  if (error) {
    log.error('pendingDeliveries failed:', error.message);
    return [];
  }
  return (data ?? []) as PendingHandoff[];
}

export async function markDelivered(referralId: string): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from('referral_requests')
    .update({ delivered_at: new Date().toISOString() })
    .eq('id', referralId);
  if (error) log.error('markDelivered failed:', error.message);
}

// ── Farmer-side consent conversation ────────────────────────────────────────

/** The share-consent question Stevi asks when a partner covers the farm. */
export function consentAskText(partner: PartnerRow): string {
  return (
    `Boa! 🙌 E tenho uma novidade: a Stevi tem um agrônomo parceiro na sua região — ` +
    `o ${partnerFirstName(partner.name)}${partner.coverage_label ? ` (atende ${partner.coverage_label})` : ''}. ` +
    `Ele te chama direto no seu WhatsApp. ` +
    `Posso passar pra ele o seu contato e o resumo da nossa conversa (fotos, cultura, localização)? 👍`
  );
}

/**
 * Resolve the farmer's reply to the consent ask. Returns the farmer-facing
 * reply, or null when the message isn't a clear yes/no (caller falls through
 * to normal handling; the awaiting state persists until a clear answer or
 * another intent clears it). On YES: consent stamped, partner gets the
 * approved lead template; a partner-send failure degrades to a founder alert
 * (manual handoff) — the farmer never sees the failure.
 */
export async function resolveConsentReply(userId: string, text: string): Promise<string | null> {
  if (!isConsentYes(text) && !isConsentNo(text)) return null;
  const ref = await latestUnconsentedReferral(userId);
  if (!ref) return null; // stale awaiting state — treat as a normal message

  if (isConsentNo(text)) {
    return (
      'Tranquilo, seus dados ficam só comigo. 👍 Se mudar de ideia é só falar ' +
      '"quero um agrônomo" que eu conecto vocês.'
    );
  }

  const partner = await getPartner(ref.partner_id);
  if (!partner) return null;
  await recordShareConsent(ref.id);

  const { alertFounders } = await import('./alert');
  try {
    const { sendProspectTemplate } = await import('./prospect/send');
    const { LEAD_NAME } = await import('./prospect/template');
    await sendProspectTemplate(partner.phone, LEAD_NAME, 'pt_BR', [
      partnerFirstName(partner.name),
      (ref.crop ?? []).join(', ') || 'lavoura',
      (ref.topic ?? 'pedido de agrônomo').replace(/\s+/g, ' ').slice(0, 60),
    ]);
    await markPartnerNotified(ref.id);
    await alertFounders(
      `🤝 Lead consentiu! Aviso enviado pro parceiro ${partner.name} — o dossiê sai automático quando ele responder.`
    );
    return (
      `Fechado! 🙌 Avisei o ${partnerFirstName(partner.name)} agora — ele deve te chamar em breve ` +
      `no seu WhatsApp. Qualquer coisa me dá um toque aqui. 🌱`
    );
  } catch (e) {
    log.error('partner lead notification failed:', (e as Error).message);
    await alertFounders(
      `⚠️ Produtor CONSENTIU mas o aviso pro parceiro ${partner.name} falhou ` +
        `(${(e as Error).message.slice(0, 120)}) — faça o handoff manual (kit no plano GTM).`
    );
    return (
      `Perfeito! Já registrei sua autorização — o agrônomo parceiro te chama em breve. 👍`
    );
  }
}

/**
 * Dossier text for every pending delivery to this partner (his reply opened
 * the 24h window, so free-form is allowed). Marks each as delivered. Returns
 * null when nothing is pending — the caller alerts the founders instead.
 */
export async function buildDossierReply(partner: PartnerRow): Promise<string | null> {
  const pending = await pendingDeliveries(partner.id);
  if (!pending.length) return null;
  const db = getDb();
  const { buildAgronomoBrief } = await import('./brief');
  const parts: string[] = [];
  for (const lead of pending) {
    const { data: u } = await db.from('users').select('wa_id, name').eq('id', lead.user_id).maybeSingle();
    const farmer = u as { wa_id: string; name: string | null } | null;
    if (!farmer) continue;
    const brief = await buildAgronomoBrief(lead.user_id).catch(() => '(resumo indisponível — peço desculpa, mando em seguida)');
    parts.push(
      `📋 *Lead — ${farmer.name ?? 'produtor'}*\n` +
        `WhatsApp: +${farmer.wa_id.replace(/^whatsapp:|^\+/g, '')}\n` +
        (lead.topic ? `Pedido: "${lead.topic}"\n` : '') +
        `\n${brief}`
    );
    await markDelivered(lead.id);
  }
  if (!parts.length) return null;
  return (
    `Boa, ${partnerFirstName(partner.name)}! Segue o lead completo 👇\n\n` +
    parts.join('\n\n———\n\n') +
    `\n\nEle está esperando seu contato. Depois me conta como foi! 🙏`
  );
}
