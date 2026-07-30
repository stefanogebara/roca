/**
 * O número público da Stevi, num lugar só.
 *
 * Ele aparece no QR impresso, no cartão .vcf, no rodapé de todo card e nos links
 * de compartilhamento — a volta do produtor pro canal, que é o loop de aquisição
 * declarado. Estava resolvido em SEIS lugares, cada um com o mesmo literal
 * embutido, o que é uma migração de número esperando pra dar errado pela metade.
 *
 * O fallback fica de propósito: os comentários originais (qr.ts, render.ts,
 * pipeline.ts) decidiram que env não configurada não pode APAGAR o caminho de
 * volta, e isso está certo — um card sem link é pior que um card com o número
 * antigo. O que faltava era o fallback não ser silencioso: agora ele grita no log
 * uma vez, em vez de servir o número americano caladinho.
 *
 * Não lança de propósito: esse valor é lido no meio da resposta ao produtor
 * (rodapé de card, isca de indicação). Transformar número velho em resposta que
 * não chega troca um problema cosmético por um apagão.
 */

import { createLogger } from './logger';

const log = createLogger('wa-number');

/**
 * Número embutido. É o mesmo literal que `web/index.html` traz e que o
 * `scripts/build-web.mjs` substitui no build — se um dia mudar, mude nos dois
 * (tests/wa-number.test.ts falha se eles divergirem).
 */
export const DEFAULT_PUBLIC_WA_NUMBER = '19705509125';

let avisou = false;

/** Só dígitos, como wa.me e o TEL do vCard querem. */
export function publicWaNumber(): string {
  const bruto = process.env.PUBLIC_WA_NUMBER;
  if (bruto && bruto.replace(/\D/g, '')) return bruto.replace(/\D/g, '');
  if (!avisou) {
    avisou = true;
    log.error(
      `PUBLIC_WA_NUMBER não configurado — caindo no número embutido ${DEFAULT_PUBLIC_WA_NUMBER}. ` +
        'QR, .vcf, rodapé de card e link de compartilhamento vão apontar pra ele.'
    );
  }
  return DEFAULT_PUBLIC_WA_NUMBER;
}

/** Testes: o aviso-uma-vez é estado de módulo e vaza entre casos. */
export function resetWaNumberWarning(): void {
  avisou = false;
}
