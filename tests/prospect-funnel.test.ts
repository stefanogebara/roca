/**
 * Stats do funil de prospecção — o número que o painel mostra pros founders.
 *
 * A regra que importa: conversão é sobre quem PASSOU pelo estágio, não sobre
 * quem está nele agora. Um prospect `partner` já foi contacted e replied; se a
 * taxa de resposta contasse só quem está parado em `contacted`, cada promoção
 * MELHORARIA a taxa de resposta ao esvaziar o denominador — a métrica premiaria
 * mover gente de estágio, não conseguir resposta.
 */
import { describe, it, expect } from 'vitest';
import { computeFunnelStats, type FunnelInput } from '../api/_lib/prospect/funnel';

const p = (over: Partial<FunnelInput>): FunnelInput => ({
  status: 'discovered',
  send_status: null,
  kind: 'revenda',
  ...over,
});

describe('computeFunnelStats', () => {
  it('conta estágios cumulativos: parceiro também já foi contatado e respondeu', () => {
    const s = computeFunnelStats([
      p({ status: 'discovered' }),
      p({ status: 'ready' }),
      p({ status: 'contacted' }),
      p({ status: 'replied' }),
      p({ status: 'partner' }),
      p({ status: 'stale' }), // contatado que nunca respondeu
      p({ status: 'discarded' }),
    ]);
    expect(s.total).toBe(7);
    expect(s.contatados).toBe(4); // contacted + replied + partner + stale
    expect(s.responderam).toBe(2); // replied + partner
    expect(s.parceiros).toBe(1);
  });

  it('ready com send_status=sent conta como contatado — o status pode atrasar', () => {
    // Mesma regra do pStage do painel: o callback da Meta às vezes chega antes
    // do flip de status.
    const s = computeFunnelStats([p({ status: 'ready', send_status: 'sent' })]);
    expect(s.contatados).toBe(1);
    expect(s.naFila).toBe(0);
  });

  it('taxas com denominador honesto, null quando não há denominador', () => {
    const s = computeFunnelStats([
      p({ status: 'contacted' }),
      p({ status: 'contacted' }),
      p({ status: 'replied' }),
      p({ status: 'partner' }),
    ]);
    expect(s.taxaResposta).toBe(50); // 2 responderam de 4 contatados
    expect(s.taxaParceria).toBe(50); // 1 parceiro de 2 que responderam
    const vazio = computeFunnelStats([p({ status: 'discovered' })]);
    expect(vazio.taxaResposta).toBeNull(); // 0 contatados: sem taxa, não 0%
    expect(vazio.taxaParceria).toBeNull();
  });

  it('quebra por tipo, pra saber ONDE a conversa converte', () => {
    const s = computeFunnelStats([
      p({ kind: 'cooperativa', status: 'replied' }),
      p({ kind: 'cooperativa', status: 'contacted' }),
      p({ kind: 'revenda', status: 'stale' }),
    ]);
    const coop = s.porTipo.find((k) => k.kind === 'cooperativa');
    expect(coop).toMatchObject({ contatados: 2, responderam: 1, taxaResposta: 50 });
    const rev = s.porTipo.find((k) => k.kind === 'revenda');
    expect(rev).toMatchObject({ contatados: 1, responderam: 0, taxaResposta: 0 });
  });

  it('lista vazia não explode', () => {
    const s = computeFunnelStats([]);
    expect(s.total).toBe(0);
    expect(s.taxaResposta).toBeNull();
  });
});
