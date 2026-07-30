/**
 * Stats do funil de prospecção — agregado puro que o painel mostra pros
 * founders (Stefano e Vitória humana) acompanharem a máquina inteira:
 * descoberta → aprovação → disparo → resposta (Vitória agente) → parceiro.
 *
 * Conversão é sobre quem PASSOU pelo estágio, não sobre quem está parado nele:
 * um `partner` já foi contacted e replied. Se a taxa contasse só o estágio
 * atual, cada promoção melhoraria a taxa de resposta esvaziando o denominador —
 * a métrica premiaria mover cards, não conseguir resposta.
 */

import type { ProspectStatus } from './core';

export interface FunnelInput {
  status: ProspectStatus;
  send_status: string | null;
  kind: string | null;
}

export interface KindStats {
  kind: string;
  contatados: number;
  responderam: number;
  /** % inteiro, ou null sem denominador. */
  taxaResposta: number | null;
}

export interface FunnelStats {
  total: number;
  /** Aguardando revisão do founder. */
  descobertos: number;
  /** Aprovados ainda não disparados — a fila do motor. */
  naFila: number;
  /** Já receberam o template (cumulativo: inclui replied/partner/stale). */
  contatados: number;
  /** Já responderam (cumulativo: inclui partner). */
  responderam: number;
  parceiros: number;
  esfriaram: number;
  descartados: number;
  /** responderam / contatados, % inteiro. null quando ninguém foi contatado —
   * 0% diria "ninguém responde" quando a verdade é "ainda não perguntamos". */
  taxaResposta: number | null;
  /** parceiros / responderam, % inteiro. */
  taxaParceria: number | null;
  porTipo: KindStats[];
}

// O callback da Meta às vezes chega antes do flip de status — mesma regra do
// pStage do painel.
const foiEnviado = (s: string | null): boolean => s === 'sent' || s === 'delivered' || s === 'read';

const pct = (num: number, den: number): number | null =>
  den > 0 ? Math.round((num / den) * 100) : null;

/** Agregado do funil. Puro — o handler passa as rows que já lista. */
export function computeFunnelStats(rows: FunnelInput[]): FunnelStats {
  const contatado = (r: FunnelInput): boolean =>
    r.status === 'contacted' ||
    r.status === 'replied' ||
    r.status === 'partner' ||
    r.status === 'stale' ||
    (r.status === 'ready' && foiEnviado(r.send_status));
  const respondeu = (r: FunnelInput): boolean => r.status === 'replied' || r.status === 'partner';

  const contatados = rows.filter(contatado);
  const responderam = rows.filter(respondeu);
  const parceiros = rows.filter((r) => r.status === 'partner').length;

  const kinds = new Map<string, { contatados: number; responderam: number }>();
  for (const r of contatados) {
    const k = r.kind ?? 'outro';
    const cur = kinds.get(k) ?? { contatados: 0, responderam: 0 };
    cur.contatados++;
    if (respondeu(r)) cur.responderam++;
    kinds.set(k, cur);
  }

  return {
    total: rows.length,
    descobertos: rows.filter((r) => r.status === 'discovered').length,
    naFila: rows.filter((r) => r.status === 'ready' && !foiEnviado(r.send_status)).length,
    contatados: contatados.length,
    responderam: responderam.length,
    parceiros,
    esfriaram: rows.filter((r) => r.status === 'stale').length,
    descartados: rows.filter((r) => r.status === 'discarded').length,
    taxaResposta: pct(responderam.length, contatados.length),
    taxaParceria: pct(parceiros, responderam.length),
    porTipo: Array.from(kinds.entries())
      .map(([kind, v]) => ({ kind, ...v, taxaResposta: pct(v.responderam, v.contatados) }))
      .sort((a, b) => b.contatados - a.contatados),
  };
}
