/**
 * Handle an inbound WhatsApp message that came from a *prospect* (a business we
 * cold-messaged), not a farmer. The compliance-critical case: an opt-out ("sair"/
 * "parar") must be honoured immediately and permanently. A non-opt-out reply is
 * just annotated as engagement (status → replied) and left to flow through normal
 * handling, so a curious coop rep can still talk to Stevi.
 */

import { normalizePhoneBR, isOptOut, extrairNumerosCitados } from './core';
import {
  findProspectByPhone,
  addOptout,
  deleteProspectByPhone,
  markProspectReplied,
  logProspectMessage,
  getProspectThread,
  mergeProspectQualification,
  setProspectAgentEnabled,
  bumpPorteiroTentativas,
  type ProspectRow,
} from './db';
import {
  AGENT_NAME,
  needsEscalation,
  buildAgentReply,
  extractQualification,
  decidirTurno,
  pareceAutoAtendimento,
  PORTEIRO_MAX,
} from './agent';
import { alertFounders } from '../alert';
import { sendProspectReplyNotification, sendLeadContactNotification } from '../notify';
import { createLogger } from '../logger';

const log = createLogger('prospect-inbound');

export interface ProspectInboundResult {
  /** True when this message was fully handled here (opt-out) — stop the pipeline. */
  handled: boolean;
  /** A reply to send when handled (opt-out confirmation), else null. */
  reply: string | null;
  /** The matched prospect (null when the sender isn't one) — lets the pipeline
   * route non-opt-out replies to the conversation agent after media handling. */
  prospect: ProspectRow | null;
}

const NOT_A_PROSPECT: ProspectInboundResult = { handled: false, reply: null, prospect: null };

/**
 * Inspect an inbound from `waFrom` (raw WhatsApp id). If it's from a known
 * prospect and is an opt-out, blocklist the number and return a confirmation to
 * send (handled=true). If it's a prospect replying anything else, mark it
 * `replied` and return handled=false so normal handling continues.
 */
/**
 * Exclusão LGPD pedida por um PROSPECT (Art. 18, direito de eliminação).
 *
 * Antes de 04/ago o pipeline respondia *"Pronto, apaguei seus dados"* e não
 * apagava nada: `deleteUserData` procura em `users`, devolve true quando não
 * acha, e não existia nenhum delete em `prospects` no código. Dado de terceiro
 * coletado sem consentimento, mais uma declaração falsa ao titular.
 *
 * A ordem aqui não é estética. A SUPRESSÃO VEM PRIMEIRO: `prospect_optouts` é
 * keyed por telefone, sem FK para `prospects`, e nunca é podada. Se apagássemos
 * a linha sem registrar o opt-out, o sourcing redescobriria a mesma empresa no
 * Places amanhã e mandaria de novo — o oposto exato do que a pessoa pediu.
 * Suprimido-e-não-apagado é recuperável; apagado-e-recontatado não é.
 *
 * Devolve se algo foi de fato apagado, para o chamador só afirmar o que fez.
 */
export async function deleteProspectData(waFrom: string): Promise<boolean> {
  const phone = normalizePhoneBR(waFrom);
  if (!phone) return false;

  const prospect = await findProspectByPhone(phone);
  if (!prospect) return false;

  await addOptout(phone, 'exclusão LGPD solicitada pelo titular');
  const apagado = await deleteProspectByPhone(phone);
  log.info(`prospect LGPD delete: ${prospect.id} (apagado=${apagado})`);
  return apagado;
}

export async function handleProspectInbound(
  waFrom: string,
  text: string | null
): Promise<ProspectInboundResult> {
  const phone = normalizePhoneBR(waFrom);
  if (!phone) return NOT_A_PROSPECT;

  const prospect = await findProspectByPhone(phone);
  if (!prospect) return NOT_A_PROSPECT;

  if (isOptOut(text)) {
    // O texto do pedido vai junto: é ele que sustenta o registro para LGPD, e
    // este ramo retorna antes de a thread ser gravada — sem isto a mensagem não
    // existiria em lugar nenhum.
    await addOptout(phone, 'inbound opt-out', text);
    await markProspectReplied(prospect.id); // record the interaction, then never contact again
    log.info(`prospect opt-out honoured: ${prospect.id}`);
    return {
      handled: true,
      reply: 'Perfeito, não mando mais mensagens. 👍 Se um dia quiser conhecer a Stevi, é só chamar. Bom trabalho!',
      prospect,
    };
  }

  // A prospect engaged — valuable signal. The pipeline routes it to the
  // conversation agent (or, with agent_enabled=false, leaves it to the founder).
  const firstReply = prospect.status !== 'replied';
  await markProspectReplied(prospect.id);

  // First reply = the hottest lead the funnel produces. Email both founders +
  // WhatsApp ping so a human can take over fast (painel → Assumir). Fail-soft:
  // notification trouble must never break the reply flow.
  if (firstReply) {
    const masked = `+•• ••••${(prospect.phone ?? '').slice(-4)}`;
    try {
      await sendProspectReplyNotification({
        name: prospect.name ?? null,
        kind: prospect.kind,
        city: prospect.city ?? null,
        uf: prospect.uf ?? null,
        maskedPhone: masked,
        replyText: text ?? '(mensagem sem texto)',
      });
      await alertFounders(
        `🔥 Prospect respondeu: ${prospect.name ?? 'sem nome'} (${prospect.kind}) — assumir no painel`
      );
    } catch (e) {
      log.error('prospect-reply notification failed:', (e as Error).message);
    }
  }

  return { handled: false, reply: null, prospect };
}

/**
 * The conversation-agent turn for a prospect reply. `inboundText` must already
 * be normalized (voice transcribed, image described, vCard summarized). Logs
 * both directions to the thread, escalates to the founders when the trigger
 * fires (pricing/contract/human ask), and merges extracted qualification.
 * Returns the reply to send, or null when the agent is off (human takeover).
 */
export async function respondAsProspectAgent(
  prospect: ProspectRow,
  inboundText: string,
  inboundKind: string
): Promise<string | null> {
  // A THREAD É LIDA ANTES DE GRAVAR ESTA MENSAGEM, e a ordem é a correção de um
  // bug que custou o melhor lead da campanha (05/ago).
  //
  // Gravando primeiro, `getProspectThread` devolvia uma lista que já continha a
  // mensagem atual — e `ecoDeMaquina`, que procura o texto entre os turnos `in`
  // anteriores, achava ELA MESMA. Resultado: toda primeira resposta com 40+
  // chars ou 5+ palavras era classificada como "a contraparte repetiu o que já
  // tinha dito", gastava a tentativa única do porteiro e parqueava o lead.
  //
  // O sinal saía invertido: quanto MAIS a pessoa escrevia, mais certo era ser
  // tratada como robô. A RT da Pró Solo se apresentou por extenso e foi
  // parqueada por isso; só respostas curtas escapavam, por ficarem sob o piso.
  //
  // Que a thread não deve conter a mensagem atual já estava dito aqui embaixo,
  // onde `extractQualification` anexa o inbound à mão — se a thread já o
  // trouxesse, ele entraria duas vezes.
  const thread = await getProspectThread(prospect.id);

  await logProspectMessage(prospect.id, 'in', inboundKind, inboundText);

  // Contato citado ("fala com o Roberto no 35 9...") → email com botão wa.me
  // pros fundadores (pedido 06/ago). Robô institucional cita 0800/ramal o tempo
  // todo, então só mensagem de GENTE conta; número do próprio prospect e número
  // já citado antes na thread não re-disparam.
  if (!pareceAutoAtendimento(inboundText)) {
    const conhecidos = new Set<string>(
      [prospect.phone, (prospect as ProspectRow & { wa_phone?: string | null }).wa_phone]
        .filter((n): n is string => !!n)
    );
    for (const t of thread) for (const n of extrairNumerosCitados(t.text)) conhecidos.add(n);
    const novos = extrairNumerosCitados(inboundText).filter((n) => !conhecidos.has(n));
    if (novos.length) {
      try {
        await sendLeadContactNotification({
          prospectName: prospect.name ?? null,
          kind: prospect.kind,
          city: prospect.city ?? null,
          uf: prospect.uf ?? null,
          citedPhones: novos,
          replyText: inboundText,
        });
        await alertFounders(
          `📲 ${prospect.name ?? 'Prospect'} passou um contato pra falar direto — email com o botão de WhatsApp na caixa de vocês.`
        );
      } catch (e) {
        log.error('lead-contact notification failed:', (e as Error).message);
      }
    }
  }

  if (needsEscalation(inboundText)) {
    await alertFounders(
      `📞 Prospect ${prospect.name} pediu preço/contrato/humano — assuma a conversa: "${inboundText.slice(0, 150)}"`
    );
  }

  // A decisão é pura e vive em agent.decidirTurno — o gym usa a MESMA, sem os
  // efeitos abaixo. Antes ela estava embutida aqui, e por isso o gym (que chama
  // buildAgentReply direto) não passava por nenhum freio.
  const decisao = decidirTurno({
    thread,
    inboundText,
    tentativas: prospect.porteiro_tentativas ?? 0,
    agenteLigado:
      (prospect as ProspectRow & { agent_enabled?: boolean }).agent_enabled !== false,
    agora: new Date(),
  });

  if (decisao.acao === 'humano-assumiu') {
    await alertFounders(
      `💬 Prospect ${prospect.name} respondeu (agente desligado — responda você): "${inboundText.slice(0, 150)}"`
    );
    return null;
  }

  if (decisao.acao === 'porteiro-esgotado') {
    await setProspectAgentEnabled(prospect.id, false).catch(() => {});
    await alertFounders(
      `🚪 ${prospect.name}: ${PORTEIRO_MAX} tentativa(s) de furar o atendimento automático e só veio robô. ` +
        `Desliguei a Vitória e parquei o lead — assuma no painel se quiser insistir.`
    );
    log.info(`agent parked on ${prospect.id} — porteiro esgotado`);
    return null;
  }

  if (decisao.acao === 'segurar-cadencia') {
    log.info(`agent held back on ${prospect.id} — falou há ${Math.round(decisao.desdeMs / 1000)}s`);
    return null;
  }

  if (decisao.turno.robo) {
    await bumpPorteiroTentativas(prospect.id).catch(() => {});
    log.info(`porteiro attempt ${decisao.turno.tentativa + 1}/${PORTEIRO_MAX} on ${prospect.id}`);
  }

  const action = await buildAgentReply(prospect.name, thread, inboundText, decisao.turno);

  if (action.tipo === 'silencio') {
    log.info(`agent stayed quiet on ${prospect.id}: ${action.motivo}`);
    return null;
  }

  // Extracted from the whole thread; a failure only costs freshness.
  const q = await extractQualification([...thread, { direction: 'in', text: inboundText }]);
  if (q) await mergeProspectQualification(prospect.id, q as Record<string, unknown>);

  log.info(`agent (${AGENT_NAME}) replied to prospect ${prospect.id}`);
  // NOT logged here: the thread must record what the prospect RECEIVED. The
  // caller writes it after a confirmed send (recordProspectOutbound) — a ghost
  // turn poisons the next prompt (the model believes it already said this) and
  // trips the loop guard forever.
  return action.texto;
}

/**
 * Append an outbound turn to a prospect thread. Call ONLY after the send came
 * back successful.
 */
export async function recordProspectOutbound(prospectId: string, text: string): Promise<void> {
  await logProspectMessage(prospectId, 'out', 'text', text);
}
