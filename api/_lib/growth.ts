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

import { publicWaNumber } from './waNumber';

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

const PUBLIC_WA = () => publicWaNumber();

/** The forwardable nudge line. First name only — the link's pre-filled text
 * becomes the NEXT farmer's source token. */
export function referralNudge(farmerName: string | null): string {
  const first = (farmerName ?? '').trim().split(/\s+/)[0];
  const prefill = first ? `Oi! Vim pelo(a) ${first}` : 'Oi! Vim por indicação';
  const link = `wa.me/${PUBLIC_WA()}?text=${encodeURIComponent(prefill)}`;
  return `\n\n_Conhece outro produtor que ia gostar da Stevi? Manda esse link pra ele: ${link} 🤝_`;
}

/** Token de origem → nome legível. 'tec-jose' vira 'Tec Jose'. */
function nomeDaOrigem(source: string): string {
  return source
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

/** Origens que NÃO são nome de pessoa — não dá pra dizer "o X te mandou". */
const ORIGEM_SEM_NOME = /^(indica[çc][ãa]o|organico|org[âa]nico|whatsapp|instagram|site)$/i;

/**
 * Origens que são EVENTO, não pessoa nem canal.
 *
 * Quem chega por elas não foi indicado por alguém: encontrou a gente
 * PESSOALMENTE, minutos antes, num estande. Sem isto, `#fecon` cairia no ramo
 * de indicação nominal e a Stevi diria "que bom que o Fecon te mandou aqui" —
 * tratando a feira como se fosse um sujeito. Some-se que a saudação de
 * indicação empresta a confiança de um terceiro que aqui não existe.
 *
 * O caso tem data: a Fecon da Cocatrel (1–3/09/2026) é o primeiro balcão onde
 * o QR impresso encontra cafeicultor de verdade.
 */
const ORIGEM_EVENTO = /^(fecon\d*|feira[a-z0-9-]*|expo[a-z0-9-]*|agrishow\d*)$/i;

/**
 * A primeira resposta a quem chega. Quando veio indicado, cita quem indicou e
 * pergunta da lavoura DELE — em vez do panfleto de funcionalidades.
 *
 * 17/jul: alguém escreveu "Oi! Vim pelo Michel" — indicação nominal de um
 * agrônomo parceiro, a mensagem mais quente que existe. O sistema gravou
 * `source='michel'` certinho e respondeu com o cardápio genérico, sem citar o
 * Michel, terminando em "Como posso ajudar?" — que devolve o trabalho pra quem
 * chegou. A conversa morreu em 4 segundos e ficou 11 dias em silêncio.
 *
 * A informação existia; estava desconectada da decisão. `users.source` era lido
 * só por cohort.ts e pelo digest: métrica, nunca conversa. Mesmo defeito que a
 * Vitória tinha com o menu automático, no outro lado do produto.
 *
 * O indicado já chega com confiança emprestada — não precisa de lista de
 * features, precisa de UMA pergunta sobre o problema dele.
 */
export function saudacaoDeEntrada(source: string | null | undefined): string {
  const s = (source ?? '').trim();
  // Evento vem ANTES da indicação nominal: quem escaneou o QR no estande
  // acabou de conversar com a gente e não precisa ser apresentado ao produto —
  // precisa de uma pergunta sobre a lavoura dele enquanto ainda está ali.
  if (s && ORIGEM_EVENTO.test(s)) {
    return (
      `Opa! Que bom te encontrar na ${nomeDaOrigem(s)}. 🌱 Sou a Stevi, a ajudante de lavoura que ` +
      `te mostraram ali — funciona por aqui mesmo, no WhatsApp. Me manda uma foto de folha ou praga ` +
      `que eu já dou uma olhada, ou me conta o que tá te preocupando na sua lavoura agora.`
    );
  }
  if (s && !ORIGEM_SEM_NOME.test(s)) {
    return (
      `Opa! Que bom que o ${nomeDaOrigem(s)} te mandou aqui. 🌱 Sou a Stevi — ajudo a entender o que ` +
      `tá acontecendo na lavoura (quem prescreve produto é o agrônomo, isso eu não faço). ` +
      `Me conta: o que tá te preocupando na sua lavoura agora?`
    );
  }
  if (s) {
    return (
      `Opa! Que bom receber uma indicação. 🌱 Sou a Stevi — ajudo a entender o que tá acontecendo ` +
      `na lavoura (quem prescreve produto é o agrônomo, isso eu não faço). ` +
      `Me conta: o que tá te preocupando na sua lavoura agora?`
    );
  }
  return (
    'Opa! Eu sou a Stevi, sua ajudante de lavoura aqui no WhatsApp. 🌱 Você pode me mandar foto de uma ' +
    'folha ou praga pra eu dar uma olhada, perguntar "posso pulverizar hoje?" (me manda sua localização), ' +
    'ou tirar dúvidas sobre soja, milho, pasto, café e citros. Importante: eu ajudo a entender e a saber ' +
    'o que perguntar — quem prescreve produto é o agrônomo. Como posso ajudar?'
  );
}
