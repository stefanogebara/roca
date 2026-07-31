/**
 * Filtro de ICP na entrada do sourcing.
 *
 * 29/jul: o Felipe Augusto (Agro.com, Boa Esperança) respondeu ao template de
 * café com "nós trabalhamos somente com produtos pecuários, agrícola não
 * trabalhamos". Não foi um "não" de posicionamento — foi erro de mira.
 *
 * A raiz está no termo de busca `agropecuária produtos agrícolas`: no Brasil,
 * "agropecuária" na fachada quer dizer, na prática, ração/pet/veterinário. O
 * Places devolve pet shop, e o pet shop entra na fila como revenda agrícola.
 *
 * Cada disparo desses queima reputação do número, consome cap diário e ainda
 * arrisca denúncia de quem recebeu oferta irrelevante.
 */
import { describe, it, expect } from 'vitest';
import { foraDoICP, motivoForaDoICP } from '../api/_lib/prospect/icp';

describe('foraDoICP — descartar pet/ração/veterinário antes da fila', () => {
  it('pega os que JÁ entraram na base por engano', () => {
    // Todos reais, todos estavam na fila de disparo.
    expect(foraDoICP('Cãopeão Agropecuária', 'Participando de todos os momentos do seu pet! Rações, Acessórios')).toBe(true);
    expect(foraDoICP('Agro União rações', null)).toBe(true);
    expect(foraDoICP('Agro Rural - Rações e Grãos', null)).toBe(true);
    expect(foraDoICP('Pet Shop Amigo Fiel', null)).toBe(true);
  });

  it('pega pelo TIPO do Places mesmo quando o nome não entrega', () => {
    expect(foraDoICP('Casa da Roça Maiolini', 'Produtos para seu Pet, produtos agropecuários e veterinários')).toBe(true);
    expect(foraDoICP('AgroCampo', 'Clínica de Ruminantes, Medicina Pet Preventiva')).toBe(true);
    expect(foraDoICP('Agro.com Agricultura e Pecuária', 'somente produtos pecuários')).toBe(true);
  });

  it('NÃO descarta quem é do nosso ICP', () => {
    for (const [nome, ctx] of [
      ['Cocatrel - Cooperativa dos Cafeicultores da Zona de Três Pontas', null],
      ['Cooxupé - Núcleo de Alfenas', null],
      ['Igarapé Distribuidora Agrícola e Comercial Ltda', null],
      ['Sell Agro — insumos agrícolas', null],
      ['Agrotekne Comércio e Representações', 'defensivos, sementes, fertilizantes'],
      ['Coopercafem', null],
    ] as Array<[string, string | null]>) {
      expect(foraDoICP(nome, ctx), nome).toBe(false);
    }
  });

  it('quem vende insumo agrícola E ração continua dentro — o que importa é ter a linha agrícola', () => {
    // Fazenda Mineira: "Veterinário - Moda Country - Medicamentos - Rações -
    // SEMENTES - Equipamentos". Vende semente, logo atende lavoura.
    expect(foraDoICP('Agropecuária Fazenda Mineira', 'Veterinário, Moda Country, Medicamentos, Rações, Sementes, Equipamentos')).toBe(false);
    expect(foraDoICP('Agro Forte', 'rações e defensivos agrícolas')).toBe(false);
  });

  it('não explode com entrada vazia', () => {
    expect(foraDoICP('', null)).toBe(false);
    expect(foraDoICP('   ', undefined)).toBe(false);
  });
});

describe('motivoForaDoICP — o descarte tem que ser auditável', () => {
  it('diz QUAL sinal disparou, pra dar pra corrigir o filtro depois', () => {
    const m = motivoForaDoICP('Cãopeão Agropecuária', 'medicamentos veterinários pro seu pet');
    expect(m).toBeTruthy();
    expect(m).toMatch(/pet/i);
  });

  it('devolve null pra quem está dentro — sem motivo inventado', () => {
    expect(motivoForaDoICP('Cocatrel - Cooperativa dos Cafeicultores', null)).toBeNull();
  });
});

describe('autopeças — o caso Jocape (31/jul)', () => {
  // Primeira varredura com rotação: o Places devolveu "Jocape" para a query
  // "revenda agrícola em Boa Esperança" e o site é jocapeautopecas.com.br —
  // loja de autopeças. Mesma família do caso pecuária: o nome não denuncia,
  // mas a FONTE (site/uri) sim, e o filtro já recebe as duas.
  it('barra autopeças pelo sinal no nome ou na fonte', () => {
    expect(motivoForaDoICP('Jocape', 'http://www.jocapeautopecas.com.br/')).toMatch(/autope/i);
    expect(motivoForaDoICP('Central das Autopeças', 'maps://x')).toMatch(/autope/i);
    expect(motivoForaDoICP('Auto Peças São Jorge', 'maps://y')).toMatch(/autope/i);
  });

  it('NÃO barra revenda agro legítima', () => {
    expect(motivoForaDoICP('Corpal Comércio e Representações', 'https://www.corpal.com.br/')).toBeNull();
  });
});
