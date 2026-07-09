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

import { chat } from '../llm';
import { MODELS } from '../env';
import { withRetry } from '../retry';
import { createLogger } from '../logger';

const log = createLogger('prospect-agent');

export const AGENT_NAME = process.env.PROSPECT_AGENT_NAME || 'Olívia';

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
    `SUA MISSÃO nesta conversa, nesta ordem e no ritmo do prospect:\n` +
    `1. Entender como chega cliente novo pra ele hoje (indicação? redes?).\n` +
    `2. Validar: se recebesse um produtor da região dele, já triado, precisando de receituário — atenderia? Em quanto tempo?\n` +
    `3. Entender que formato prefere (por lead, mensalidade, outro) — SEM negociar valores.\n` +
    `4. Capturar quais municípios/regiões e culturas ele atende.\n\n` +
    `REGRAS DURAS:\n` +
    `- Faça no máximo UMA pergunta por mensagem. Curto, tom profissional-caloroso, pt-BR.\n` +
    `- NUNCA cite preço ou valor (nem exemplos). Perguntas de preço/contrato/ligação: diga que o Stefano ` +
    `responde direto, hoje ainda.\n` +
    `- Se não souber, diga que confirma com os fundadores. Nunca invente.\n` +
    `- Se ele indicar outra pessoa (contato compartilhado), agradeça e confirme que os fundadores vão falar com ela.`
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
): Promise<string> {
  const history = formatThreadBlock(thread, AGENT_NAME);
  const user =
    (history ? history + '\n\n' : '') +
    `[Prospect: ${prospectName}]\n` +
    `Nova mensagem do prospect: ${inboundText}\n\n` +
    `Responda como ${AGENT_NAME} (só o texto da mensagem, tamanho WhatsApp).`;

  const raw = await withRetry(
    () =>
      chat({
        model: MODELS.reasoning(),
        system: agentSystemPrompt(AGENT_NAME),
        maxTokens: 400,
        user,
      }),
    { attempts: 2 }
  );
  const gated = gateAgentReply(raw.trim());
  if (!gated.safe) log.error('agent reply gated (price/terms):', raw.slice(0, 120));
  return gated.text;
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
