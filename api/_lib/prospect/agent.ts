/**
 * Prospect conversation agent — the "Olívia" layer for partnerships. After the
 * template first-touch, replies from prospects (agronomists, revendas, coops)
 * are handled by this persona: it explains Stevi honestly, runs the 3
 * validation questions one at a time, and captures qualification (coverage,
 * crops, lead-format preference). Founders manage it from /painel: per-prospect
 * thread view + agent on/off (human takeover).
 *
 * Guardrails, in the house style (prompt → trigger check → output gate):
 * - Pricing/negotiation, contract terms, and "quero falar com uma pessoa"
 *   ESCALATE — the agent never negotiates; founders get a WhatsApp ping.
 * - The output gate blocks any reply stating prices or committing terms; a
 *   blocked reply degrades to an honest handoff line, never silence.
 */

import { chat, chatDetailed } from '../llm';
import { MODELS } from '../env';
import { withRetry } from '../retry';
import { loadPlaybook, playbookBlock } from './learn';
import { createLogger } from '../logger';

const log = createLogger('prospect-agent');

// Named after the cofounder — prospects talk "with Vitória". A prospect who
// explicitly asks to talk to a person still escalates (the trigger includes
// her name), so the human Vitória can take over her namesake's thread.
export const AGENT_NAME = process.env.PROSPECT_AGENT_NAME || 'Vitória';

// ── Escalation triggers (inbound) ───────────────────────────────────────────

const ESCALATE_RE =
  /\b(quanto\s+(\S+\s+){0,2}(custa\w*|cobra\w*|fica|sai)|pre[çc]o|valor|proposta|or[çc]amento|comiss[ãa]o)\b|\b(falar|conversar)\s+com\s+(o|a|um|uma)?\s*(stefano|vit[óo]ria|fundador|pessoa|humano|respons[áa]vel)\b|\bme\s+lig|liga[çc][ãa]o|\bcontrato\b|exclusividade/i;

/** Whether an inbound prospect message must be escalated to the founders. */
export function needsEscalation(text: string | null | undefined): boolean {
  return !!text && ESCALATE_RE.test(text);
}

// ── Output gate ──────────────────────────────────────────────────────────────

const PRICE_COMMIT_RE =
  /R\$\s?\d|\b\d+\s+(reais|por\s+lead|por\s+indica[çc][ãa]o)\b|\bcontrato\s+de\s+exclusividade|fechamos\s+contrato/i;

const GATE_FALLBACK =
  `Essa parte é com o Stefano (fundador) — vou pedir pra ele te responder direto por aqui, hoje ainda. ` +
  `Enquanto isso, posso te adiantar qualquer coisa sobre como a Stevi funciona!`;

export interface GateResult {
  safe: boolean;
  text: string;
}

/** Last line before an agent reply leaves: never state prices or commit terms. */
export function gateAgentReply(reply: string): GateResult {
  if (PRICE_COMMIT_RE.test(reply)) return { safe: false, text: GATE_FALLBACK };
  return { safe: true, text: reply };
}

// A model with nothing to say sometimes narrates that fact instead of staying
// quiet — "(sem resposta)", "[silêncio]", "…". On 28/jul we shipped nine of
// those verbatim to a real business. Anything wrapped in brackets/parens, or
// pure punctuation, is stage direction, not a message.
const PLACEHOLDER_RE = /^[([{]?\s*(sem\s+(resposta|retorno|coment[áa]rio)|nenhuma\s+resposta|sil[êe]ncio|n\/?a|null|none|vazio)\s*[)\]}]?[.!]?$/i;

/**
 * Whether an agent reply must NOT be sent. Silence is a valid turn; a
 * placeholder describing silence is not.
 */
export function isNonReply(reply: string | null | undefined): boolean {
  const t = (reply ?? '').trim();
  if (!t) return true;
  if (PLACEHOLDER_RE.test(t)) return true;
  // Pure punctuation/ellipsis/dashes carry no message.
  return !/[\p{L}\p{N}]/u.test(t);
}

/**
 * What the agent decided to do this turn. Staying quiet is a first-class
 * outcome — the whole point of the union.
 *
 * Before this existed, `buildAgentReply` returned `string`, so a model told to
 * "stop and not talk to a robot" had no way to comply: on 28/jul it wrote the
 * words "(sem resposta)" nine times and the pipeline shipped every one. A rule
 * in the prompt is not an execution mechanism; a type is.
 */
export type AgentAction =
  | { tipo: 'responder'; texto: string }
  /** `deliberado`: ela ESCOLHEU calar (robô do outro lado, nada a dizer) — um
   * acerto. Falso quando o silêncio veio de defeito nosso (truncou, veio
   * vazio, modelo caiu). Contar os dois como a mesma coisa faz o gym punir a
   * Vitória por falha de infraestrutura. */
  | { tipo: 'silencio'; motivo: string; deliberado: boolean };

/** The word the agent is told to emit when the right move is to say nothing. */
export const SILENCE_SENTINEL = 'SILENCIO';

const isSentinel = (t: string): boolean =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.!]+$/, '')
    .trim()
    .toUpperCase() === SILENCE_SENTINEL;

/**
 * Turn a raw model completion into an action. Pure.
 *
 * `finishReason` comes from the provider: 'length' means the model was cut off
 * mid-sentence, and half a message is worse than none.
 */
export function interpretAgentOutput(raw: string | null | undefined, finishReason?: string): AgentAction {
  const texto = (raw ?? '').trim();
  // Falhas primeiro: meia mensagem é pior que nenhuma, e nada disso é escolha dela.
  if (finishReason === 'length')
    return { tipo: 'silencio', motivo: 'resposta truncada (max_tokens)', deliberado: false };
  if (!texto) return { tipo: 'silencio', motivo: 'resposta vazia do modelo', deliberado: false };
  // Decisões: o sentinela é a forma certa; o placeholder é a mesma intenção
  // expressa errado (ela quis calar e escreveu que ia calar).
  if (isSentinel(texto))
    return { tipo: 'silencio', motivo: 'o agente escolheu não responder', deliberado: true };
  if (isNonReply(texto))
    return { tipo: 'silencio', motivo: `placeholder do modelo: ${texto.slice(0, 40)}`, deliberado: true };
  return { tipo: 'responder', texto };
}

const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');

// ── Porteiro: reconhecer atendimento automático ──────────────────────────────

/**
 * Institutional-autoresponder signatures. Deliberately generic (no vertical
 * jargon): what marks a bot is the FORM — a numbered menu, a protocol number,
 * an opening-hours notice — not the industry.
 *
 * Layer 1 of the porteiro. Layer 2 (ecoDeMaquina) catches the ones no regex
 * anticipates, because a bot repeats itself verbatim and a person doesn't.
 */
const AUTO_ATENDIMENTO_PATTERNS: RegExp[] = [
  /\bdigite\s+\d/i,
  /\b(?:tecle|pressione)\s+\d/i,
  /\[\s*\d\s*\]/, // "[ 1 ] - Vendas"
  /\bop[çc][ãa]o\s+desejada\b/i,
  /\bagradec\w+\s+(?:o\s+)?(?:seu|sua)\s+(?:contato|mensagem|prefer[êe]ncia|solicita[çc][ãa]o)/i,
  /\bhor[áa]rios?\s+de\s+(?:atendimento|funcionamento)\b/i,
  /\bhor[áa]rios?\s*:/i,
  /\best(?:amos|[áa])\s+fechad[oa]s?\b/i,
  /\bfalar\s+com\s+(?:um\s+|o\s+|a\s+)?atendente\b/i,
  /\bprotocolo\s*(?:n[ºo°]?\s*)?\d/i,
  /\bem\s+(?:alguns\s+)?instantes\b/i,
  /\b(?:em\s+breve\s+)?retornaremos\b/i,
  /\bmensagem\s+autom[áa]tica\b/i,
  /\bn[ãa]o\s+responda\s+(?:a\s+)?esta\s+mensagem\b/i,
];

/** Whether an inbound looks like an automated attendant rather than a person. */
export function pareceAutoAtendimento(text: string | null | undefined): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  return AUTO_ATENDIMENTO_PATTERNS.some((re) => re.test(t));
}

// A person repeats "ok", "sim", "blz" all day; a bot repeats a paragraph. Below
// these floors, identical text is human, not machine.
const ECO_MIN_CHARS = 40;
const ECO_MIN_PALAVRAS = 5;

/**
 * Whether the counterpart just re-sent something it already sent — the tell of
 * an autoresponder no pattern list anticipated. Only INBOUND turns count: our
 * own repetition is our bug, not their loop.
 */
export function ecoDeMaquina(
  thread: Array<{ direction: string; text: string | null }>,
  inboundText: string
): boolean {
  const alvo = norm(inboundText);
  if (!alvo) return false;
  if (alvo.length < ECO_MIN_CHARS && alvo.split(' ').length < ECO_MIN_PALAVRAS) return false;
  return thread.some((m) => m.direction === 'in' && norm(m.text ?? '') === alvo);
}

/**
 * Polite attempts to reach a human past a bot before parking the lead.
 *
 * Two, not one. On 28/jul the founder answered the Agro.com menu with "1" and
 * it WORKED — a human (Felipe Augusto) picked up, the first of the whole
 * campaign. Giving up on the first automated reply would have killed that lead;
 * a third attempt is just stubbornness.
 */
export const PORTEIRO_MAX = 2;

/** Whether we've already spent our attempts at getting past the bot. */
export function porteiroEsgotado(tentativas: number): boolean {
  return (tentativas ?? 0) >= PORTEIRO_MAX;
}

// ── Cadência: teto nas nossas próprias falas ─────────────────────────────────

/**
 * Minimum gap between two messages OF OURS to the same prospect. Meta's quality
 * systems read rapid-fire as spraying, and so does a human watching a phone.
 *
 * 28/jul: 12 outbound messages in 2 minutes to one shop. Per-message dedup
 * (claimInbound) can't see this — each inbound was a DIFFERENT message, so each
 * concurrent invocation legitimately claimed its own and replied.
 */
export const MIN_GAP_MS = 20_000;

/** Whether enough time passed since our last message to speak again. */
export function podeFalarDeNovo(lastOutAt: Date | null | undefined, now: Date): boolean {
  if (!lastOutAt) return true;
  const t = lastOutAt.getTime();
  if (!Number.isFinite(t)) return true; // unreadable timestamp must not mute us
  return now.getTime() - t >= MIN_GAP_MS;
}


// ── Persona ──────────────────────────────────────────────────────────────────

export function agentSystemPrompt(name: string): string {
  return (
    `Você é ${name}, assistente de parcerias da Stevi — uma assistente agronômica gratuita que vive no WhatsApp ` +
    `para produtores de café e grãos do Sul de Minas. Você conversa com POTENCIAIS PARCEIROS ` +
    `(agrônomos, consultorias, revendas, cooperativas), não com produtores.\n\n` +
    `FATOS sobre a Stevi (use só isto; nunca invente números, features ou clientes):\n` +
    `- Gratuita pro produtor; funciona 100% no WhatsApp.\n` +
    `- Faz triagem por foto de praga/doença (baseada no registro Agrofit/MAPA), veredito de janela de ` +
    `pulverização (Delta T), leitura de satélite da lavoura, alertas automáticos de geada, queimada e vazio sanitário.\n` +
    `- NUNCA prescreve produto nem dose — receituário é ato do agrônomo. Por isso existe a parceria: ` +
    `quando um produtor precisa de receituário, a Stevi indica um agrônomo parceiro da região.\n` +
    `- O lead chega pro parceiro com foto, triagem, cultura, localização e histórico já organizados, com ` +
    `consentimento do produtor.\n` +
    `- Fase atual: validação — os primeiros parceiros recebem leads DE GRAÇA. Preços e contratos ainda não ` +
    `estão definidos.\n\n` +
    `ABERTURA (primeira resposta sua na conversa): apresente-se JÁ como assistente digital — ` +
    `"aqui é a ${name}, assistente digital da equipe da Stevi" — sem pedir desculpa e sem esperar ` +
    `que perguntem. Disclosure proativa é exigência de política do WhatsApp para experiência ` +
    `automatizada, e é o que protege o número: assistente declarada gera curiosidade, pessoa ` +
    `falsa desmascarada gera denúncia (e denúncia derruba o canal inteiro do negócio).\n\n` +
    `SUA MISSÃO nesta conversa, nesta ordem e no ritmo do prospect:\n` +
    `1. Entender como chega cliente novo pra ele hoje (indicação? redes?).\n` +
    `2. Validar: se recebesse um produtor da região dele, já triado, precisando de receituário — atenderia? Em quanto tempo?\n` +
    `3. Entender que formato prefere (por lead, mensalidade, outro) — SEM negociar valores.\n` +
    `4. Capturar quais municípios/regiões e culturas ele atende.\n\n` +
    `REGRAS DURAS:\n` +
    `- **REGRA ZERO — a sua PRIMEIRA mensagem desta conversa TEM que abrir se identificando como IA: ` +
    `"aqui é a ${name}, sou a assistente digital (uma IA) da equipe da Stevi". Não é opcional, não espera ` +
    `pergunta, não é na segunda mensagem. Se você já falou antes nesta thread, não repita.\n` +
    `  CUIDADO com a ambiguidade: a Stevi É "uma assistente agronômica gratuita no WhatsApp" — isso ` +
    `descreve o PRODUTO, não você. Dizer "sou assistente gratuita no WhatsApp" NÃO cumpre a regra zero; ` +
    `o interlocutor precisa entender que quem digita é automatizado. Use "assistente digital" ou "IA" ` +
    `explicitamente, sobre VOCÊ.**\n` +
    `- Faça no máximo UMA pergunta por mensagem. Curto, tom profissional-caloroso, pt-BR.\n` +
    `- NUNCA cite preço ou valor (nem exemplos). Perguntas de preço/contrato/ligação: diga que o Stefano ` +
    `responde direto, hoje ainda.\n` +
    `- Se o prospect pedir pra falar direto com o Stefano (ou disser que só trata detalhes com ele), PARE de ` +
    `qualificar: confirme que o Stefano chama hoje ainda e encerre cordialmente. Não faça mais perguntas.\n` +
    `- COMO FICAR EM SILÊNCIO: quando o certo for não responder, escreva só a palavra ${SILENCE_SENTINEL} ` +
    `e nada mais. Nunca escreva "(sem resposta)", "[silêncio]" ou qualquer descrição de que você não vai ` +
    `responder — isso É uma mensagem e chega no WhatsApp da pessoa.\n` +
    `- Se a resposta parecer atendimento automático (menu numerado, protocolo, "digite 1"), responda UMA única ` +
    `vez pedindo pra chegar ao responsável técnico/agronômico. Se vier outra mensagem automática depois ` +
    `dessa, responda ${SILENCE_SENTINEL} — não converse com robô.\n` +
    `- Se não souber, diga que confirma com os fundadores. Nunca invente.\n` +
    `- Se ele indicar outra pessoa (contato compartilhado), agradeça e confirme que os fundadores vão falar com ela.\n` +
    `- Se perguntarem se você é robô/IA depois de você já ter se apresentado (regra zero): confirme sem ` +
    `rodeio ("isso mesmo, sou assistente digital — quem fala com você depois é o Stefano, humano") e siga ` +
    `a conversa. Nunca minimize nem desconverse: assistente declarada gera curiosidade, pessoa falsa ` +
    `desmascarada gera denúncia — e denúncia derruba o número inteiro do negócio.\n` +
    `- Se perguntarem de onde veio o contato ("de onde pegou meu número?", LGPD): a verdade — contato ` +
    `comercial público (site ou diretório da própria empresa) — e ofereça remoção imediata: "se preferir ` +
    `não receber mais nada, responde SAIR que eu removo agora". Nunca desconverse sobre dados.\n` +
    `- Sobre o número +1 (americano), se estranharem: a verdade sem prometer prazo — o registro do WhatsApp ` +
    `Business foi feito nos EUA e o número brasileiro ainda não saiu; é a mesma equipe, e quem quiser ` +
    `confirmar pode ver a página de verificação (com o agrônomo responsável e o CREA) ou falar com o Stefano. ` +
    `NUNCA diga "está em processo", "sai semana que vem" ou qualquer prazo — não existe prazo.\n` +
    `- AVANÇO: a partir da 2ª ou 3ª troca, se houver qualquer sinal de interesse, proponha o próximo passo ` +
    `concreto e leve — uma conversa de 15 min com o Stefano OU um piloto com 10 produtores da região dele. ` +
    `Peça um dia/período ("quinta de manhã serve?"). Interesse sem próximo passo marcado esfria.\n` +
    `- ENCERRAMENTO: se disser que não tem interesse, agradeça em UMA linha, deixe a porta aberta e PARE ` +
    `de perguntar. Nunca insista.`
  );
}

// ── Thread formatting ────────────────────────────────────────────────────────

export interface ThreadTurn {
  direction: 'in' | 'out';
  text: string | null;
}

export function formatThreadBlock(turns: ThreadTurn[], name: string): string {
  const lines = turns
    .filter((t) => t.text)
    .map((t) => `${t.direction === 'in' ? 'Prospect' : name}: ${(t.text as string).replace(/\s+/g, ' ').slice(0, 300)}`);
  return lines.length
    ? `[Conversa até aqui — continue dela, não se reapresente]\n${lines.join('\n')}`
    : '';
}

// ── Reply generation ─────────────────────────────────────────────────────────

/**
 * Generate the agent's next reply for a prospect thread. The inboundText must
 * already be normalized (voice transcribed, image described, vCard summarized).
 */
export async function buildAgentReply(
  prospectName: string,
  thread: ThreadTurn[],
  inboundText: string
): Promise<AgentAction> {
  const history = formatThreadBlock(thread, AGENT_NAME);
  const user =
    (history ? history + '\n\n' : '') +
    `[Prospect: ${prospectName}]\n` +
    `Nova mensagem do prospect: ${inboundText}\n\n` +
    `Responda como ${AGENT_NAME} (só o texto da mensagem, tamanho WhatsApp). ` +
    `Se o certo for não responder, escreva só ${SILENCE_SENTINEL}.`;

  // Market learnings (weekly-mined) are appended as an informational block;
  // a load failure only costs the learnings, never the reply.
  const learned = playbookBlock(await loadPlaybook().catch(() => []));

  let raw: string;
  let finishReason: string | null;
  try {
    ({ text: raw, finishReason } = await withRetry(
      () =>
        chatDetailed({
          model: MODELS.reasoning(),
          system: agentSystemPrompt(AGENT_NAME) + (learned ? `\n\n${learned}` : ''),
          // 400 cabia o texto (respostas de 150-200 chars) mas não o raciocínio
          // do Sonnet-5 quando ele pensa mais — e aí o turno virava silêncio por
          // truncamento. Cap não é cobrança: só se paga o que for gerado.
          maxTokens: 1200,
          user,
        }),
      { attempts: 2 }
    ));
  } catch (e) {
    // A dead model is not a decision to stay quiet, but sending nothing is the
    // safe failure direction — the founder is paged by the caller.
    return { tipo: 'silencio', motivo: `erro no modelo: ${(e as Error).message.slice(0, 80)}`, deliberado: false };
  }

  const action = interpretAgentOutput(raw, finishReason ?? undefined);
  if (action.tipo === 'silencio') return action;

  const gated = gateAgentReply(action.texto);
  if (!gated.safe) log.error('agent reply gated (price/terms):', action.texto.slice(0, 120));
  return { tipo: 'responder', texto: gated.text };
}

// ── Qualification extraction ─────────────────────────────────────────────────

export interface Qualification {
  acquisition?: string | null;
  accepts_leads?: boolean | null;
  response_time?: string | null;
  format_pref?: string | null;
  coverage?: string[] | null;
  crops?: string[] | null;
}

/** Extract structured qualification from the whole thread (cheap tier, JSON). */
export async function extractQualification(thread: ThreadTurn[]): Promise<Qualification | null> {
  const convo = thread
    .filter((t) => t.text)
    .map((t) => `${t.direction === 'in' ? 'PROSPECT' : 'AGENTE'}: ${t.text}`)
    .join('\n')
    .slice(-4000);
  if (!convo) return null;
  try {
    const raw = await chat({
      model: MODELS.router(),
      maxTokens: 250,
      system:
        'Extraia do diálogo os fatos sobre o PROSPECT (parceiro potencial). Responda SÓ JSON válido com as chaves: ' +
        'acquisition (como consegue clientes hoje, string|null), accepts_leads (bool|null), response_time (string|null), ' +
        'format_pref ("por lead"|"mensalidade"|outro|null), coverage (array de municípios|null), crops (array|null). ' +
        'null quando o diálogo não disser. Nunca invente.',
      user: convo,
    });
    const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
    return JSON.parse(json) as Qualification;
  } catch (e) {
    log.error('qualification extraction failed:', (e as Error).message);
    return null;
  }
}
