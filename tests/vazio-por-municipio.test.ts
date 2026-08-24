/**
 * Município → região → data exata do vazio sanitário (24/ago).
 *
 * A portaria subdivide 7 UFs por região, cada uma definida por lista de
 * municípios em nota de rodapé. Sem esse mapa, o alerta só sabia o envelope da
 * UF. Com ele, sabe a data do produtor — e, o que importa mais, o DIA CERTO DE
 * AVISAR: a Região I de SP termina em 31/ago e o envelope, em 15/set. Avisar no
 * envelope é avisar 15 dias depois do fato.
 *
 * Regra de ouro: município que não resolve devolve null e o chamador hedgeia.
 * Falhar para o hedge é seguro; falhar para uma data errada não é.
 */
import { describe, it, expect } from 'vitest';
import { resolverRegiao, ufTemRegioes, normalizarMunicipio, SAFRA_TABELA_REGIOES } from '../api/_lib/tools/vazioRegiao';
import { upcomingTransitions, SAFRA_VAZIO } from '../api/_lib/tools/calendar';
import { buildVazioAlertText, alertDedupKey } from '../api/_lib/alerts';

describe('resolverRegiao', () => {
  it('acha Sorocaba na Região I de SP, que termina em 31/ago', () => {
    const r = resolverRegiao('SP', 'Sorocaba');
    expect(r).toEqual({ regiao: 'I', start: '2026-06-01', end: '2026-08-31', porExclusao: false });
  });

  it('acha Campinas na Região II de SP, que termina em 12/set', () => {
    expect(resolverRegiao('SP', 'Campinas')?.regiao).toBe('II');
    expect(resolverRegiao('SP', 'Campinas')?.end).toBe('2026-09-12');
  });

  it('normaliza acento, caixa e espaço — o OCR da portaria não é limpo', () => {
    for (const grafia of ['sorocaba', 'SOROCABA', '  Sorocaba  ', 'Sorocába']) {
      expect(resolverRegiao('SP', grafia)?.regiao, grafia).toBe('I');
    }
  });

  it('resolve município que o OCR quebrou — Itaetê, na BA', () => {
    // A coluna do PDF comeu o "I": o extrator corrige e o teste vigia.
    expect(resolverRegiao('BA', 'Itaetê')?.regiao).toBe('I');
  });

  it('SC usa a região "demais municípios do estado" por exclusão', () => {
    // Araranguá está na lista explícita da Região I; Florianópolis não está em
    // lista nenhuma e cai no "demais municípios do estado" (Região II).
    const naLista = resolverRegiao('SC', 'Araranguá');
    expect(naLista?.regiao).toBe('I');
    expect(naLista?.porExclusao).toBe(false);
    const fora = resolverRegiao('SC', 'Florianópolis');
    expect(fora?.regiao).toBe('II');
    expect(fora?.porExclusao).toBe(true);
  });

  it('devolve null onde tem de hedgear', () => {
    expect(resolverRegiao('MT', 'Sorriso')).toBeNull();   // UF não subdividida
    expect(resolverRegiao('SP', 'Lugar Que Não Existe')).toBeNull();
    expect(resolverRegiao('SP', null)).toBeNull();        // município desconhecido
    expect(resolverRegiao(null, 'Sorocaba')).toBeNull();
    expect(resolverRegiao('SP', '')).toBeNull();
  });

  it('sabe quais UFs a portaria subdivide', () => {
    for (const uf of ['BA', 'MA', 'PA', 'PR', 'PI', 'SC', 'SP']) expect(ufTemRegioes(uf), uf).toBe(true);
    for (const uf of ['MT', 'MS', 'GO', 'MG']) expect(ufTemRegioes(uf), uf).toBe(false);
  });

  it('a tabela de regiões e o calendário falam da mesma safra', () => {
    expect(SAFRA_TABELA_REGIOES).toBe(SAFRA_VAZIO);
  });

  it('normalizarMunicipio é estável', () => {
    expect(normalizarMunicipio('São Paulo')).toBe('sao paulo');
    expect(normalizarMunicipio("Aparecida d 'Oeste")).toBe("aparecida d'oeste");
    expect(normalizarMunicipio('Pariquera - Açu')).toBe('pariquera-acu');
  });
});

describe('o dia do aviso passa a ser o da região', () => {
  it('a Região I de SP entra na janela em 24/ago, não em 08/set', () => {
    const emAgosto = upcomingTransitions(new Date('2026-08-24T12:00:00Z'), 7);
    const spRI = emAgosto.find((t) => t.uf === 'SP' && t.regiao === 'I' && t.kind === 'vazio_end');
    expect(spRI).toBeDefined();
    expect(spRI!.date).toBe('2026-08-31');
    expect(spRI!.daysAway).toBe(7);
  });

  it('o envelope de SP continua existindo, para quem não resolve a região', () => {
    const emSetembro = upcomingTransitions(new Date('2026-09-08T12:00:00Z'), 7);
    const envelope = emSetembro.find((t) => t.uf === 'SP' && !t.regiao && t.kind === 'vazio_end');
    expect(envelope).toBeDefined();
    expect(envelope!.date).toBe('2026-09-15');
  });

  it('UF não subdividida não ganha transição de região', () => {
    const t = upcomingTransitions(new Date('2026-08-30T12:00:00Z'), 7);
    expect(t.filter((x) => x.uf === 'MT').every((x) => !x.regiao)).toBe(true);
  });
});

describe('o texto crava a data quando a região é conhecida', () => {
  const comRegiao = { uf: 'SP', kind: 'vazio_end' as const, date: '2026-08-31', daysAway: 7, regiao: 'I' };
  const semRegiao = { uf: 'SP', kind: 'vazio_end' as const, date: '2026-09-15', daysAway: 7 };

  it('nomeia a região e dá a data, sem hedge', () => {
    const t = buildVazioAlertText(comRegiao);
    expect(t).toMatch(/sua regi[ãa]o de SP/i);
    expect(t).toContain('Região I da portaria');
    expect(t).toContain('7 dias');
    expect(t).not.toMatch(/varia por regi[ãa]o/i);
    expect(t).toMatch(/Portaria SDA\/MAPA/);
  });

  it('sem região, segue hedgeando e pedindo o município', () => {
    const t = buildVazioAlertText(semRegiao);
    expect(t).toMatch(/varia por regi[ãa]o/i);
    expect(t).toMatch(/me diz o munic[íi]pio/i);
  });

  it('envelope e região da mesma UF são eventos distintos no dedup', () => {
    expect(alertDedupKey(comRegiao)).not.toBe(alertDedupKey(semRegiao));
    expect(alertDedupKey(comRegiao)).toContain(':SP:RI:');
    expect(alertDedupKey(semRegiao)).toContain(':SP:');
    expect(alertDedupKey(semRegiao)).not.toContain(':RI:');
  });

  it('nenhum dos dois tem forma de prescrição', () => {
    for (const t of [buildVazioAlertText(comRegiao), buildVazioAlertText(semRegiao)]) {
      expect(t).not.toMatch(/\d+\s?(l|ml|kg|g)\s?\/\s?ha/i);
      expect(t).not.toMatch(/aplique|dose de/i);
    }
  });
});
