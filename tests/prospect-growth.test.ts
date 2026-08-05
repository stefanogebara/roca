import { describe, it, expect } from 'vitest';
import { buildQueries, toProspectInput, ICP_QUERIES, offsetDoDia, ICP_CITIES, cidadesMaisCarentes} from '../api/_lib/prospect/source';
import {
  shortName,
  kindHook,
  buildTemplateParams,
  renderTemplateText,
} from '../api/_lib/prospect/personalize';
import { computeFunnelStats, playbookBlock } from '../api/_lib/prospect/learn';
import { saudacaoDeEntrada } from '../api/_lib/growth';
import {
  registryParamCount,
  templateBody,
  templateCategory,
  RETOMADA_NAME,
  ENTREGA_NAME,
  DESPEDIDA_NAME,
} from '../api/_lib/prospect/template';

describe('sourcing query grid', () => {
  it('bounds the run (maxCities × queries)', () => {
    const qs = buildQueries(['Varginha MG', 'Lavras MG', 'Alfenas MG', 'Machado MG', 'Guaxupé MG'], 2);
    // Derivado, não fixo: o número de termos muda quando o ICP é corrigido
    // (29/jul trocamos 'agropecuária produtos agrícolas' por dois termos que
    // forçam o lado agrícola). O contrato é "cidades × termos", não "10".
    expect(qs.length).toBe(2 * ICP_QUERIES.length);
    expect(qs[0].q).toMatch(/em Varginha MG$/);
    expect(qs[0].city).toBe('Varginha');
  });
});

describe('toProspectInput', () => {
  it('validates phones through the P1 core, never fabricates', () => {
    const ok = toProspectInput({ name: 'Agro X', phone: '(35) 99999-1234', city: null, source: 'maps://x', website: null }, 'revenda', 'Lavras');
    expect(ok.phone).toBe('+5535999991234');
    expect(ok.wa_status).toBe('pending');
    expect(ok.city).toBe('Lavras');
    const bad = toProspectInput({ name: 'Agro Y', phone: '1234', city: 'Alfenas', source: 'maps://y', website: null }, 'revenda', 'Lavras');
    expect(bad.phone).toBeNull();
    expect(bad.wa_status).toBe('invalid');
    expect(bad.city).toBe('Alfenas'); // listing city wins over query city
  });
});

describe('personalization', () => {
  it('shortName strips corporate noise', () => {
    expect(shortName('GBAGRO - Consultoria e Representação Comercial Ltda')).toBe('GBAGRO');
    expect(shortName('Agropecuária União')).toBe('Agropecuária União');
    expect(shortName('Cooxupé - Matriz Guaxupé')).toBe('Cooxupé'); // caught live: hyphen branch suffix
    expect(shortName('Agro.com Agricultura e Pecuária')).toBe('Agro.com Agricultura e Pecuária');
  });
  it('kindHook maps every kind, with a safe default', () => {
    expect(kindHook('consultoria')).toMatch(/consultoria/);
    expect(kindHook('revenda')).toMatch(/produtores/);
    expect(kindHook('cooperativa')).toMatch(/cooperados/);
    expect(kindHook('fazenda')).toMatch(/caf[ée]/);
    expect(kindHook('whatever')).toMatch(/produtor rural/);
  });
  it('buildTemplateParams matches the configured template arity', () => {
    const p = { name: 'Agro Forte Ltda', kind: 'revenda', city: 'Varginha' };
    expect(buildTemplateParams(p, 1)).toHaveLength(1);
    const v2 = buildTemplateParams(p, 3);
    expect(v2).toHaveLength(3);
    expect(v2[0]).toBe('Agro Forte');
    expect(v2[2]).toBe('Varginha');
  });
});


describe('learning loop', () => {
  it('computes funnel stats by kind', () => {
    const s = computeFunnelStats(
      [
        { kind: 'revenda', status: 'replied', send_status: 'sent' },
        { kind: 'revenda', status: 'contacted', send_status: 'sent' },
        { kind: 'consultoria', status: 'discovered', send_status: null },
      ],
      1
    );
    expect(s.total).toBe(3);
    expect(s.contacted).toBe(2);
    expect(s.replied).toBe(1);
    expect(s.optedOut).toBe(1);
    expect(s.replyRateByKind.revenda).toBe('1/2');
  });

  it('a promoted partner still counts as contacted+replied (and as converted)', () => {
    // Promotion flips status to 'partner' and the reply overwrote send_status —
    // the funnel must not "lose" its best outcome.
    const s = computeFunnelStats(
      [
        { kind: 'consultoria', status: 'partner', send_status: 'replied' },
        { kind: 'consultoria', status: 'stale', send_status: 'sent' },
      ],
      0
    );
    expect(s.contacted).toBe(2);
    expect(s.replied).toBe(1);
    expect(s.partners).toBe(1);
    expect(s.replyRateByKind.consultoria).toBe('1/2');
  });

  it('playbookBlock is bounded and marked informational', () => {
    const b = playbookBlock(['x'.repeat(300), 'objeção comum: já tem agrônomo da coop', 'a', 'b', 'c', 'd', 'e', 'f']);
    expect(b).toMatch(/informativo/i);
    expect(b).toMatch(/REGRAS DURAS/);
    expect(b!.length).toBeLessThanOrEqual(700);
    expect((b!.match(/^- /gm) ?? []).length).toBeLessThanOrEqual(6);
  });

  it('playbookBlock is null when nothing was learned', () => {
    expect(playbookBlock([])).toBeNull();
  });
});

describe('templates v3 / coop_v2 (aprovados 27/jul) — compatibilidade com o registry', () => {
  it('buildTemplateParams com arity 2 devolve [nome, cidade] — o v3 pede exatamente isso', () => {
    // Bug pego antes de religar: com paramCount=2 o builder caía no ramo de 1
    // param e mandava só o nome. A guarda fail-closed abortaria o dispatch
    // (template_shape_mismatch), do mesmo jeito que no outage #132000.
    const p = { name: 'Rural Center Ltda', kind: 'revenda', city: 'Machado' };
    const v3 = buildTemplateParams(p, 2);
    expect(v3).toHaveLength(2);
    expect(v3[0]).toBe('Rural Center'); // shortName tira o sufixo societário
    expect(v3[1]).toBe('Machado');
  });

  it('cidade ausente cai no default seguro, sem furar a arity', () => {
    const v3 = buildTemplateParams({ name: 'Agro X', kind: 'consultoria', city: null }, 2);
    expect(v3).toHaveLength(2);
    expect(v3[1]).toBe('Sul de Minas');
  });

  it('o registry conhece os dois novos com 2 params (senão o dispatch aborta)', async () => {
    const { registryParamCount } = await import('../api/_lib/prospect/template');
    expect(registryParamCount('stevi_parceria_v3')).toBe(2);
    expect(registryParamCount('stevi_parceria_coop_v2')).toBe(2);
  });
});

describe('template de alerta no registry (cobertura de canário do loop de retenção)', () => {
  it('stevi_alerta_v1 está no registry com 1 param — senão o canário não o vigia', async () => {
    const { registryParamCount } = await import('../api/_lib/prospect/template');
    // Sem isto, templateShapeError devolve 'template desconhecido no registry' e
    // o único template do loop de retenção fica sem monitoramento: uma pausa da
    // Meta só apareceria na próxima geada, quando o alerta não sair.
    expect(registryParamCount('stevi_alerta_v1')).toBe(1);
  });
});

// 28/jul: todo template aprovado era de ABERTURA. Quando a conversa com o
// Felipe (Agro.com) esfriar e a janela de 24h fechar, mandar de novo um
// template de primeiro contato lê como robô que esqueceu a conversa.
describe('templates de continuação (retomada / entrega / despedida)', () => {
  it('cada um declara os params que a shape guard vai cobrar', () => {
    expect(registryParamCount(RETOMADA_NAME)).toBe(2);
    expect(registryParamCount(ENTREGA_NAME)).toBe(2);
    expect(registryParamCount(DESPEDIDA_NAME)).toBe(1);
  });

  it('retomada e entrega são UTILITY — cumprem combinado, não ofertam', () => {
    // UTILITY: ~9x mais barato e imune ao teto de marketing por usuário (131049).
    expect(templateCategory(RETOMADA_NAME)).toBe('UTILITY');
    expect(templateCategory(ENTREGA_NAME)).toBe('UTILITY');
  });

  it('despedida é MARKETING — o rodapé vem do componente FOOTER, não do corpo', () => {
    expect(templateCategory(DESPEDIDA_NAME)).not.toBe('UTILITY');
    // submitTemplate anexa o FOOTER a todo MARKETING; repetir no corpo
    // mandaria "responda SAIR" duas vezes na mesma mensagem.
    expect(templateBody(DESPEDIDA_NAME)).not.toMatch(/responda SAIR/i);
  });

  it('utility NÃO leva rodapé de opt-out — não é cold outreach', () => {
    expect(templateBody(RETOMADA_NAME)).not.toMatch(/responda SAIR/i);
    expect(templateBody(ENTREGA_NAME)).not.toMatch(/responda SAIR/i);
  });

  it('nenhum se reapresenta como primeiro contato', () => {
    // "Falo com a X?" é abertura; num follow-up soa como amnésia.
    for (const n of [RETOMADA_NAME, ENTREGA_NAME, DESPEDIDA_NAME]) {
      expect(templateBody(n), n).not.toMatch(/falo com a/i);
    }
  });
});

// 17/jul: alguém escreveu "Oi! Vim pelo Michel" — a mensagem mais quente que
// existe, indicação nominal de um agrônomo parceiro. O sistema gravou
// source='michel' corretamente e respondeu com o panfleto genérico, sem citar
// o Michel. A conversa morreu em 4 segundos e ficou 11 dias em silêncio.
// users.source existia só para métrica (cohort.ts e digest) — nunca virava
// conversa.
describe('saudacaoDeEntrada — quem chega indicado não recebe panfleto', () => {
  it('cita quem indicou, com a inicial maiúscula', () => {
    const t = saudacaoDeEntrada('michel');
    expect(t).toMatch(/Michel/);
    expect(t).not.toMatch(/\bmichel\b/); // não repete em minúscula
  });

  it('termina perguntando da lavoura DELE, não "como posso ajudar"', () => {
    const t = saudacaoDeEntrada('michel');
    expect(t).toMatch(/lavoura|ro[çc]a|planta/i);
    expect(t).not.toMatch(/como posso ajudar/i);
  });

  it('faz UMA pergunta só', () => {
    expect((saudacaoDeEntrada('michel').match(/\?/g) ?? []).length).toBe(1);
  });

  it('não vira lista de funcionalidades — indicado já veio com confiança', () => {
    const t = saudacaoDeEntrada('michel');
    // O panfleto antigo enumerava foto/pulverização/geada/culturas.
    expect(t.length).toBeLessThan(400);
  });

  it('indicação genérica não inventa nome', () => {
    const t = saudacaoDeEntrada('indicação');
    expect(t).toMatch(/indica/i);
    expect(t).not.toMatch(/Indicação\b.*te mandou/i);
  });

  it('token de hashtag vira nome legível', () => {
    expect(saudacaoDeEntrada('tec-jose')).toMatch(/Tec Jose|Jose/i);
  });

  it('sem indicação, mantém a apresentação completa', () => {
    const t = saudacaoDeEntrada(null);
    expect(t).toMatch(/Stevi/);
    expect(t).toMatch(/agr[oô]nomo/i); // a ressalva de não prescrever
  });

  it('mantém a ressalva de que quem prescreve é o agrônomo, mesmo no curto', () => {
    expect(saudacaoDeEntrada('michel')).toMatch(/agr[oô]nomo/i);
  });
})

/**
 * Rotação de cidades no sourcing.
 *
 * buildQueries pegava SEMPRE as 4 primeiras da lista: Varginha, Três Pontas,
 * Guaxupé e Alfenas foram varridas em toda rodada desde 25/jul, e as outras
 * oito cidades da grade NUNCA. O dedup então descartava quase tudo — a "busca
 * na web" parecia esgotada quando na verdade nunca saiu do mesmo quadrante.
 */
describe('buildQueries — rotação para a grade inteira ser varrida', () => {
  const cidades = ['A MG', 'B MG', 'C MG', 'D MG', 'E MG', 'F MG'];

  it('offset desloca a janela de cidades', () => {
    const qs = buildQueries(cidades, 2, 2);
    const usadas = [...new Set(qs.map((q) => q.city))];
    expect(usadas).toEqual(['C', 'D']);
  });

  it('a janela dá a volta no fim da lista', () => {
    const qs = buildQueries(cidades, 3, 5);
    expect([...new Set(qs.map((q) => q.city))]).toEqual(['F', 'A', 'B']);
  });

  it('sem offset, comporta como sempre — as primeiras N', () => {
    const qs = buildQueries(cidades, 2);
    expect([...new Set(qs.map((q) => q.city))]).toEqual(['A', 'B']);
  });
});

/**
 * O bug da rotação, medido em 04/ago: a busca do painel voltou ZERO importados
 * e o último prospect da base era de 31/jul.
 *
 * offsetDoDia fazia `(diaDoAno * 4) % 12`. Como 4 e 12 compartilham fator, a
 * conta só produz TRÊS valores (0, 4, 8) — as janelas intermediárias nunca
 * existem, e 31/jul e 03/ago caíram no mesmo offset 8. Hoje voltou pro offset
 * 0, que é Varginha/Três Pontas/Guaxupé/Alfenas: as quatro cidades mais
 * varridas da base inteira. O dedup comeu 100% do resultado.
 *
 * O erro conceitual: tratei "avançar uma janela por dia" como multiplicação. O
 * certo é o dia do ano DIRETO — a janela desliza uma cidade por dia e cobre a
 * grade toda sem repetir o conjunto em dias seguidos.
 */
describe('offsetDoDia — a rotação precisa mesmo rodar', () => {
  const dia = (iso: string) => offsetDoDia(new Date(iso));

  it('dias consecutivos NUNCA dão o mesmo offset', () => {
    const offs = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06'].map((d) => dia(`${d}T14:00:00Z`));
    expect(new Set(offs).size).toBe(4);
  });

  it('31/jul e 03/ago (o caso real) deixam de colidir', () => {
    expect(dia('2026-07-31T14:00:00Z')).not.toBe(dia('2026-08-03T14:00:00Z'));
  });

  it('em 12 dias visita TODOS os offsets — nenhuma cidade fica órfã', () => {
    const offs = new Set<number>();
    for (let i = 0; i < 12; i++) {
      const d = new Date('2026-08-04T14:00:00Z');
      d.setUTCDate(d.getUTCDate() + i);
      offs.add(offsetDoDia(d));
    }
    expect(offs.size).toBe(12);
  });

  it('o offset é sempre um índice válido da grade', () => {
    for (let i = 0; i < 40; i++) {
      const d = new Date('2026-01-01T14:00:00Z');
      d.setUTCDate(d.getUTCDate() + i * 9);
      const o = offsetDoDia(d);
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o).toBeLessThan(ICP_CITIES.length);
    }
  });
});

describe('ICP_CITIES — a grade precisa ter para onde crescer', () => {
  // 04/ago: as 8 primeiras cidades somam 15-42 prospects cada e o dedup passou
  // a comer 100% das buscas. Grade esgotada não é falha de rotação — é falta de
  // território. Sul de Minas tem dezenas de municípios cafeeiros relevantes.
  it('cobre bem mais que o quadrante original', () => {
    expect(ICP_CITIES.length).toBeGreaterThanOrEqual(24);
  });

  it('toda cidade declara o estado — o Places precisa disso pra não pegar homônima', () => {
    // "Monte Santo" existe na Bahia; "Campos Gerais" no Paraná. Sem UF o Places
    // devolve negócio de outro estado e o disparo vai pra fora da região.
    for (const c of ICP_CITIES) expect(c).toMatch(/\s(MG|SP)$/);
  });

  it('sem duplicatas — cidade repetida gasta quota e não traz nada', () => {
    expect(new Set(ICP_CITIES).size).toBe(ICP_CITIES.length);
  });
});

/**
 * Escolha de cidades por CARÊNCIA, não por calendário.
 *
 * A rotação por data tem um defeito que sobrevive a qualquer conserto de
 * fórmula: ela não sabe onde já varremos. Em 04/ago, com a fórmula já
 * corrigida, o dia caía justamente nas cidades de 15-42 prospects — e a busca
 * voltaria zero de novo. O calendário é cego pro estado da base.
 *
 * Varrer onde há MENOS prospect é auto-corretivo: cidade nova (zero) entra na
 * frente, cidade esgotada só volta quando as outras alcançarem. Sem tabela
 * nova, sem estado — a própria base é o registro.
 */
describe('cidadesMaisCarentes — varrer onde falta, não onde o calendário mandar', () => {
  it('prioriza as que têm menos prospects', () => {
    const contagem = new Map([['Varginha MG', 42], ['Três Corações MG', 0], ['Alfenas MG', 38], ['Muzambinho MG', 0]]);
    expect(cidadesMaisCarentes(['Varginha MG', 'Três Corações MG', 'Alfenas MG', 'Muzambinho MG'], contagem, 2))
      .toEqual(['Três Corações MG', 'Muzambinho MG']);
  });

  it('cidade ausente da contagem conta como ZERO — nunca varrida vai na frente', () => {
    const contagem = new Map([['Varginha MG', 42]]);
    expect(cidadesMaisCarentes(['Varginha MG', 'Nova MG'], contagem, 1)).toEqual(['Nova MG']);
  });

  it('empate resolve pela ordem da grade — determinístico, sem sorteio', () => {
    // Determinismo importa: cron e botão do painel no mesmo dia varrem o mesmo
    // conjunto, e o dedup entre eles continua barato.
    const contagem = new Map<string, number>();
    expect(cidadesMaisCarentes(['A MG', 'B MG', 'C MG'], contagem, 2)).toEqual(['A MG', 'B MG']);
  });

  it('pede mais do que existe: devolve todas, sem quebrar', () => {
    expect(cidadesMaisCarentes(['A MG'], new Map(), 5)).toEqual(['A MG']);
  });
});

describe('buildQueries — rótulo da cidade sem a UF', () => {
  it('tira MG e SP do nome gravado', () => {
    // A grade ganhou Mogiana paulista em 04/ago. Sem tirar o SP, o banco
    // gravaria "Franca SP" e contarPorCidade nunca casaria com a grade —
    // a cidade pareceria eternamente carente e seria varrida todo dia.
    const qs = buildQueries(['Franca SP', 'Varginha MG'], 2, 0);
    expect([...new Set(qs.map((q) => q.city))]).toEqual(['Franca', 'Varginha']);
  });

  it('a QUERY mantém a UF — é ela que impede o Places pegar homônima', () => {
    expect(buildQueries(['Franca SP'], 1, 0)[0].q).toContain('Franca SP');
  });
});
