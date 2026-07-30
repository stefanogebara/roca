/**
 * Dispara trabalho de fundo sem deixar a rejeição escapar.
 *
 * `void algumaEscrita(...)` parece inofensivo e não é. Se a promise rejeita e
 * ninguém tem handler, o Node 22 encerra o processo por padrão. No Fluid Compute
 * a instância é REUSADA entre requisições concorrentes, então uma gravação de
 * telemetria falhando pode derrubar a resposta de OUTRO produtor que estava em
 * voo na mesma instância. Ninguém deve pagar com a própria resposta por um dado
 * que existe só pra nós.
 *
 * Recebe um thunk, não uma promise: `getDb()` lança na hora quando falta env, e
 * um throw ao MONTAR a chamada escaparia de um catch que só olhasse a promise
 * já pronta. Foi assim que as rejeições soltas de insertTriageEvent nasceram.
 */

import { createLogger } from './logger';

const log = createLogger('bg');

/**
 * Roda `fn` sem esperar e sem deixar erro vazar. Nunca lança — o chamador segue
 * como se nada tivesse acontecido, porque para ele nada aconteceu: a resposta
 * ao produtor não depende disso.
 *
 * @param escopo o que estava sendo gravado, para o log dizer algo útil
 */
export function fireAndForget(fn: () => Promise<unknown> | unknown, escopo: string): void {
  try {
    Promise.resolve(fn()).catch((e: unknown) => {
      log.error(`${escopo} falhou (fundo, ignorado):`, (e as Error)?.message ?? String(e));
    });
  } catch (e) {
    // Throw síncrono dentro de fn, antes de virar promise.
    log.error(`${escopo} lançou na chamada (fundo, ignorado):`, (e as Error)?.message ?? String(e));
  }
}
