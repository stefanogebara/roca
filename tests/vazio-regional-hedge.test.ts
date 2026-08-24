/**
 * UF regional não recebe data cravada no alerta proativo (24/ago).
 *
 * O caminho REATIVO (`vazioStatus`) já se recusava a afirmar uma data onde a
 * portaria subdivide a UF por região: ele diz "varia por região, confirme a data
 * exata da sua". O caminho PROATIVO afirmava o que o reativo recusava.
 *
 * Não era hipótese. A medição de 24/ago no banco mostra que o único produtor
 * real com soja está em SP — que é regional, com três regiões — e que SP entra
 * na janela de 7 dias em 08/set, três dias antes do fim do voo. Seria o primeiro
 * farmer_alert legítimo da vida do produto, e diria a data da Região III como se
 * fosse a dele.
 *
 * Regra: envelope citado como envelope, com data por extenso e instrução de
 * confirmar. Triagem, não prescrição.
 */
import { describe, it, expect } from 'vitest';
import { buildVazioAlertText } from '../api/_lib/alerts';
import { VAZIO_SOJA_2026, vazioStatus } from '../api/_lib/tools/calendar';
import type { CalendarTransition } from '../api/_lib/tools/calendar';

/** SP: regional, três regiões, envelope terminando em 15/09/2026. */
const sp: CalendarTransition = { uf: 'SP', kind: 'vazio_end', date: '2026-09-15', daysAway: 7 };
/** MT: não regional, uma janela só. */
const mt: CalendarTransition = { uf: 'MT', kind: 'vazio_end', date: '2026-09-06', daysAway: 7 };

describe('UF regional recebe hedge, não data pessoal', () => {
  it('não diz ao produtor de SP que o vazio "termina em 7 dias"', () => {
    const t = buildVazioAlertText(sp);
    expect(t).not.toMatch(/termina em \d+ dias?/i);
    expect(t).not.toContain('7 dias');
  });

  it('avisa que o período varia por região', () => {
    expect(buildVazioAlertText(sp)).toMatch(/varia por regi[ãa]o/i);
  });

  it('manda confirmar antes de agir', () => {
    expect(buildVazioAlertText(sp)).toMatch(/confirme/i);
  });

  it('cita o envelope como envelope, com a data por extenso', () => {
    const t = buildVazioAlertText(sp);
    expect(t).toMatch(/janela geral/i);
    // `fmt` omite o ano corrente (convenção da casa, igual no caminho reativo).
    expect(t).toContain('15 de setembro');
  });

  it('mostra o ano quando a janela cai na virada — BA termina em 2027', () => {
    // BA é regional e o envelope atravessa o ano; AL também vira o ano mas NÃO
    // é regional, então cai no ramo direto e não usa `fmt`.
    const ba = buildVazioAlertText({ uf: 'BA', kind: 'vazio_end', date: '2027-03-14', daysAway: 5 });
    expect(ba).toMatch(/varia por regi[ãa]o/i);
    expect(ba).toContain('de 2027');
  });

  it('cita a portaria, como todo alerta aterrado', () => {
    expect(buildVazioAlertText(sp)).toMatch(/Portaria SDA\/MAPA/);
  });

  it('vale também para o início do vazio', () => {
    const inicio = buildVazioAlertText({ ...sp, kind: 'vazio_start', date: '2026-06-01', daysAway: 3 });
    expect(inicio).toMatch(/varia por regi[ãa]o/i);
    expect(inicio).not.toMatch(/come[çc]a em \d+ dias?/i);
    expect(inicio).toMatch(/guaxa|soja viva/i);
  });

  it('fala a mesma língua do caminho reativo', () => {
    // O reativo já hedgeia SP; as duas superfícies não podem divergir.
    const reativo = vazioStatus('SP', new Date('2026-08-30T12:00:00Z'));
    expect(reativo.line).toMatch(/varia por regi[ãa]o/i);
    expect(buildVazioAlertText(sp)).toMatch(/varia por regi[ãa]o/i);
  });
});

describe('UF não regional segue cravando a data — o hedge é cirúrgico', () => {
  it('MT continua dizendo "termina em 7 dias"', () => {
    const t = buildVazioAlertText(mt);
    expect(t).toMatch(/termina/i);
    expect(t).toContain('7 dias');
    expect(t).not.toMatch(/varia por regi[ãa]o/i);
  });

  it('o início em MT continua direto', () => {
    const t = buildVazioAlertText({ ...mt, kind: 'vazio_start', date: '2026-06-08', daysAway: 3 });
    expect(t).toMatch(/come[çc]a/i);
    expect(t).toContain('3 dias');
    expect(t).not.toMatch(/varia por regi[ãa]o/i);
  });
});

describe('todas as UFs regionais da portaria hedgeiam', () => {
  const regionais = Object.entries(VAZIO_SOJA_2026)
    .filter(([, w]) => w.regional)
    .map(([uf]) => uf);

  it('há mais de uma UF regional na tabela', () => {
    expect(regionais.length).toBeGreaterThan(1);
    expect(regionais).toContain('SP');
    expect(regionais).toContain('PA');
  });

  it('nenhuma delas recebe data pessoal, em nenhuma das duas pontas', () => {
    for (const uf of regionais) {
      for (const kind of ['vazio_start', 'vazio_end'] as const) {
        const texto = buildVazioAlertText({ uf, kind, date: '2026-09-15', daysAway: 5 });
        expect(texto, `${uf}/${kind}`).toMatch(/varia por regi[ãa]o/i);
        expect(texto, `${uf}/${kind}`).not.toMatch(/(termina|come[çc]a) em \d+ dias?/i);
      }
    }
  });
});

describe('a disciplina da casa continua valendo no caminho novo', () => {
  it('nenhum texto tem forma de prescrição', () => {
    const todos = [
      buildVazioAlertText(sp),
      buildVazioAlertText({ ...sp, kind: 'vazio_start' }),
      buildVazioAlertText(mt),
      buildVazioAlertText({ ...mt, kind: 'vazio_start' }),
    ];
    for (const t of todos) {
      expect(t).not.toMatch(/\d+\s?(l|ml|kg|g)\s?\/\s?ha/i);
      expect(t).not.toMatch(/aplique|dose de/i);
    }
  });

  it('UF desconhecida hedgeia — a leitura conservadora', () => {
    const t = buildVazioAlertText({ uf: 'ZZ', kind: 'vazio_end', date: '2026-09-15', daysAway: 5 });
    expect(t).toMatch(/varia por regi[ãa]o/i);
  });
});
