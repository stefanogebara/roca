/**
 * Growth loops — pure logic for the two acquisition mechanisms the flight
 * plan measures:
 *
 *  - SOURCE TOKENS: every vouched farmer arrives via a wa.me link whose
 *    pre-filled first message says who sent them ("Oi! Vim pelo José").
 *    Captured once on first contact into users.source — it splits every
 *    cohort metric into vouchado vs. orgânico, which is the scorecard's
 *    gate variable.
 *  - REFERRAL NUDGE: after a delivered victory moment (visual verdict in
 *    hand), a single forwardable line invites the farmer to pass Stevi on —
 *    with a link pre-filled with THEIR name, so the chain attributes itself.
 *    Sparing by design: ≥14 days between nudges, never on first contact,
 *    never on a compliance-gated reply, never on a pin-ask.
 */

const SOURCE_MAX = 40;

// "vim pelo José", "vim pela Maria", "vim pelo cartaz do armazém"
const VIM_PELO_RE = /vim\s+pel[oa]s?\s+([^\n.!?#]{2,80})/i;
// Explicit compact tokens for printed material: "#tec-jose"
const HASH_RE = /#([a-z0-9][a-z0-9-]{1,23})/i;
const INDICACAO_RE = /vim\s+por\s+indica[çc][ãa]o/i;

/** Attribution from a first message, normalized, or null. First-wins is
 * enforced at the DB layer (setUserSource only fills a null column). */
export function parseSourceToken(text: string | null | undefined): string | null {
  if (!text) return null;
  const hash = text.match(HASH_RE);
  if (hash) return hash[1].toLowerCase();
  const vim = text.match(VIM_PELO_RE);
  if (vim) {
    const cleaned = vim[1].replace(/\s+/g, ' ').trim().replace(/[,;:!?.]+$/, '').toLowerCase();
    return cleaned ? cleaned.slice(0, SOURCE_MAX) : null;
  }
  if (INDICACAO_RE.test(text)) return 'indicação';
  return null;
}

const NUDGE_COOLDOWN_MS = 14 * 86_400_000;
const VALUE_INTENTS = new Set(['pest_triage', 'spray_window', 'field_health']);

export interface ReferralContext {
  intent: string;
  /** A visual verdict shipped with the reply — the difference between a real
   * victory moment and a pin-ask or generic answer. */
  hasVisual: boolean;
  firstContact: boolean;
  gateSafe: boolean;
  lastPromptedAt: string | null;
}

/** Whether this reply earns the referral nudge. */
export function shouldPromptReferral(ctx: ReferralContext, now: Date): boolean {
  if (!VALUE_INTENTS.has(ctx.intent)) return false;
  if (!ctx.hasVisual || ctx.firstContact || !ctx.gateSafe) return false;
  if (ctx.lastPromptedAt && now.getTime() - new Date(ctx.lastPromptedAt).getTime() < NUDGE_COOLDOWN_MS) {
    return false;
  }
  return true;
}

const PUBLIC_WA = () => process.env.PUBLIC_WA_NUMBER || '19705509125';

/** The forwardable nudge line. First name only — the link's pre-filled text
 * becomes the NEXT farmer's source token. */
export function referralNudge(farmerName: string | null): string {
  const first = (farmerName ?? '').trim().split(/\s+/)[0];
  const prefill = first ? `Oi! Vim pelo(a) ${first}` : 'Oi! Vim por indicação';
  const link = `wa.me/${PUBLIC_WA()}?text=${encodeURIComponent(prefill)}`;
  return `\n\n_Conhece outro produtor que ia gostar da Stevi? Manda esse link pra ele: ${link} 🤝_`;
}
