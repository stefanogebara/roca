/**
 * Prospecting safety core — pure, deterministic, and the part that (if wrong)
 * gets our fresh WhatsApp number banned. No I/O here: phone validation,
 * send-eligibility, opt-out/dedup gating, and conservative pacing (daily cap,
 * business hours, batch sizing). Everything downstream (the dispatch engine)
 * MUST route through these. Heavily unit-tested.
 */

// Fresh-number-safe pacing. Deliberately below Olívia's (cap 40/ceiling 80): our
// number is new with an UNKNOWN quality rating, so we ramp gently.
export const DAILY_CAP_DEFAULT = 20;
export const DAILY_CAP_CEILING = 60;
export const BATCH_SIZE = 8;
export const BATCH_DELAY_MS = 45_000;

// Business hours in BRT (UTC−3, no DST in Brazil since 2019). Mon–Fri 09–18.
const BRT_OFFSET_MIN = -180;
const HOURS_START = 9;
const HOURS_END = 18; // exclusive upper bound (last send-hour is 17:xx)
const DAYS = new Set([1, 2, 3, 4, 5]); // Mon–Fri (JS getUTCDay: 0=Sun)

export type WaStatus = 'pending' | 'valid' | 'invalid';
export type ProspectStatus =
  | 'discovered'
  | 'ready'
  | 'contacted'
  | 'replied'
  | 'partner' // promoted — an active partners row exists (terminal, happy)
  | 'stale' // contacted + bumped, never replied past the give-up window (terminal, reactivatable)
  | 'discarded';

export interface ProspectLike {
  phone: string | null;
  /** Number confirmed on WhatsApp by enrichment (site/Instagram/wa.me link).
   * May be a landline. Preferred for sending — see sendablePhone. */
  wa_phone?: string | null;
  /** Where wa_phone was seen. Mandatory for wa_phone to be used. */
  wa_phone_source?: string | null;
  /** Last delivery error from Meta's callback. Only 131026 condemns the
   * number — see numberIsUndeliverable. */
  wa_error?: string | null;
  wa_status: WaStatus;
  status: ProspectStatus;
  send_status: string | null;
}

/**
 * Normalize a raw phone to Brazilian E.164 ("+55DDDNUMBER"), or null if it isn't
 * a valid BR number. NEVER fabricates or guesses — invalid input returns null so
 * the caller marks the prospect `invalid` and never sends. Accepts numbers with
 * or without the +55 country code, common punctuation, and both mobile (9-digit
 * subscriber) and landline (8-digit) forms.
 */
export function normalizePhoneBR(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  // Strip a leading country code if present.
  if (digits.length === 13 && digits.startsWith('55')) digits = digits.slice(2);
  else if (digits.length === 12 && digits.startsWith('55')) digits = digits.slice(2);
  // Now expect a national number: 11 digits (mobile) or 10 (landline).
  if (digits.length !== 10 && digits.length !== 11) return null;
  const ddd = Number(digits.slice(0, 2));
  if (!Number.isInteger(ddd) || ddd < 11 || ddd > 99) return null;
  let sub = digits.slice(2);
  if (sub.length === 9) {
    if (sub[0] !== '9') return null; // BR mobile subscriber starts with 9
  } else if (sub.length === 8) {
    if (/^[2-5]/.test(sub)) {
      // Fixo. Fica como está — enfiar um 9 aqui inventaria um número que não
      // existe, e fixo com wa.me publicado RECEBE WhatsApp (caso coccamig).
    } else if (/^[6-9]/.test(sub)) {
      // CELULAR SEM O NONO DÍGITO. Não é entrada malformada: é o que a Cloud
      // API da Meta entrega como remetente. Conta antiga de WhatsApp no Brasil
      // mantém o JID de 8 dígitos, e o webhook recebe o JID, não o número que
      // discamos. Medido em 05/ago, 10:02, logo após o disparo:
      //
      //   enviado +55 35 9 9750-6635  →  respondeu 55 35 9750-6635
      //   enviado +55 38 9 8874-0493  →  respondeu 55 38 8874-0493
      //
      // Devolver null aqui não era "rejeitar lixo", era PERDER O PROSPECT: o
      // `handleProspectInbound` sai na linha seguinte ao null, ANTES de checar
      // opt-out — um "sair" desses números nunca era visto e o bump seguia. E o
      // que sobrava caía no fluxo de produtor, com a Stevi oferecendo
      // diagnóstico de folha para uma revenda. 12 linhas de `users` nasceram
      // assim, incluindo a Corpal Tratores, cujo autoatendimento gerou o loop
      // de 835 mensagens de 03/ago.
      //
      // 6-9 e não só 9 porque antes da adição do nono dígito o celular
      // brasileiro começava em 6, 7, 8 ou 9; o fixo é que ficou em 2-5.
      sub = `9${sub}`;
      digits = digits.slice(0, 2) + sub;
    } else {
      return null;
    }
  } else {
    return null;
  }
  return `+55${digits}`;
}

/**
 * Números de telefone BR citados num texto livre, em E.164, na ordem em que
 * aparecem e sem repetição.
 *
 * O caso de uso é o handoff: um prospect escreve "fala com o Roberto no (35)
 * 98888-7777" e esse número precisa chegar aos fundadores como botão de
 * WhatsApp. Toda validação é do normalizePhoneBR — inclusive o celular de 8
 * dígitos sem o nono (JID antigo) — então CPF, pedido, dinheiro e data caem
 * fora porque não formam número BR válido, não por regex esperta.
 */
export function extrairNumerosCitados(texto: string | null | undefined): string[] {
  if (!texto) return [];
  const out: string[] = [];
  // Candidato: DDD (com ou sem parênteses/+55) + assinante em 1 ou 2 blocos.
  // Lookarounds impedem fatiar um run de dígitos maior (CPF, protocolo).
  const re = /(?<!\d)(?:\+?55[\s.\-]*)?\(?\d{2}\)?[\s.\-]*\d{4,5}[\s.\-]?\d{4}(?!\d)/g;
  for (const m of texto.matchAll(re)) {
    const norm = normalizePhoneBR(m[0]);
    if (norm && !out.includes(norm)) out.push(norm);
  }
  return out;
}

/**
 * Whether a normalized BR number is a MOBILE line.
 *
 * A SIGNAL, never a send gate. On 27/jul this was briefly used to block every
 * landline, on the inference "every 131026 came from a landline, so landlines
 * can't hold WhatsApp". That reversed the conditional: the base is 71%
 * landlines, so almost everything "comes from a landline". Measured delivery
 * was 39% for landlines vs 50% for mobiles — and 9 of our 14 successful
 * deliveries went to landlines. WhatsApp Business does accept a fixed line
 * (voice-call verification); coccamig even publishes wa.me/553532142166 for its
 * own landline.
 *
 * Shape: +55 DD 9XXXXXXXX (13 digits total). Landlines have 8 subscriber digits.
 */
export function isMobileBR(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  if (digits.length !== 13 || !digits.startsWith('55')) return false;
  return digits[4] === '9'; // 55 + DD(2) + first subscriber digit
}

/**
 * Whether a recorded WhatsApp error condemns the NUMBER (vs. blaming us).
 *
 * `131026 Message undeliverable` means Meta could not reach that number — no
 * WhatsApp account, or it can't receive. Retrying it burns reputation forever.
 *
 * Everything else on our failure list is about OUR account, not the recipient:
 * 131042 (billing — the real cause of the 21/jul outage), 131049 (per-user
 * marketing limit), 130497, 132000 (template shape). Those numbers deserve
 * another chance once we fix our side; condemning them would silently shrink
 * the base for our own mistakes.
 */
export function numberIsUndeliverable(waError: string | null | undefined): boolean {
  return !!waError && /\b131026\b/.test(waError);
}

/**
 * The number we can actually message — i.e. the one we have POSITIVE reason to
 * believe receives WhatsApp. Null means "not reachable yet": the prospect stays
 * in the base for enrichment instead of being deleted.
 *
 * UMA fonte de crença: `wa_phone` com `wa_phone_source` — um número que alguém
 * encontrou e CITOU (site, Instagram, link wa.me). Qualquer número BR válido
 * serve, celular ou fixo: fixo com wa.me publicado recebe WhatsApp Business.
 *
 * O que NÃO serve mais: cair no `phone` do Places quando não há citação. Este
 * comentário sempre disse que "an uncited number is someone's guess, and guesses
 * are what burn the number's reputation" — e o código fazia exatamente o
 * contrário logo abaixo. Em 03/ago o dado desempatou: dos envios do dia, os 6
 * com fonte citada entregaram e os 3 SEM fonte falharam com `131026
 * undeliverable`, 3 de 3. Foi o que estourou o breaker de falhas pós-aceite.
 *
 * O custo de discar o fixo do cadastro não é o envio perdido: cada 131026 é
 * sinal negativo de qualidade para a Meta, no MESMO número que atende produtor.
 * Queimar reputação de canal por um palpite é o pior negócio da casa.
 *
 * Null significa "ainda não alcançável" — o prospect fica na base para
 * enriquecimento, não é descartado. Hoje isso deixa 126 dos 133 `ready` fora da
 * fila, e isso é a verdade do estoque, não uma regressão.
 */
export function sendablePhone(p: {
  phone?: string | null;
  wa_phone?: string | null;
  wa_phone_source?: string | null;
}): string | null {
  return p.wa_phone_source ? normalizePhoneBR(p.wa_phone) : null;
}

/** UTC ISO for the start of the current BRT calendar day (for the daily cap). */
export function brtDayStartIso(now: Date): string {
  const shifted = new Date(now.getTime() + BRT_OFFSET_MIN * 60_000);
  const midnightBrtUtc = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
    3, // 00:00 BRT == 03:00 UTC
    0,
    0
  );
  return new Date(midnightBrtUtc).toISOString();
}

/** BRT wall-clock parts for a given instant (pure; no local-tz dependence). */
function brtParts(now: Date): { day: number; hour: number } {
  const shifted = new Date(now.getTime() + BRT_OFFSET_MIN * 60_000);
  return { day: shifted.getUTCDay(), hour: shifted.getUTCHours() };
}

/** True only inside the allowed outreach window (BRT Mon–Fri 09:00–17:59). */
export function isBusinessHours(now: Date): boolean {
  const { day, hour } = brtParts(now);
  return DAYS.has(day) && hour >= HOURS_START && hour < HOURS_END;
}

/**
 * Can we send a first-touch to this prospect right now? Requires: reviewed & ready,
 * a validated WhatsApp number, not opted out, and never contacted before (dedup).
 * `optouts` is the set of opted-out E.164 numbers.
 */
export function eligibleToSend(p: ProspectLike, optouts: Set<string>): boolean {
  if (p.status !== 'ready') return false;
  if (p.wa_status !== 'valid' || !p.phone) return false;
  const reachable = sendablePhone(p);
  if (!reachable) return false;
  // Meta already told us this exact number can't receive. Retrying it is a
  // guaranteed 131026 that costs reputation and teaches us nothing — unless
  // enrichment since found a DIFFERENT number, which is a fresh first contact.
  if (numberIsUndeliverable(p.wa_error) && reachable === p.phone) return false;
  // Opt-out is checked on BOTH numbers: someone who said SAIR on the landline
  // record must not be reachable through the enriched mobile.
  if (optouts.has(reachable) || optouts.has(p.phone)) return false;
  if (p.send_status != null) return false; // already sent/delivered/failed — never re-blast
  return true;
}

/** Clamp a requested daily cap into [0, ceiling]. */
export function clampDailyCap(requested: number): number {
  if (!Number.isFinite(requested) || requested < 0) return 0;
  return Math.min(Math.floor(requested), DAILY_CAP_CEILING);
}

/**
 * Decide how many to send in this run and return the slice. Honours the daily cap
 * (minus what already went out today) and the per-batch size. Pure — the engine
 * handles the actual send + inter-batch delay.
 */
export function planBatch<T>(
  eligible: T[],
  opts: { dailyCap?: number; sentToday?: number; batchSize?: number } = {}
): T[] {
  const cap = clampDailyCap(opts.dailyCap ?? DAILY_CAP_DEFAULT);
  const sentToday = Math.max(0, Math.floor(opts.sentToday ?? 0));
  const remaining = Math.max(0, cap - sentToday);
  const batch = Math.max(0, Math.min(opts.batchSize ?? BATCH_SIZE, remaining));
  return eligible.slice(0, batch);
}

export interface ParsedProspect {
  name: string;
  phone: string | null;
  wa_status: WaStatus;
  kind: string;
  city: string | null;
  uf: string | null;
}

const VALID_KINDS = new Set(['coop', 'revenda', 'sindicato', 'agronomo']);

/**
 * Parse pasted import lines → prospects. One per line, comma-separated:
 * `nome, telefone[, cidade, uf, tipo]`. Name + phone required. Phones run through
 * normalizePhoneBR — an unparseable number keeps the row but marks it `invalid`
 * (phone null) so ops sees it and it can NEVER be sent. Blank/`#` lines skipped.
 */
export function parseProspectLines(text: string): ParsedProspect[] {
  const out: ParsedProspect[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const parts = t.split(',').map((s) => s.trim());
    const name = parts[0];
    if (!name || parts.length < 2) continue;
    const phone = normalizePhoneBR(parts[1]);
    const kindRaw = (parts[4] ?? '').toLowerCase();
    out.push({
      name,
      phone,
      wa_status: phone ? 'valid' : 'invalid',
      kind: VALID_KINDS.has(kindRaw) ? kindRaw : 'revenda',
      city: parts[2] || null,
      uf: (parts[3] || null)?.toUpperCase() ?? null,
    });
  }
  return out;
}

/**
 * Reconhecer pedido de sair.
 *
 * A versão anterior procurava `parar|sair|descadastr|remover?|não quero|
 * cancelar?|stop` em QUALQUER lugar da frase, e no vocabulário de quem trabalha
 * na roça isso pega conversa normal: "não quero atrapalhar", "vou sair pro
 * campo", "preciso remover as plantas daninhas", "quero parar a pulverização".
 * Cada um desses virava bloqueio permanente — `prospect_optouts` nunca é podado,
 * de propósito, porque é a prova legal — silencioso e sem reversão. O lead
 * morria e ninguém ficava sabendo.
 *
 * A régua nova tem duas portas, e as duas exigem intenção clara:
 *
 * 1. A mensagem INTEIRA é o comando ("sair", "parar", "stop"). Quem quer sair
 *    escreve curto; quem fala de lavoura escreve coisa em volta.
 * 2. A frase diz explicitamente que é sobre RECEBER MENSAGEM ("não quero
 *    receber", "para de mandar", "me tira da lista").
 *
 * Errar para menos aqui é o lado seguro: um opt-out não reconhecido volta na
 * próxima mensagem, e continua havendo a saída manual pelo painel. Um opt-out
 * falso é definitivo.
 */
/**
 * A mensagem INTEIRA é o pedido — ancorada nas duas pontas, e é a âncora que
 * faz o trabalho. "quero sair" casa; "vou sair pro campo agora" não, porque
 * sobra texto depois. "não quero mais" casa; "não quero atrapalhar" e "não
 * quero perder a safra" não, pela mesma razão.
 *
 * O prefixo opcional cobre a educação de quem escreve ("pode parar", "por favor
 * me remove") sem abrir a porta para "vou", "preciso", "tem como" — que são
 * justamente os começos das frases sobre lavoura.
 */
const PEDIDO_INTEIRO =
  /^(?:eu\s+)?(?:quero\s+|queria\s+|pode\s+|podem\s+|favor\s+|pfv\s+|por\s+favor\s+)*(sair|parar|pare|para|stop|cancelar|cancela|descadastrar|remover|me\s+remov\w*|me\s+tir\w*|me\s+exclu\w*|nao\s+quero\s+mais(?:\s+nada)?|nao\s+quero)\s*(?:por\s+favor|pfv|obrigad\w*)?\s*$/;

/** Frases que dizem, com todas as letras, que é sobre a MENSAGEM. */
const SOBRE_MENSAGEM: RegExp[] = [
  // "não quero (mais) receber (mais) ..." e variações sem acento
  /n[ãa]o\s+quero\s+(?:mais\s+)?receber/i,
  /n[ãa]o\s+(?:me\s+)?mand\w*\s+mais/i,
  /n[ãa]o\s+quero\s+mais\s+(?:mensage|contato|nada)/i,
  // "para/pare/parar de (me) mandar|enviar mensagem"
  /\bpar[ae]r?\s+de\s+(?:me\s+)?(?:mandar|enviar)/i,
  // "me tira/remove/exclui da lista"
  /\bme\s+(?:tir[ae]|remov\w+|exclu\w+)\s+d\w*\s+list/i,
  /\bsa[ií]r\s+d\w*\s+list/i,
  // descadastro explícito, em qualquer construção
  /descadastr\w+/i,
  /\bcancelar?\s+(?:o\s+)?(?:envio|contato|mensage\w*)/i,
];

/** Whether an inbound message from a prospect is an opt-out request. */
export function isOptOut(text: string | null | undefined): boolean {
  if (!text) return false;
  const bruto = text.trim();
  if (!bruto) return false;
  // Comando isolado: sem pontuação, sem acento, sem caixa.
  const nu = bruto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (PEDIDO_INTEIRO.test(nu)) return true;
  return SOBRE_MENSAGEM.some((re) => re.test(bruto));
}
