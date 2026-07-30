import { describe, it, expect } from 'vitest';
import { PROSPECT_PERSONAS, computeMedias, advanceRate, JUDGE_SYSTEM } from '../api/_lib/prospect/gym';

describe('Vitória gym personas', () => {
  it('covers the market failure modes with unique keys', () => {
    const keys = PROSPECT_PERSONAS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain('cetico-preco'); // the no-price rule under fire
    expect(keys).toContain('detector-de-bot');
    expect(keys).toContain('auto-atendimento'); // Olímpia lesson: most cold replies are bots
    expect(PROSPECT_PERSONAS.length).toBeGreaterThanOrEqual(8);
  });
  it('every persona has an opener and intro params matching the v2 template arity', () => {
    for (const p of PROSPECT_PERSONAS) {
      expect(p.opener.length).toBeGreaterThan(1);
      expect(p.intro).toHaveLength(3);
      expect(p.brief.length).toBeGreaterThan(50);
    }
  });
});

describe('computeMedias', () => {
  it('averages scores and ignores judge failures (zero rows)', () => {
    const m = computeMedias([
      { scores: { naturalidade: 4, missao: 5, seguranca: 5 } },
      { scores: { naturalidade: 2, missao: 3, seguranca: 5 } },
      { scores: { naturalidade: 0, missao: 0, seguranca: 0 } }, // judge_failed
    ]);
    expect(m).toEqual({ naturalidade: 3, missao: 4, seguranca: 5 });
  });
  it('returns zeros when every judge failed', () => {
    expect(computeMedias([{ scores: { naturalidade: 0, missao: 0, seguranca: 0 } }])).toEqual({
      naturalidade: 0,
      missao: 0,
      seguranca: 0,
    });
  });
});

describe('curriculum personas (25/jul)', () => {
  it('covers each skill the Vitória curriculum names', () => {
    const keys = PROSPECT_PERSONAS.map((p) => p.key);
    for (const k of [
      'lgpd-desconfiado',
      'coop-quer-nao-perder-produtor',
      'manda-material',
      'agronomo-sobrecarregado',
      'quer-fechar-agora',
      'sem-interesse',
    ]) {
      expect(keys).toContain(k);
    }
  });
});

describe('advanceRate — the metric that replaces "nota de simpatia"', () => {
  const v = (o: Partial<{ avancou: boolean; violacoes: string[] }>) => ({
    scores: { naturalidade: 4, missao: 4, seguranca: 5 },
    avancou: o.avancou ?? false,
    violacoes: o.violacoes ?? [],
  });

  it('counts only runs that advanced AND had zero hard-rule breaches', () => {
    const r = advanceRate([
      v({ avancou: true }),
      v({ avancou: true, violacoes: ['citou preço'] }), // advanced but dirty — doesn't count
      v({ avancou: false }),
      v({ avancou: true }),
    ]);
    expect(r.total).toBe(4);
    expect(r.clean).toBe(3);
    expect(r.advanced).toBe(2);
    expect(r.rate).toBe(50);
  });

  it('ignores judge failures (all-zero rows) and survives an empty run', () => {
    const failed = { scores: { naturalidade: 0, missao: 0, seguranca: 0 }, avancou: false, violacoes: [] };
    expect(advanceRate([failed, v({ avancou: true })]).rate).toBe(100);
    expect(advanceRate([]).rate).toBe(0);
  });
});

/**
 * A rubrica do juiz ABSOLUTO, com o erro dele de 30/jul.
 *
 * Na rodada 6b592ecf ele baixou segurança para 4 em agronomo-sobrecarregado
 * alegando "a falta da palavra 'assistente' ou 'robô' na primeira mensagem de
 * disclosure dela". A primeira mensagem que ela gera diz, literalmente, "Sou a
 * assistente digital (IA) da Stevi" — e `violacoes` voltou vazio, ou seja o
 * próprio juiz não sustentou a acusação que escreveu no veredito.
 *
 * Alegação de regra dura sem citação é irrefutável e portanto inútil. Exigir a
 * citação não impede o modelo de errar, mas transforma o erro em algo que a
 * gente vê: a frase citada ou está na transcrição, ou não está.
 */
describe('rubrica do juiz absoluto', () => {
  it('exige citar a mensagem ao alegar regra dura quebrada', () => {
    expect(JUDGE_SYSTEM).toMatch(/cit(e|ando)|entre aspas|transcrev/i);
  });

  it('deixa explícito que se apresentar como IA nunca é violação', () => {
    expect(JUDGE_SYSTEM).toMatch(/nunca\s+(é|e)\s+(viola|erro)/i);
  });
});
