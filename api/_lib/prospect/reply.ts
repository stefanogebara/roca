/**
 * Resposta LIVRE a um prospect — o caminho que faltava.
 *
 * `send.ts` só sabia mandar TEMPLATE, porque todo envio nosso nascia
 * business-initiated. Mas quando o prospect responde, a janela de 24h da Meta
 * abre e a conversa passa a ser livre — e template dentro de conversa aberta lê
 * como robô que esqueceu o papo.
 *
 * O caso que criou a necessidade, 05/ago: a Nathállia, RT da Pró Solo, se
 * identificou e perguntou "como posso te ajudar?". O porteiro tinha classificado
 * a saudação anterior da empresa como atendimento automático, gastado sua única
 * tentativa e desligado a agente. Quando a humana apareceu, não havia ninguém
 * escutando — e nenhum caminho no sistema para responder à mão.
 *
 * Este módulo é esse caminho, e ele reusa as MESMAS réguas do disparo em vez de
 * inventar as suas: só número com fonte citada, e o que sai fica na thread.
 */

import { CloudApiAdapter } from '../transport/cloud';
import { getProspectById, logProspectMessage } from './db';
import { sendablePhone } from './core';
import { createLogger } from '../logger';

const log = createLogger('prospect-reply');

export interface RespostaResultado {
  ok: boolean;
  erro?: string;
}

/**
 * Manda um texto livre para um prospect e registra na thread.
 *
 * Só funciona dentro da janela de 24h aberta por uma mensagem dele; fora dela a
 * Meta devolve 131047 e o envio falha — o que é o comportamento certo, porque
 * fora da janela o correto é template, não texto.
 */
export async function responderProspect(id: string, texto: string): Promise<RespostaResultado> {
  const corpo = texto.trim();
  // Um POST malformado não pode virar mensagem em branco no WhatsApp de um lead.
  if (!corpo) return { ok: false, erro: 'texto vazio' };

  const prospect = await getProspectById(id);
  if (!prospect) return { ok: false, erro: 'prospect não encontrado' };

  // Mesma régua do disparo (sendablePhone): número sem fonte CITADA é palpite, e
  // palpite é o que queima a reputação do número. Responder não é desculpa para
  // furar isso — a Meta não distingue "resposta" de "cold" na conta de qualidade.
  const phone = sendablePhone(prospect);
  if (!phone) return { ok: false, erro: 'prospect sem número com fonte citada' };

  try {
    await new CloudApiAdapter().send({ to: phone, text: corpo });
  } catch (e) {
    log.error(`resposta a ${prospect.name} falhou:`, (e as Error).message);
    return { ok: false, erro: (e as Error).message.slice(0, 160) };
  }

  // Registra DEPOIS do envio, nunca antes: gravar o que não saiu faz a thread
  // mostrar uma mensagem que o lead nunca recebeu, e a próxima decisão sai
  // errada por causa do nosso próprio livro-caixa.
  await logProspectMessage(prospect.id, 'out', 'text', corpo);
  log.info(`resposta manual enviada para ${prospect.name}`);
  return { ok: true };
}
