/**
 * Duas correções do /intel de 24/ago, ambas no caminho do alerta de vazio.
 *
 * 1. A TABELA ESTAVA INCOMPLETA. Cobria 17 das 22 UFs da Portaria SDA/MAPA
 *    1.579/2026. Faltavam AL, AP, CE, PA e RR — e o PA tem peso real em soja,
 *    com janela que cai dentro do voo de 60 dias. Um produtor do PA recebia
 *    `{ known: false, line: null }`: silêncio, não erro, que é o modo de falha
 *    mais difícil de notar.
 *
 * 2. A CHAVE DE DEDUP NÃO TINHA SAFRA. `alertDedupKey` era
 *    `kind:UF:data`, e o reenvio anual funcionava por ACIDENTE — só porque a
 *    portaria muda as datas todo ano. Uma portaria futura que repetisse data e
 *    UF colidiria com o `unique (user_id, dedup_key)` de `farmer_alerts` e o
 *    alerta sumiria em silêncio.
 *
 * O teste de sincronia no fim é o que impede a correção 2 de apodrecer: ele
 * deriva os anos da própria tabela e falha se `SAFRA_VAZIO` sair de sintonia.
 */
import { describe, it, expect } from 'vitest';
import {
  VAZIO_SOJA_2026,
  SAFRA_VAZIO,
  vazioStatus,
  upcomingTransitions,
} from '../api/_lib/tools/calendar';
import { alertDedupKey } from '../api/_lib/alerts';
import type { CalendarTransition } from '../api/_lib/tools/calendar';

/** As 22 UFs da Portaria SDA/MAPA 1.579/2026, na ordem da própria portaria. */
const UFS_DA_PORTARIA = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'GO', 'MA', 'MG', 'MT',
  'MS', 'PA', 'PR', 'PI', 'RJ', 'RS', 'RO', 'RR', 'SC', 'SP', 'TO',
];

describe('a tabela cobre a portaria inteira', () => {
  it('tem exatamente as 22 UFs da portaria', () => {
    expect(Object.keys(VAZIO_SOJA_2026).sort()).toEqual([...UFS_DA_PORTARIA].sort());
  });

  it('nenhuma UF da portaria devolve known:false', () => {
    const mudas = UFS_DA_PORTARIA.filter(
      (uf) => !vazioStatus(uf, new Date('2026-08-30T12:00:00Z')).known
    );
    expect(mudas).toEqual([]);
  });

  it('UF fora da portaria segue em silêncio honesto, não em erro', () => {
    // ES, PB, PE, RN, SE e MS-vizinhos não constam da portaria de soja.
    const st = vazioStatus('ES', new Date('2026-08-30T12:00:00Z'));
    expect(st).toEqual({ known: false, active: false, line: null });
  });
});

describe('as cinco UFs que faltavam', () => {
  it('PA: janela envelope de 15/jun a 15/nov, marcada como regional', () => {
    expect(VAZIO_SOJA_2026.PA).toEqual({
      start: '2026-06-15',
      end: '2026-11-15',
      regional: true,
    });
  });

  it('PA hedgeia por região em vez de afirmar uma data', () => {
    const st = vazioStatus('PA', new Date('2026-08-30T12:00:00Z'));
    expect(st.known).toBe(true);
    expect(st.active).toBe(true);
    expect(st.line).toMatch(/varia por regi[ãa]o/i);
    expect(st.line).toMatch(/Portaria SDA\/MAPA/);
  });

  it('AL, AP, CE e RR não são regionais e têm janela na virada do ano', () => {
    expect(VAZIO_SOJA_2026.AL).toEqual({ start: '2027-01-01', end: '2027-04-01', regional: false });
    expect(VAZIO_SOJA_2026.AP).toEqual({ start: '2026-12-01', end: '2027-02-28', regional: false });
    expect(VAZIO_SOJA_2026.CE).toEqual({ start: '2026-11-03', end: '2027-01-31', regional: false });
    expect(VAZIO_SOJA_2026.RR).toEqual({ start: '2026-12-19', end: '2027-03-18', regional: false });
  });

  it('o PA entra nas transições da janela do voo — 15/nov, a 7 dias de 08/nov', () => {
    const t = upcomingTransitions(new Date('2026-11-08T12:00:00Z'), 7);
    expect(t.some((x) => x.uf === 'PA' && x.kind === 'vazio_end')).toBe(true);
  });
});

describe('a chave de dedup carrega a safra', () => {
  const mt: CalendarTransition = {
    uf: 'MT',
    kind: 'vazio_end',
    date: '2026-09-06',
    daysAway: 7,
  };

  it('inclui a safra na chave', () => {
    expect(alertDedupKey(mt)).toContain(SAFRA_VAZIO);
    expect(alertDedupKey(mt)).toBe(`vazio_end:${SAFRA_VAZIO}:MT:2026-09-06`);
  });

  it('duas safras com a MESMA data e UF geram chaves diferentes', () => {
    // O cenário que fazia o alerta sumir: portaria futura repete 06/set em MT.
    const chaveAtual = alertDedupKey(mt);
    const chaveOutraSafra = chaveAtual.replace(SAFRA_VAZIO, '2027/28');
    expect(chaveOutraSafra).not.toBe(chaveAtual);
  });

  it('start e end da mesma UF e safra continuam distintos', () => {
    const start: CalendarTransition = { ...mt, kind: 'vazio_start', date: '2026-06-08' };
    expect(alertDedupKey(start)).not.toBe(alertDedupKey(mt));
  });

  it('UFs diferentes na mesma data continuam distintas', () => {
    const ms: CalendarTransition = { ...mt, uf: 'MS' };
    expect(alertDedupKey(ms)).not.toBe(alertDedupKey(mt));
  });
});

describe('SAFRA_VAZIO não pode sair de sintonia com a tabela', () => {
  it('bate com os anos derivados da própria tabela', () => {
    // A safra vai do ano do primeiro vazio ao seguinte. Derivar da tabela em vez
    // de repetir a constante é o que faz este teste falhar quando alguém
    // atualiza as datas e esquece a safra.
    const anos = Object.values(VAZIO_SOJA_2026).map((w) => Number(w.start.slice(0, 4)));
    const primeiro = Math.min(...anos);
    const esperado = `${primeiro}/${String(primeiro + 1).slice(2)}`;
    expect(SAFRA_VAZIO).toBe(esperado);
  });

  it('tem a forma AAAA/AA', () => {
    expect(SAFRA_VAZIO).toMatch(/^\d{4}\/\d{2}$/);
  });
});
