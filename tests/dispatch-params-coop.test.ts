/**
 * Qual construtor de parâmetros um template recebe (05/ago).
 *
 * O dispatch decidia assim:
 *
 *     const isCoopTpl = tpl === COOP_TEMPLATE_NAME;
 *     const params = isCoopTpl ? buildCoopParams(...) : buildTemplateParams(...);
 *
 * Isso usava "veio da env de coop?" como PROXY para "qual a forma dos
 * parâmetros?". Funcionou enquanto as duas envs apontavam para templates
 * diferentes. No momento em que as duas passam a apontar para o MESMO template
 * (o v4, que serve os dois porque não diz nada específico de tipo), o proxy
 * inverte de significado: `isCoopTpl` vira verdadeiro para TODO prospect.
 *
 * A consequência não é cosmética. `buildCoopParams` devolve DOIS parâmetros
 * para qualquer template que não seja o coop_v2; o v4 tem UM. Dois parâmetros
 * num template de um é #132000 em todo envio — 0% de entrega e latch de saúde.
 * É exatamente o apagão de 13/jul, que nasceu de PROSPECT_TEMPLATE_PARAMS
 * divergindo da forma aprovada.
 *
 * A régua certa é a que o próprio arquivo já pregava para a ARIDADE: a forma
 * vem do REGISTRO do template, nunca de qual env o nome veio.
 */
import { describe, it, expect } from 'vitest';
import { usaParamsDeCoop } from '../api/_lib/prospect/dispatch';
import { COOP_NAME, COOP_V2_NAME, V4_NAME, V3_NAME, registryParamCount } from '../api/_lib/prospect/template';
import { buildCoopParams, buildTemplateParams } from '../api/_lib/prospect/personalize';

describe('usaParamsDeCoop', () => {
  it('os templates de distribuição usam o construtor de coop', () => {
    expect(usaParamsDeCoop(COOP_NAME)).toBe(true);
    expect(usaParamsDeCoop(COOP_V2_NAME)).toBe(true);
  });

  it('o v4 NÃO usa, mesmo servindo revenda e cooperativa', () => {
    // Este é o caso que quebrava: v4 na env de coop não o torna um template de
    // coop. Ele tem forma própria (um parâmetro) e é ela que manda.
    expect(usaParamsDeCoop(V4_NAME)).toBe(false);
  });

  it('o v3 também não', () => {
    expect(usaParamsDeCoop(V3_NAME)).toBe(false);
  });
});

describe('a aridade construída bate com a do registro', () => {
  const prospect = { name: 'Rural Consultoria', kind: 'revenda', city: 'Montes Claros' };

  it.each([V4_NAME, V3_NAME, COOP_V2_NAME])('%s', (tpl) => {
    const esperado = registryParamCount(tpl);
    const params = usaParamsDeCoop(tpl)
      ? buildCoopParams(prospect, tpl)
      : buildTemplateParams(prospect, esperado ?? 3);
    expect(params).toHaveLength(esperado as number);
  });
});
