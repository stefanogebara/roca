/**
 * Escrita tipada — o antídoto pro "Anotado ✅" que não anotou.
 *
 * A auditoria chamou de "mentira silenciosa", e é a pior classe de bug que
 * temos. O produtor confia que a Stevi guardou, para de anotar no caderno dele,
 * e meses depois descobre que não havia nada. Diferente de um erro visível,
 * esse corrói exatamente a tese do produto — "eu lembro por você".
 *
 * A defesa NÃO é lembrar de checar o retorno. É tornar impossível produzir a
 * confirmação sem ter o valor de sucesso na mão. Mesma lição do AgentAction de
 * ontem: quando o errado não é representável, ninguém precisa lembrar de nada.
 *
 * Duas camadas:
 *  1. validar o argumento ANTES do banco — coordenada (0,0) e lista de
 *     culturas vazia são erros de parse que chegariam como dado válido;
 *  2. `persist` + `confirmarOuAvisar` — o resultado é uma união discriminada e
 *     a mensagem de falha é obrigatória.
 */

import { createLogger } from './logger';
import { parseCrops } from './tools/crops';

const log = createLogger('persist');

export type WriteResult<T> = { ok: true; valor: T } | { ok: false; motivo: string };

/**
 * Envolve uma escrita. Trata como FALHA o que as funções de `db.ts` usam para
 * sinalizar erro — `null` e `false` — e captura exceção.
 *
 * `0` e `''` são sucessos legítimos: um id vazio não existe, mas um contador
 * zerado sim, e tratar valor falsy como erro é o bug clássico dessa camada.
 */
export async function persist<T>(
  rotulo: string,
  escrita: () => Promise<T | null | false>
): Promise<WriteResult<T>> {
  try {
    const v = await escrita();
    if (v === null || v === undefined || v === false) {
      log.error(`escrita "${rotulo}" não confirmou (retorno ${JSON.stringify(v)})`);
      return { ok: false, motivo: `o banco não confirmou a escrita de ${rotulo}` };
    }
    return { ok: true, valor: v as T };
  } catch (e) {
    const motivo = (e as Error).message.slice(0, 120);
    log.error(`escrita "${rotulo}" falhou:`, motivo);
    return { ok: false, motivo };
  }
}

/**
 * Constrói a resposta ao produtor a partir do resultado. `avisa` é obrigatório
 * de propósito — era exatamente por ali que saía "Anotado ✅" sem escrita.
 */
export function confirmarOuAvisar<T>(
  r: WriteResult<T>,
  msgs: { confirma: (valor: T) => string; avisa: (motivo: string) => string }
): string {
  if (typeof msgs?.avisa !== 'function') {
    throw new Error('confirmarOuAvisar exige `avisa`: confirmar sem tratar a falha é como o "Anotado ✅" mentia');
  }
  return r.ok ? msgs.confirma(r.valor) : msgs.avisa(r.motivo);
}

// ── Validação de argumento ──────────────────────────────────────────────────

/** Motivo pelo qual a coordenada não presta, ou null se estiver ok. */
export function validarCoordenada(lat: number, lon: number): string | null {
  if (!Number.isFinite(lat)) return 'latitude não é um número';
  if (!Number.isFinite(lon)) return 'longitude não é um número';
  if (lat < -90 || lat > 90) return `latitude fora da faixa (${lat})`;
  if (lon < -180 || lon > 180) return `longitude fora da faixa (${lon})`;
  // (0,0) fica no Golfo da Guiné — a "Ilha Nula". Nenhuma lavoura brasileira
  // cai ali, e é o resultado mais comum de um parse que falhou em silêncio.
  if (lat === 0 && lon === 0) return 'coordenada 0,0 (Ilha Nula) — quase sempre erro de parse';
  return null;
}

/** Motivo pelo qual a lista de culturas não presta, ou null se estiver ok. */
export function validarCulturas(crops: string[]): string | null {
  if (!Array.isArray(crops) || crops.length === 0) {
    // Gravar vazio SOBRESCREVE o que o produtor já tinha dito. Silenciosamente.
    return 'lista de culturas vazia — gravar isso apagaria o que ele já disse';
  }
  const desconhecidas = crops.filter((c) => parseCrops(c).length === 0);
  if (desconhecidas.length) return `cultura desconhecida: ${desconhecidas.join(', ')}`;
  return null;
}
