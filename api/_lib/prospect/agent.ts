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
  // Sem prazo: ela não controla a agenda do Stefano, e prometer "hoje ainda"
  // deixa o prospect enganado se ele não responder hoje. Destino sim, prazo não.
  `Essa parte é com o Stefano (fundador) — já vou pedir pra ele te responder direto por aqui. ` +
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
  // A folga [^\p{L}\p{N}]{0,4} entre o verbo e o dígito existe porque bots
  // escrevem "digite **2**", "Digite: 1", 'digite "3"'. Achado pelo gym em
  // 29/jul, depois de ligá-lo no caminho real: sem ela o padrão não pegou o
  // "digite **2**" da Coopagro e a Vitória deu despedida de humano a um robô.
  /\bdigite[^\p{L}\p{N}]{0,4}\d/iu,
  /\b(?:tecle|pressione)[^\p{L}\p{N}]{0,4}\d/iu,
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
 * Tentativas de furar o robô antes de parquear o lead. UMA.
 *
 * Era 2, justificado pelo caso da Agro.com de 28/jul: o fundador respondeu "1"
 * ao menu e FUNCIONOU — o Felipe Augusto apareceu, primeiro humano da campanha.
 * O raciocínio estava errado, e o juiz pareado de 29/jul mostrou por quê:
 *
 *   conducao → "a segunda conversa INSISTE ao REPETIR a mesma mensagem"
 *   correcao → "a versão antiga cessou as mensagens; a nova insistiu"
 *
 * O "1" foi um HUMANO navegando o menu. A Vitória é proibida de navegar menu
 * (está nas regras do prompt), então a segunda tentativa dela não tem para onde
 * ir: só pode repetir o mesmo pedido com outras palavras — e repetir com robô é
 * exatamente o que o porteiro existe para evitar.
 *
 * Usei evidência de uma ação humana para justificar comportamento de um agente
 * que não pode executar aquela ação.
 *
 * O caminho do Felipe segue aberto: o fundador manda o "1" pelo painel quando
 * quiser furar um menu. Isso é decisão humana, não da agente.
 */
const PORTEIRO_MAX_RAW = Number(process.env.PROSPECT_PORTEIRO_MAX ?? '1');
/** Ajustável por env só para o experimento pareado poder comparar 1 vs 2 sem
 * editar código no meio da medição. Clamp em [1, 3]: env malformada não pode
 * virar 0 (nunca tenta) nem 99 (insiste com robô a tarde inteira). */
export const PORTEIRO_MAX =
  Number.isFinite(PORTEIRO_MAX_RAW) ? Math.min(3, Math.max(1, Math.floor(PORTEIRO_MAX_RAW))) : 1;

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
    `- NUNCA repita pergunta que você já fez nesta conversa, nem reformulada. Antes de perguntar, releia o ` +
    `histórico: se ele já respondeu, avance pro próximo assunto ou proponha o próximo passo.
` +
    `- Faça no máximo UMA pergunta por mensagem. Curto, tom profissional-caloroso, pt-BR.\n` +
    `- NUNCA cite preço ou valor (nem exemplos). Perguntas de preço/contrato/ligação: diga que o Stefano ` +
    `responde direto por aqui. NUNCA prometa prazo ("hoje ainda", "amanhã"): a agenda dele não é sua.\n` +
    `- Se o prospect pedir pra falar direto com o Stefano (ou disser que só trata detalhes com ele), PARE de ` +
    `qualificar: confirme que vai chamar o Stefano e encerre cordialmente, SEM prometer prazo. Não faça ` +
    `mais perguntas.\n` +
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
    `Pergunte qual dia e período é melhor PRA ELE ("que dia da semana costuma ser melhor pra vocês, e ` +
    `manhã ou tarde?"). NUNCA crave um horário nem prometa a agenda do Stefano — você não tem acesso a ` +
    `ela, e marcar por ele é prometer disponibilidade de terceiro. Interesse sem próximo passo esfria, ` +
    `mas próximo passo em cima de horário inventado esfria pior.\n` +
    `- ENCERRAMENTO: se disser que não tem interesse, agradeça em UMA linha, deixe a porta aberta e PARE ` +
    `de perguntar. Nunca insista.`
  );
}

// ── Thread formatting ────────────────────────────────────────────────────────

export interface ThreadTurn {
  direction: 'in' | 'out';
  text: string | null;
}

/** O que o bloco de correção precisa consertar — muda o diagnóstico que ele dá. */
export type MotivoCorrecao = 'repeticao' | 'duas-perguntas' | 'prazo';

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
  inboundText: string,
  turno: TurnoContexto = { robo: false, tentativa: 0 }
): Promise<AgentAction> {
  const history = formatThreadBlock(thread, AGENT_NAME);
  const user =
    (history ? history + '\n\n' : '') +
    `[Prospect: ${prospectName}]\n` +
    `Nova mensagem do prospect: ${inboundText}\n\n` +
    `Responda como ${AGENT_NAME} (só o texto da mensagem, tamanho WhatsApp). ` +
    `Se o certo for não responder, escreva só ${SILENCE_SENTINEL}.` +
    dicaDeTurno(turno);

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

  // Silêncio diante de gente vira encerramento; diante de robô, continua
  // silêncio. Ver resolverSilencio.
  // Uma vez despedida, silencio nao pode virar a mesma despedida de novo.
  const fecho = { jaSeDespediu: jaSeDespediu(thread), recusou: recusou(inboundText) };

  let action = resolverSilencio(
    interpretAgentOutput(raw, finishReason ?? undefined),
    turno,
    prospectName,
    fecho
  );

  // Gate de repetição: o juiz pareado pegou "repetiu a mesma pergunta após uma
  // resposta clara" no cenário da coop. Regra no prompt não basta (quinta vez
  // que isso se confirma em 29/jul), então há UMA retentativa avisando o modelo
  // do que ele acabou de repetir. Se repetir de novo, é sinal de que não há
  // assunto novo: vira silêncio deliberado, que diante de gente resolverSilencio
  // converte em encerramento.
  const motivo: MotivoCorrecao | null =
    action.tipo !== 'responder'
      ? null
      : repeticaoNossa(thread, action.texto)
        ? 'repeticao'
        : perguntasDemais(action.texto)
          ? 'duas-perguntas'
          : prometeuPrazo(action.texto)
            ? 'prazo'
            : null;

  if (action.tipo === 'responder' && motivo) {
    log.error(`agent ${motivo} — 1 retentativa: "${action.texto.slice(0, 70)}"`);
    try {
      const r2 = await chatDetailed({
        model: MODELS.reasoning(),
        system: agentSystemPrompt(AGENT_NAME) + (learned ? `

${learned}` : ''),
        maxTokens: 1200,
        user: user + '\n\n' + blocoCorrecao(action.texto, motivo),
      });
      const a2 = resolverSilencio(
        interpretAgentOutput(r2.text, r2.finishReason ?? undefined),
        turno,
        prospectName,
        fecho
      );
      // Reincidir NÃO vira mais silêncio. Silêncio deliberado diante de gente é
      // convertido em DESPEDIDA por resolverSilencio ("não vou insistir"), e o
      // juiz pareado mediu isso como erro grave em quer-fechar-agora: despedir
      // de quem está entusiasmado esfria o lead. "Não tenho pergunta nova" e
      // "ele não quer falar comigo" estavam na mesma ação — não estão mais.
      // Pergunta meio repetida custa pouco; despedida com prospect vivo custa o
      // lead. Mando a segunda tentativa e registro.
      if (
        a2.tipo === 'responder' &&
        (repeticaoNossa(thread, a2.texto) || perguntasDemais(a2.texto) || prometeuPrazo(a2.texto))
      )
        log.error(`retentativa ainda ${motivo} — mando assim mesmo, despedida é pior`);
      action = a2;
    } catch (e) {
      log.error('retentativa anti-repetição falhou:', (e as Error).message);
    }
  }

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
      // Extração barata, saída minúscula: 10s é folgado. O default de 25s
      // aqui é orçamento roubado da composição, que é quem precisa dele.
      timeoutMs: 10_000,
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

// ── Dica de turno: contar pro modelo o que o porteiro descobriu ──────────────

export interface TurnoContexto {
  /** O porteiro identificou atendimento automático nesta mensagem. */
  robo: boolean;
  /** Quantas tentativas de furar o robô já gastamos (0 = esta é a primeira). */
  tentativa: number;
}

/**
 * Instrução extra pro modelo, derivada do que o porteiro DETERMINISTICAMENTE já
 * descobriu.
 *
 * Existe porque o pareado de 28/jul perdeu dois cenários pela mesma raiz: o
 * porteiro detectava o robô e não contava pro modelo. Ele caía no
 * buildAgentReply sem saber com quem falava, e o juiz viu — "a segunda ignorou
 * a dica do bot e ficou em um impasse".
 *
 * É a terceira vez hoje que o mesmo defeito aparece (regra no prompt sem
 * gate; números enriquecidos sem ordenação; indicação sem chegar na resposta).
 * A forma é sempre: o dado existia e não estava ligado na decisão.
 *
 * Vazio quando é gente do outro lado — não poluir o prompt do caso normal.
 */
export function dicaDeTurno(ctx: TurnoContexto): string {
  if (!ctx.robo) return '';
  if (ctx.tentativa >= PORTEIRO_MAX) {
    return (
      `\n\n[TURNO] A última mensagem é de atendimento AUTOMÁTICO, e já tentamos ${PORTEIRO_MAX}x chegar ` +
      `numa pessoa. Encerre em UMA linha, agradecendo e deixando a porta aberta. Não pergunte nada, ` +
      `não repita o pedido, não faça pitch.`
    );
  }
  return (
    `\n\n[TURNO] A última mensagem é de atendimento AUTOMÁTICO (menu, protocolo, horário). Não converse ` +
    `com o robô nem tente navegar o menu. Em UMA linha, peça pra ser encaminhada ao responsável técnico ` +
    `ou agronômico da empresa. Sem pitch, sem outra pergunta.`
  );
}

/**
 * Silêncio deliberado é a coisa certa diante de uma MÁQUINA. Diante de gente,
 * some da conversa sem fechar a porta — e o juiz do pareado classificou isso
 * como erro grave em `manda-material`: "comete erro grave ao ficar em silêncio,
 * equiparado a mensagem vazia ou inútil".
 *
 * Então: robô → silêncio; humano → uma linha de encerramento. Silêncio por
 * FALHA (truncou, veio vazio) nunca vira mensagem: não foi decisão dela, e
 * inventar despedida em cima de um bug esconderia o bug.
 */
export function resolverSilencio(
  acao: AgentAction,
  ctx: { robo: boolean },
  prospectName: string,
  /**
   * O que autoriza (ou proíbe) encerrar agora.
   *
   * A despedida era resposta UNIVERSAL: o mesmo "não vou insistir" saía para
   * "ele recusou", "ele está animado" e "não tenho o que dizer". No gym de
   * 30/jul ela respondeu isso a um "fica ligado, qualquer coisa me chama! 👍",
   * como se o cara tivesse batido a porta. Encerrar é um ATO, não um default.
   */
  fecho: { jaSeDespediu: boolean; recusou: boolean } = { jaSeDespediu: false, recusou: false }
): AgentAction {
  if (acao.tipo !== 'silencio' || !acao.deliberado || ctx.robo) return acao;
  // Só encerra quem recusou, e só uma vez. Nos outros casos silêncio deliberado
  // é silêncio de verdade — não mandar nada é melhor que mandar despedida a
  // quem não se despediu.
  if (!fecho.recusou || fecho.jaSeDespediu) return acao;
  const nome = (prospectName ?? '').trim();
  return {
    tipo: 'responder',
    texto:
      `Tudo bem, ${nome ? nome + ', ' : ''}não vou insistir. 🌱 Fico à disposição por aqui se um dia ` +
      `fizer sentido receber produtores da região com o caso técnico já organizado. Bom trabalho!`,
  };
}

// ── A decisão de turno, separada dos efeitos ─────────────────────────────────

export interface EstadoDoTurno {
  /** Thread já gravada, mais antiga primeiro. */
  thread: Array<{ direction: string; text: string | null; created_at?: string }>;
  inboundText: string;
  /** Tentativas de furar robô já gastas neste prospect. */
  tentativas: number;
  /** false = fundador assumiu a conversa no painel. */
  agenteLigado: boolean;
  agora: Date;
}

export type DecisaoTurno =
  | { acao: 'humano-assumiu' }
  | { acao: 'porteiro-esgotado' }
  | { acao: 'segurar-cadencia'; desdeMs: number }
  | { acao: 'responder'; turno: TurnoContexto };

/**
 * O que fazer neste turno, ANTES de chamar o LLM. Pura de propósito.
 *
 * Existia embutida no respondAsProspectAgent, junto dos efeitos (gravar,
 * alertar, contar tentativa) — e por isso o gym não passava por ela: ele chama
 * buildAgentReply direto, e um harness que não passa pelos freios testa o
 * cérebro sem os freios.
 *
 * O custo disso foi concreto: rodei o juiz pareado duas vezes sobre mudanças no
 * porteiro que o gym não exercitava, e ele devolveu "reverta a mudança" com
 * confiança, comparando duas rodadas comportamentalmente idênticas.
 *
 * Precedência, explícita porque a ordem é a decisão:
 *   takeover humano > porteiro > cadência > responder
 * Parquear vence esperar: se o outro lado é robô e as tentativas acabaram, não
 * há motivo para segurar a vez — a conversa terminou.
 */
export function decidirTurno(e: EstadoDoTurno): DecisaoTurno {
  if (!e.agenteLigado) return { acao: 'humano-assumiu' };

  const robo = pareceAutoAtendimento(e.inboundText) || ecoDeMaquina(e.thread, e.inboundText);
  if (robo && porteiroEsgotado(e.tentativas)) return { acao: 'porteiro-esgotado' };

  const ultimaNossa = [...e.thread].reverse().find((m) => m.direction === 'out');
  if (ultimaNossa?.created_at) {
    const quando = new Date(ultimaNossa.created_at);
    if (!podeFalarDeNovo(quando, e.agora)) {
      return { acao: 'segurar-cadencia', desdeMs: e.agora.getTime() - quando.getTime() };
    }
  }

  return { acao: 'responder', turno: { robo, tentativa: e.tentativas } };
}

// ── Não repetir o que já perguntamos ────────────────────────────────────────

/** Abaixo disso, repetir é humano: "Perfeito!", "Combinado", "Obrigada". */
// Piso de 4 palavras significativas: "faz sentido pra vocês?" (4) tem conteúdo
// suficiente pra ser repetição; "e hoje?" (1) não distingue nada.
const REPETICAO_MIN_PALAVRAS = 4;
/**
 * Limiar de sobreposição entre duas PERGUNTAS. Mais alto que o Jaccard antigo
 * porque a métrica mudou: coeficiente de sobreposição divide pelo conjunto
 * menor, então tolera a pergunta repetida com palavras a mais em vez de ser
 * punido por ela. Medido nos transcripts: repetição real dá 1,0; pergunta
 * diferente que divide vocabulário dá 0,2-0,4.
 */
const REPETICAO_LIMIAR = 0.75;
/**
 * Limiar de mensagem quase idêntica, sobre o texto INTEIRO. Alto e com Jaccard
 * (simétrico) porque duplicata não precisa de tolerância: o caso real do gym era
 * a mesma despedida palavra por palavra.
 *
 * Medido: mensagem idêntica dá 1,0; a mesma despedida com uma palavra trocada dá
 * 0,83; duas mensagens genuinamente diferentes que citam Stefano e piloto dão
 * 0,23. 0,80 fica com folga dos dois lados.
 */
const DUPLICATA_LIMIAR = 0.8;

const palavras = (s: string): Set<string> =>
  new Set(
    norm(s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .split(/\s+/)
      .filter((w) => w.length > 2) // artigos e preposições não distinguem nada
  );

/**
 * Coeficiente de sobreposição: interseção sobre o conjunto MENOR.
 *
 * Era Jaccard (interseção sobre a união), e a união era o problema: repetir a
 * mesma pergunta com três palavras a mais inflava o denominador e derrubava a
 * similaridade justamente no caso que a gente quer pegar.
 */
/** Jaccard: interseção sobre união. Severo, e é o que queremos pra duplicata. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

function sobreposicao(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  // Assimetria grande não é "a mesma pergunta de novo", é uma FÓRMULA curta
  // dentro de uma pergunta maior. Medido: "Faz sentido pra vocês?" (4 palavras)
  // casava 0,75 com "Faz sentido eu marcar uma conversa com o Stefano...?" (17),
  // que é pergunta nova — o único falso positivo dos 125 turnos reais. Repetição
  // de verdade veio quase do mesmo tamanho (13 vs 14, 10 vs 11).
  if (Math.min(a.size, b.size) / Math.max(a.size, b.size) < 0.5) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / Math.min(a.size, b.size);
}

/**
 * As perguntas de uma mensagem, cada uma sem o contexto que a precede.
 *
 * A unidade que o juiz julga é a PERGUNTA, não a mensagem. As mensagens dela têm
 * 150-200 chars — contexto, calor humano, e a pergunta no fim. Comparar mensagem
 * inteira dilui: duas mensagens com a mesma pergunta e contexto diferente nem
 * chegavam perto do limiar, e o gate ficou 0/20 numa rodada em que o juiz
 * apontou repetição.
 */
export function perguntas(texto: string): string[] {
  const achadas: string[] = [];
  for (const trecho of (texto ?? '').match(/[^?]*\?/g) ?? []) {
    // Corta no último fim de frase: "Perfeito, anotado! Vocês atendem onde?"
    // vira só a pergunta. ':' entra porque ela abre pergunta com "pra alinhar:".
    const q = trecho.split(/(?<=[.!?:])\s+|\n+/).pop()?.trim();
    if (q) achadas.push(q);
  }
  return achadas;
}

/**
 * Mais de uma pergunta na mesma mensagem.
 *
 * "NO MÁXIMO uma pergunta por mensagem" já estava no prompt — sem gate. Medido
 * em 30/jul: 9 de 125 mensagens dela (7%) mandavam duas. Sexta vez no mesmo
 * padrão: regra escrita não é mecanismo.
 */
export function perguntasDemais(texto: string): boolean {
  return perguntas(texto).length > 1;
}

/**
 * Se a resposta candidata repete algo que NÓS já mandamos nesta conversa.
 *
 * O juiz pareado pegou isso no cenário da coop: "a segunda repetiu a mesma
 * pergunta após uma resposta clara". O prompt não tinha nenhuma regra de
 * não-repetir — e, pela quinta vez em 29/jul, regra no prompt não é mecanismo.
 *
 * Compara por sobreposição de palavras, não por igualdade: o modelo reformula
 * ("precisam de receituário" → "precisam de um receituário") e a igualdade
 * exata deixaria passar. Só olha as NOSSAS mensagens — o prospect repetir é
 * assunto do porteiro, não deste gate.
 */
export function repeticaoNossa(
  thread: Array<{ direction: string; text: string | null }>,
  candidato: string
): boolean {
  const nossas = thread.filter((m) => m.direction === 'out');

  // Camada 1: mensagem quase idêntica, com pergunta ou sem. Comparar só
  // pergunta foi um estreitamento que custou cobertura: no gym das 14 personas
  // ela mandou a MESMA despedida duas vezes (turnos 5 e 7 de sem-interesse,
  // rodada 24acf8c3), e como despedida não tem "?", nada barrava. Jaccard aqui
  // — simétrico e severo — porque duplicata é o caso fácil e não precisa de
  // tolerância nenhuma.
  const inteiro = palavras(candidato);
  if (inteiro.size >= REPETICAO_MIN_PALAVRAS) {
    for (const m of nossas) {
      if (jaccard(inteiro, palavras(m.text ?? '')) >= DUPLICATA_LIMIAR) return true;
    }
  }

  // Camada 2: a mesma PERGUNTA, ainda que o texto em volta seja outro.
  const novas = perguntas(candidato)
    .map(palavras)
    .filter((p) => p.size >= REPETICAO_MIN_PALAVRAS);
  if (!novas.length) return false;

  const jaFeitas = nossas
    .flatMap((m) => perguntas(m.text ?? ''))
    .map(palavras)
    .filter((p) => p.size >= REPETICAO_MIN_PALAVRAS);

  return novas.some((nova) => jaFeitas.some((antiga) => sobreposicao(nova, antiga) >= REPETICAO_LIMIAR));
}

// Expressão de tempo curto. "já vou pedir" NÃO entra: é ela agindo agora, não
// promessa sobre quando o outro responde.
// Sem \b no fim: "já" termina em acento, e o \b do JS é ASCII — a fronteira não
// fecha depois de "á". Mesma armadilha documentada no PRICE_INTENT do pipeline.
// Foi ela que fez este gate não pegar o caso real na primeira tentativa.
const PRAZO_CURTO_RE =
  /\bj[áa]\s+j[áa](?![\wÀ-ÿ])|\b(em\s+breve|logo\s+mais|ainda\s+hoje|hoje\s+ainda|em\s+instantes|daqui\s+a\s+pouco|nas\s+pr[óo]ximas\s+horas)\b/i;
// Verbo de resposta/contato — o que transforma tempo em PROMESSA de agenda alheia.
const RESPOSTA_RE = /\b(retorn\w*|respond\w*|contat\w*|cham\w*|fal[ae]\w*|liga\w*|entra\s+em\s+contato)\b/i;

/**
 * Se a mensagem promete QUANDO um terceiro responde.
 *
 * Ela não controla a agenda do Stefano. Prometer "já já ele te dá um retorno"
 * deixa o prospect esperando por algo que ela não pode entregar — e se ele não
 * responder, quem mentiu foi a gente. Destino sim, prazo não.
 *
 * A regra já estava no prompt desde e1011d4 e não tinha gate: em 30/jul o
 * "já já ele te dá um retorno por aqui" passou por fora, e o juiz pareado — já
 * com a rubrica corrigida — pegou como erro grave. Sétima vez no dia em que
 * regra escrita não é mecanismo.
 */
export function prometeuPrazo(texto: string): boolean {
  const t = texto ?? '';
  return PRAZO_CURTO_RE.test(t) && RESPOSTA_RE.test(t);
}

// Recusa explícita — o ÚNICO caso que autoriza encerrar. Deliberadamente
// estreito: "tá bom, valeu" é acolhimento e "qualquer coisa me chama" é
// engajamento, e tratar os dois como recusa foi o que fez a Vitória se despedir
// de quem estava dentro.
const RECUSA_RE =
  /\bn[ãa]o\s+(tenho|temos)\s+interesse\b|\bn[ãa]o\s+(quero|queremos|precis\w+|interessa)\b|\bsem\s+interesse\b|\bn[ãa]o\s+d[áa]\s+pra\s+seguir\b/i;

/** Se a mensagem DELE é uma recusa explícita de continuar. */
export function recusou(texto: string | null | undefined): boolean {
  return RECUSA_RE.test(texto ?? '');
}

/** A marca da despedida que resolverSilencio produz. */
const DESPEDIDA_RE = /n[ãa]o vou insistir/i;

/**
 * Se JÁ nos despedimos nesta conversa.
 *
 * resolverSilencio devolve sempre o mesmo texto canned, então cada silêncio
 * deliberado repetia a despedida. Encerrar uma vez é digno; encerrar duas é
 * defeito — o gym pegou palavra por palavra em sem-interesse.
 */
export function jaSeDespediu(thread: Array<{ direction: string; text: string | null }>): boolean {
  return thread.some((m) => m.direction === 'out' && DESPEDIDA_RE.test(m.text ?? ''));
}

/**
 * O bloco que corrige uma pergunta repetida — sem endurecer a voz.
 *
 * 30/jul o juiz pareado promoveu o gate de repetição (B 3×1 A) e cobrou o preço
 * numa lente só: naturalidade caiu em 3 dos 4 cenários, sempre com as mesmas
 * palavras — "script pré-programado", "rigidez de robô corporativo",
 * "reconfirmação desnecessária". A causa era este bloco. Ele é a ÚLTIMA coisa
 * que o modelo lê antes de escrever, falava só de tarefa ("avance", "proponha o
 * próximo passo") e nada de registro; e mandava propor passo novo até para quem
 * tinha acabado de dizer que estava no campo sem tempo — a crítica literal no
 * agronomo-sobrecarregado ("repete perguntas e adiciona steps, sem atender a
 * urgência").
 *
 * Então ele passa a dizer o que NÃO muda. Trocar o assunto é o pedido; a voz é
 * a mesma pessoa falando.
 */
export function blocoCorrecao(textoRepetido: string, motivo: MotivoCorrecao = 'repeticao'): string {
  const diagnostico =
    motivo === 'duas-perguntas'
      ? `tem MAIS DE UMA pergunta. Escolha a que importa agora e guarde a outra pro próximo turno`
      : motivo === 'prazo'
        ? `PROMETE QUANDO o Stefano responde, e você não controla a agenda dele. Diga o destino ` +
          `("vou passar pro Stefano") sem prazo nenhum — nada de "já já", "em breve", "ainda hoje"`
        : `repete uma pergunta que você já fez nesta conversa. Ele já respondeu isso`;
  return (
    `[CORREÇÃO] Isto que você acabou de escrever ${diagnostico}: ` +
    `"${textoRepetido.slice(0, 200)}".\n` +
    `Troque o ASSUNTO, não o tom: a mensagem nova tem que soar como a mesma pessoa falando — ` +
    `mesmo registro de WhatsApp falado, no máximo uma pergunta, e não mais longa que a anterior ` +
    `(mais curta é melhor).\n` +
    `NÃO reconfirme o que ele acabou de dizer, NÃO recomece a apresentação, NÃO repita o pitch. ` +
    `Se ele demonstrou pressa ou pouco tempo, NÃO empilhe um passo novo — encurte.\n` +
    `Se não houver assunto novo que valha a mensagem, responda só ${SILENCE_SENTINEL}.`
  );
}
