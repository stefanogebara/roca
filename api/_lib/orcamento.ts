/**
 * Orçamento de tempo da requisição.
 *
 * O webhook tem `maxDuration` de 60s. Estourar não é um erro que alguém pega:
 * a função MORRE, não há throw para o catch de topo do `handleInbound`
 * converter em FALLBACK_REPLY, e o produtor que mandou foto de ferrugem recebe
 * silêncio. É o pior desfecho do produto — pior que uma resposta ruim.
 *
 * O caminho da foto somava 120s no pior caso (20s de mídia + duas chamadas de
 * LLM com duas tentativas de 25s cada). Apertar timeout por chamada não fecha
 * isso: são as tentativas que multiplicam. O que fecha é um prazo COMPARTILHADO
 * — cada chamada gasta só o que sobrou, e a tentativa extra só existe se couber.
 *
 * Módulo folha, aritmética pura, relógio recebido por parâmetro: dá pra testar
 * o pior caso sem esperar 60s.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Reserva depois da última chamada de LLM: ainda falta passar pelo compliance
 * gate, montar o card, ENVIAR e persistir. Gastar o orçamento inteiro no modelo
 * e morrer no envio é ter feito todo o trabalho e jogado fora.
 */
export const MARGEM_MS = 3_000;

/**
 * Piso para valer a pena tentar de novo. Repetir com 1s sobrando é queimar o
 * resto para falhar igual — e aí não sobra nem para o fallback.
 */
const MIN_TENTATIVA_MS = 5_000;

/**
 * Milissegundos utilizáveis até o prazo, já descontada a margem.
 *
 * `null` quando não há prazo, e isso é deliberado: gym, canary, crons e scripts
 * chamam o mesmo `chat()` sem orçamento de webhook nenhum. Para eles nada muda.
 */
export function restanteMs(deadlineAt: number | undefined, agora: number): number | null {
  if (deadlineAt === undefined) return null;
  return Math.max(0, deadlineAt - agora - MARGEM_MS);
}

/**
 * Timeout de UMA tentativa: o que a chamada pediu, ou o que sobrou, o que for
 * menor. O prazo é teto, não meta — uma chamada barata que pediu 10s continua
 * com 10s mesmo sobrando 40s.
 */
export function prazoDaTentativa(pedido: number, restante: number | null): number {
  return restante === null ? pedido : Math.min(pedido, restante);
}

/** Se ainda há tempo para uma tentativa que valha o nome. */
export function cabeOutraTentativa(restante: number | null): boolean {
  return restante === null || restante >= MIN_TENTATIVA_MS;
}

/**
 * O prazo da requisição em curso.
 *
 * `AsyncLocalStorage` e não uma variável de módulo, e a diferença é de
 * corretude, não de estilo: no Fluid Compute a MESMA instância atende
 * requisições concorrentes, então estado de módulo vazaria o prazo de um
 * produtor para outro — o de quem chegou depois herdaria um prazo já vencido e
 * levaria silêncio. É a mesma família do bug que uma rejeição não tratada
 * causava (derrubar a requisição de terceiros). O ALS dá um valor por cadeia
 * assíncrona, que é exatamente o recorte de uma requisição.
 *
 * A alternativa era enfiar `deadlineAt` como 7º parâmetro posicional em quatro
 * funções do `reason.ts` que já carregam seis. Não valia.
 */
const contexto = new AsyncLocalStorage<number>();

/** Roda `fn` com um prazo final (epoch ms) visível para todo o `chat()` abaixo. */
export function comPrazo<T>(deadlineAt: number, fn: () => Promise<T>): Promise<T> {
  return contexto.run(deadlineAt, fn);
}

/** O prazo da requisição em curso, se houver. */
export function prazoAtual(): number | undefined {
  return contexto.getStore();
}
