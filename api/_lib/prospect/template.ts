/**
 * WhatsApp template management for prospecting — submit and track the
 * personalized v2 first-touch template via the Graph API, using the same
 * WHATSAPP_CLOUD_TOKEN the transport already has. Meta requires
 * business-initiated messages to be pre-approved templates; this keeps the
 * submit/approve loop inside the ops console instead of the WhatsApp Manager
 * UI. The WABA id is resolved from the token itself (debug_token), with
 * WHATSAPP_WABA_ID as an env override.
 */

import { createLogger } from '../logger';

const log = createLogger('prospect-template');
const GRAPH = 'https://graph.facebook.com/v21.0';
// Every Graph call gets a hard deadline: the status check runs inside the
// dispatch cron's budget and a hung fetch is billable idle CPU.
const TIMEOUT_MS = 8000;

export const V2_NAME = 'stevi_parceria_v2';
export const BUMP_NAME = 'stevi_parceria_bump';
export const LEAD_NAME = 'stevi_lead_v1';
export const COOP_NAME = 'stevi_parceria_coop_v1';
/** Reply-first rewrites approved 27/jul: declare the AI in the first touch and
 * ask ONE question instead of pitching (pitch-first measured <5% reply). */
export const V3_NAME = 'stevi_parceria_v3';
/**
 * SÓ A PERGUNTA (aprovado pelo Stefano em 05/ago).
 *
 * O v3 já era reply-first, mas ainda carregava apresentação e contexto no mesmo
 * balão. A medição de 05/ago mostrou por que isso desperdiça: de 13 respostas em
 * 69 envios, ONZE vieram de atendimento automático ("agradece seu contato", menu
 * numerado, "aguarde um técnico"). Quem atende a porta da empresa é um robô.
 *
 * Bloco de texto gasto no porteiro é bloco perdido. Uma pergunta de cinco
 * palavras é barata de queimar com ele, e é o que faz uma PESSOA aparecer
 * ("sim, é a X, quem fala?"). A conversa começa aí, com a janela de 24h já
 * aberta pela resposta dela — e o resto vem uma coisa por mensagem.
 */
export const V4_NAME = 'stevi_parceria_v4';
export const COOP_V2_NAME = 'stevi_parceria_coop_v2';
/** Proactive farmer alerts (geada/fogo/vazio) outside Meta's 24h window. Lives
 * in this registry — even though alerts.ts sends it, not the dispatcher — so the
 * canary's shape check covers it. Without that, a paused alert template would
 * only surface on the next frost, when the alert silently fails to go out. */
export const ALERT_NAME = 'stevi_alerta_v1';

/**
 * Alerta OPERACIONAL pros founders (nao pro produtor) — resumo do lote, breaker
 * cortado, incidente. Existe porque em 03/ago o canal de alerta se revelou
 * morto: Twilio sandbox devolvia 63015 em tudo, e texto livre pelo Cloud API
 * morre fora da janela de 24h (131047). Template UTILITY atravessa a janela e
 * chega no celular a qualquer hora — que e o que "me avisa quando sair"
 * realmente exige.
 */
export const OPS_ALERT_NAME = 'stevi_ops_v1';

/**
 * CONTINUAÇÃO — a lacuna que 28/jul expôs. Todo template aprovado era de
 * ABERTURA: quando a conversa com o Felipe (Agro.com) esfriar e a janela de 24h
 * fechar, não existe nada para retomar de onde parou. Mandar um template de
 * primeiro contato para quem já conversa com a gente lê como robô que esqueceu
 * a conversa — e é o tipo de coisa que faz o interlocutor bloquear.
 *
 * Categoria UTILITY nos dois primeiros por serem cumprimento de algo combinado
 * na própria conversa, não oferta nova: ~9x mais barato e imune ao teto de
 * marketing por usuário (#131049). Sem rodapé SAIR — utility não é cold.
 */
/** Retoma uma conversa esfriada, citando o que ficou pendente. */
export const RETOMADA_NAME = 'stevi_retomada_v1';
/** Entrega o material que a gente ficou de mandar. */
export const ENTREGA_NAME = 'stevi_entrega_v1';
/** Última tentativa antes de parquear o lead — porta aberta, sem insistência. */
export const DESPEDIDA_NAME = 'stevi_despedida_v1';

const FOOTER = 'Pra não receber mais mensagens, responda SAIR.';

/**
 * O rótulo corporativo que a Vitória não usa (decisão do fundador, 05/ago).
 *
 * "Assistente digital/virtual" lê como script de call center e mata a conversa
 * antes de começar. A honestidade continua obrigatória e inegociável — ela
 * NUNCA se passa por pessoa e confirma na hora se perguntarem (ver a REGRA ZERO
 * em agent.ts) — mas declarar é resposta, não crachá de abertura.
 *
 * Isto não é cosmético: é o filtro que `templateForKind` usa para nunca colocar
 * a frase na linha, mesmo que uma env aponte para um template que a carregue.
 */
const ROTULO_CORPORATIVO = /assistente\s+(digital|virtual)/i;

/** Se o corpo APROVADO deste template carrega o rótulo proibido. Nome
 * desconhecido devolve false: quem não está no registro é barrado pelo shape
 * guard, não aqui. */
export function temRotuloCorporativo(name: string): boolean {
  const def = TEMPLATE_DEFS[name];
  return !!def && ROTULO_CORPORATIVO.test(def.body);
}

interface TemplateDef {
  body: string;
  example: string[];
  /** Meta category. Cold marketing gets the SAIR footer; utility doesn't. */
  category?: 'MARKETING' | 'UTILITY';
}

// Registry of every template this codebase can submit/send. Bodies must stay
// in sync with personalize.ts renderers (the painel thread view).
const TEMPLATE_DEFS: Record<string, TemplateDef> = {
  // Intro — {{1}}=name, {{2}}=kind hook, {{3}}=city (personalize.buildTemplateParams).
  [V2_NAME]: {
    body:
      'Oi! Aqui é a Vitória, da Stevi 🌱 Falo com a {{1}}? Vi que vocês {{2}} na região de {{3}}. ' +
      'A Stevi é uma assistente gratuita de WhatsApp que faz triagem agronômica pra produtores de café — ' +
      'e quando o produtor precisa de receituário, a gente indica um agrônomo parceiro da região. ' +
      'Faz sentido trocar uma ideia rápida sobre parceria?',
    example: ['Agro Forte', 'atendem produtores no dia a dia', 'Varginha'],
  },
  // Intro reply-first (aprovado 27/jul) — {{1}}=name, {{2}}=city. Declares the
  // AI up front (the gym found the old intro reading as a person) and asks one
  // question; the answer opens the free 24h window, outside the per-user
  // marketing cap. Bodies here must match the APPROVED text exactly — the shape
  // guard compares against what Meta has.
  [V3_NAME]: {
    body:
      'Oi, {{1}}! Sou a Vitória, assistente digital da equipe da Stevi 🌱 Pergunta rápida: quando um ' +
      'cafeicultor da região de {{2}} precisa de receituário e não tem agrônomo por perto, ele chega até ' +
      'vocês como? Pergunto porque a gente recebe esses pedidos no WhatsApp e queria saber se faz sentido ' +
      'indicar vocês.',
    example: ['Rural Center', 'Machado'],
  },
  // Só a pergunta (05/ago) — {{1}}=nome da empresa. O rodapé SAIR é anexado
  // automaticamente por ser MARKETING; a pessoa vê a pergunta e, embaixo, a
  // saída. É o corpo mais curto do registro, de propósito.
  [V4_NAME]: {
    // A Meta RECUSA variável no fim do modelo ("As variáveis não podem estar no
    // início ou no fim"), e `{{1}}?` conta como fim — a pontuação não vale como
    // conteúdo. Daí a identificação vir DEPOIS da pergunta: satisfaz a regra e
    // mantém o que foi pedido, que é a pergunta abrir a mensagem. De quebra
    // resolve o risco de uma pergunta sem remetente, com rodapé de descadastro,
    // ler como golpe.
    body: 'Oi! Falo com a {{1}}? Aqui é a Vitória, da Stevi.',
    example: ['Rural Consultoria'],
  },
  // Distribution pitch reply-first (aprovado 27/jul) — {{1}}=name, {{2}}=name
  // again ("pro time da {{2}}"): the slot takes the ORGANIZATION's name, not
  // kindPhrase — "pro time da a cooperativa" would be broken Portuguese.
  [COOP_V2_NAME]: {
    body:
      'Oi, {{1}}! Sou a Vitória, assistente digital da Stevi 🌱 A gente atende cafeicultores no WhatsApp e ' +
      'devolve o caso técnico organizado pro time da {{2}} — não substitui ninguém. Posso te mandar um ' +
      'exemplo real de caso pra você avaliar?',
    example: ['Coopercafé', 'Coopercafé'],
  },
  // Retomada — {{1}}=nome de quem fala, {{2}}=o que ficou pendente. Cita a
  // conversa anterior para não soar como primeiro contato repetido.
  [RETOMADA_NAME]: {
    category: 'UTILITY',
    body:
      'Oi, {{1}}! Aqui é a Vitória, da Stevi 🌱 A gente conversou por aqui e ficou de {{2}}. ' +
      'Posso seguir de onde a gente parou?',
    example: ['Felipe', 'eu te mandar um exemplo de caso'],
  },
  // Entrega — {{1}}=nome, {{2}}=o que está sendo entregue. O turno que cumpre
  // a promessa; sem pitch, porque o pitch já foi feito na conversa.
  [ENTREGA_NAME]: {
    category: 'UTILITY',
    body:
      'Oi, {{1}}! Como combinado, te trago {{2}}. ' +
      'Se fizer sentido pra loja, me diz que a gente segue daqui.',
    example: ['Felipe', 'o exemplo de caso de um cafeicultor da região'],
  },
  // Despedida — {{1}}=nome. Encerra sem cobrar resposta. MARKETING (é
  // reengajamento, não cumprimento de combinado) e por isso leva o rodapé.
  [DESPEDIDA_NAME]: {
    body:
      'Oi, {{1}}! Não quero tomar seu tempo — vou parar por aqui. ' +
      'Se um dia fizer sentido receber produtores da região com o caso técnico já organizado, ' +
      'é só me chamar nesse mesmo número. Bom trabalho! 🌱',
    // Sem FOOTER no corpo: submitTemplate anexa o rodapé como componente FOOTER
    // em todo MARKETING. Escrever aqui também mandaria "responda SAIR" duas
    // vezes na mesma mensagem.
    example: ['Felipe'],
  },
  // Proactive alert to a farmer outside the 24h window — {{1}}=alert text
  // (flattened by cloud.sendTemplate; Meta rejects newlines in params). UTILITY:
  // ~9x cheaper than marketing and immune to the per-user marketing cap.
  [ALERT_NAME]: {
    category: 'UTILITY',
    body: 'Stevi 🌱 aviso da sua lavoura: {{1}}. Me chama aqui se quiser entender o que dá pra fazer.',
    example: ['Alerta de geada: mínima de -1°C prevista pro dia 26/07 na sua região'],
  },
  // Alerta interno: destinatario e founder, nao produtor. Sem emoji de lavoura
  // e sem convite pra responder — isto e painel de controle, nao conversa.
  [OPS_ALERT_NAME]: {
    category: 'UTILITY',
    body: 'Stevi · aviso interno: {{1}}. Detalhes no painel.',
    example: ['Lote da Vitoria: 8 convites enviados, 3 sem WhatsApp. Ainda 131 na fila.'],
  },
  // D+3 bump for never-repliers — {{1}}=name, {{2}}=city.
  [BUMP_NAME]: {
    body:
      'Oi, {{1}}! Vitória da Stevi aqui de novo 🌱 Sei que a rotina é corrida, então só um lembrete rápido: ' +
      'a gente indica produtores da região de {{2}} que precisam de receituário agronômico — de graça nessa ' +
      'fase de validação. Se fizer sentido, me dá um alô por aqui. Se não for o momento, tudo bem também!',
    example: ['Agro Forte', 'Varginha'],
  },
  // Distribution pitch for coops/revendas — {{1}}=name, {{2}}=kind phrase
  // ("a cooperativa"/"a revenda"). The lead-gen pitch reads as a competitive
  // threat to the two kinds whose business IS the receituário moment
  // (red-team F3): this one routes farmers back to THEIR técnicos instead.
  [COOP_NAME]: {
    body:
      'Oi! Aqui é a Vitória, da Stevi 🌱 Falo com a {{1}}? A Stevi é uma assistente gratuita de WhatsApp ' +
      'que faz triagem agronômica pra cafeicultores — foto de praga, janela de pulverização, alerta de geada. ' +
      'Pra {{2}}, ela funciona como um filtro: atende o produtor na hora e encaminha os casos técnicos ' +
      'pros SEUS agrônomos e técnicos — não substitui ninguém, devolve o produtor pra vocês com o caso já ' +
      'organizado. Faz sentido uma conversa rápida?',
    example: ['Cooxupé - Núcleo Machado', 'a cooperativa'],
  },
  // Lead delivery to an ACTIVE partner (agreed relationship ⇒ UTILITY, no SAIR
  // footer) — {{1}}=partner first name, {{2}}=crop, {{3}}=farmer's topic.
  // The farmer's contact goes only in the follow-up, after the partner replies.
  [LEAD_NAME]: {
    category: 'UTILITY',
    body:
      'Oi, {{1}}! 🌱 Lead novo da Stevi pra você: produtor com lavoura de {{2}} pediu um agrônomo — ' +
      'assunto: "{{3}}". Ele autorizou passar o contato e está esperando. ' +
      'Responde qualquer coisa aqui que eu já te mando o número e o resumo completo da conversa.',
    example: ['Michel', 'café', 'ferrugem nas folhas'],
  },
};

function token(): string {
  const t = process.env.WHATSAPP_CLOUD_TOKEN;
  if (!t) throw new Error('WHATSAPP_CLOUD_TOKEN not configured');
  return t;
}

/** WABA id: env override, else derived from the token's granted scopes. */
export async function resolveWabaId(): Promise<string> {
  const override = process.env.WHATSAPP_WABA_ID;
  if (override) return override;
  const t = token();
  const res = await fetch(
    `${GRAPH}/debug_token?input_token=${encodeURIComponent(t)}&access_token=${encodeURIComponent(t)}`,
    { signal: AbortSignal.timeout(TIMEOUT_MS) }
  );
  const json = (await res.json()) as {
    data?: { granular_scopes?: Array<{ scope: string; target_ids?: string[] }> };
  };
  const scopes = json.data?.granular_scopes ?? [];
  const mgmt = scopes.find((s) => s.scope === 'whatsapp_business_management');
  const id = mgmt?.target_ids?.[0];
  if (!id) throw new Error('could not resolve WABA id from token (set WHATSAPP_WABA_ID)');
  return id;
}

/** {{n}} placeholders in a body text. Pure; exported for tests. */
export function countBodyParams(body: string): number {
  return (body.match(/\{\{\d+\}\}/g) ?? []).length;
}

/**
 * Body param count our REGISTRY expects for a template (null = template we
 * don't know). The payload builder derives from this — never from an env var:
 * the Jul/13 outage was PROSPECT_TEMPLATE_PARAMS drifting from the approved
 * template (#132000 on every send, 0% delivery, health latch).
 */
export function registryParamCount(name: string): number | null {
  const def = TEMPLATE_DEFS[name];
  return def ? countBodyParams(def.body) : null;
}

export interface TemplateStatus {
  name: string;
  status: string; // APPROVED | PENDING | REJECTED | ...
  id?: string;
  rejectedReason?: string | null;
  /** Param count of the LIVE approved body — the shape guard compares this
   * against registryParamCount before any send. */
  liveParamCount?: number | null;
}

/** Current status of a template by name (null if it doesn't exist yet). */
export async function getTemplateStatus(name: string): Promise<TemplateStatus | null> {
  const waba = await resolveWabaId();
  const res = await fetch(
    `${GRAPH}/${waba}/message_templates?name=${encodeURIComponent(name)}&fields=name,status,id,rejected_reason,components`,
    { headers: { Authorization: `Bearer ${token()}` }, signal: AbortSignal.timeout(TIMEOUT_MS) }
  );
  const json = (await res.json()) as {
    data?: Array<{
      name: string;
      status: string;
      id: string;
      rejected_reason?: string;
      components?: Array<{ type?: string; text?: string }>;
    }>;
    error?: { message: string };
  };
  if (json.error) throw new Error(`template status failed: ${json.error.message}`);
  const hit = (json.data ?? []).find((t) => t.name === name);
  if (!hit) return null;
  const body = (hit.components ?? []).find((c) => (c.type ?? '').toUpperCase() === 'BODY');
  return {
    name: hit.name,
    status: hit.status,
    id: hit.id,
    rejectedReason: hit.rejected_reason ?? null,
    liveParamCount: body?.text != null ? countBodyParams(body.text) : null,
  };
}

/**
 * The pre-send shape guard: template must be APPROVED and its live body must
 * take exactly the params our registry builds. Returns null when safe, else a
 * human-readable reason. FAILS CLOSED on unknown templates.
 */
export async function templateShapeError(name: string): Promise<string | null> {
  const expected = registryParamCount(name);
  if (expected == null) return `template desconhecido no registry: ${name}`;
  const st = await getTemplateStatus(name);
  if (st?.status !== 'APPROVED') return `template_not_approved (${st?.status ?? 'missing'})`;
  if (st.liveParamCount != null && st.liveParamCount !== expected) {
    return `template_shape_mismatch (${name}: aprovado espera ${st.liveParamCount} params, registry monta ${expected})`;
  }
  return null;
}

/**
 * Submit a registry template by name. Idempotent from the caller's view: if it
 * already exists (any status), returns its current status instead of resubmitting.
 */
export async function submitTemplate(
  name: string
): Promise<{ submitted: boolean; status: TemplateStatus }> {
  const def = TEMPLATE_DEFS[name];
  if (!def) throw new Error(`unknown template: ${name}`);
  const existing = await getTemplateStatus(name);
  if (existing) return { submitted: false, status: existing };

  const waba = await resolveWabaId();
  const category = def.category ?? 'MARKETING';
  const components: unknown[] = [
    { type: 'BODY', text: def.body, example: { body_text: [def.example] } },
  ];
  if (category === 'MARKETING') components.push({ type: 'FOOTER', text: FOOTER });
  const res = await fetch(`${GRAPH}/${waba}/message_templates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, language: 'pt_BR', category, components }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = (await res.json()) as {
    id?: string;
    status?: string;
    error?: { message: string; error_user_msg?: string };
  };
  if (json.error) {
    const msg = json.error.error_user_msg || json.error.message;
    log.error('template submit failed:', msg);
    throw new Error(`template submit failed: ${msg}`);
  }
  return {
    submitted: true,
    status: { name, status: json.status ?? 'PENDING', id: json.id },
  };
}

/** Back-compat wrapper for the ops action. */
export async function submitV2Template(): Promise<{ submitted: boolean; status: TemplateStatus }> {
  return submitTemplate(V2_NAME);
}

/** The registry body for a template, or null when unknown. */
export function templateBody(name: string): string | null {
  return TEMPLATE_DEFS[name]?.body ?? null;
}

/**
 * The Meta category we submit under. Defaults to MARKETING: assuming UTILITY
 * for an unmarked template would understate cost AND dodge the per-user
 * marketing cap by accident — the conservative default is the expensive one.
 */
export function templateCategory(name: string): 'MARKETING' | 'UTILITY' | null {
  const def = TEMPLATE_DEFS[name];
  if (!def) return null;
  return def.category ?? 'MARKETING';
}
