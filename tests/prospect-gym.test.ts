import { describe, it, expect } from 'vitest';
import {
  PROSPECT_PERSONAS,
  computeMedias,
  advanceRate,
  JUDGE_SYSTEM,
  JUDGE_MAX_TOKENS,
  AVANCO_AVISO,
  type GymVerdict,
} from '../api/_lib/prospect/gym';
import { JUDGE_MAX_TOKENS as PAIRED_MAX_TOKENS } from '../api/_lib/prospect/gymPaired';

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
  // `persona` passou a importar: cenários onde parar é o certo saem do
  // denominador. Aqui usamos uma persona onde avançar É possível, pra estes
  // testes continuarem medindo o que sempre mediram.
  const v = (o: Partial<{ avancou: boolean; violacoes: string[] }>) => ({
    persona: 'cetico-preco',
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
    const failed = {
      persona: 'cetico-preco',
      scores: { naturalidade: 0, missao: 0, seguranca: 0 },
      avancou: false,
      violacoes: [],
    };
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

/**
 * O teto de tokens do juiz absoluto.
 *
 * Era 350 e a rodada fbf23a32 perdeu 2 de 14 cenários com "Unexpected end of
 * JSON input" — o mesmo truncamento que tirou 2 lentes do juiz pareado e que eu
 * consertei lá (a2627f1) sem consertar aqui. Conserto pela metade.
 *
 * E a causa piorou por minha mão: a rubrica passou a EXIGIR citação entre aspas
 * em cada violação, o que alonga o JSON, sem que o teto subisse junto. Regra
 * nova que aumenta o output precisa de orçamento novo.
 *
 * O JSON daqui é maior que o do pareado: 3 notas + avancou + dois arrays +
 * veredito de 1-2 frases, agora com trechos citados. 700 dá folga real.
 */
describe('orçamento de tokens do juiz absoluto', () => {
  it('cabe um JSON com dois arrays, veredito e citações', () => {
    expect(JUDGE_MAX_TOKENS).toBeGreaterThanOrEqual(700);
  });

  it('é mais folgado que o do juiz pareado — o JSON daqui é maior', () => {
    expect(JUDGE_MAX_TOKENS).toBeGreaterThan(PAIRED_MAX_TOKENS);
  });
});

/**
 * O denominador do avanço limpo, e o que ele NÃO conserta.
 *
 * 30/jul, quatro rodadas de código idêntico: avanço limpo deu 29%, 36%, 36% e
 * 57% — 28 pontos de amplitude sem uma linha diferente. Fui decompor por
 * persona e apareceram dois problemas distintos.
 *
 * 1. TRÊS CENÁRIOS NÃO PODEM AVANÇAR POR CONSTRUÇÃO: auto-atendimento (é um
 *    menu de bot), pessoa-errada (o certo é captar o redirecionamento) e
 *    sem-interesse (ele recusou). A rubrica do juiz JÁ diz que parar é o certo
 *    neles — mas o denominador contava os três, então o teto real da métrica
 *    era ~79% e ela nunca chegaria a 100% por melhor que a Vitória ficasse.
 *
 * 2. CORRIGIR ISSO NÃO REDUZ O RUÍDO — AUMENTA. Com denominador 11 as mesmas
 *    rodadas viram 36%, 45%, 45% e 73%: a amplitude sobe de 28 para 37 pontos,
 *    porque o numerador não mudou (esses três nunca somaram) e agora divide-se
 *    por menos. O ruído mora nas ~6 personas cara-ou-coroa, e nenhuma cirurgia
 *    no denominador chega lá.
 *
 * Então isto é conserto de ACURÁCIA, não de estabilidade — e é por isso que o
 * aviso impresso junto importa tanto quanto o número.
 */
describe('avanço limpo — denominador só com cenários onde avançar é possível', () => {
  const v = (persona: string, over: Partial<GymVerdict> = {}) =>
    ({ persona, scores: { naturalidade: 4, missao: 4, seguranca: 4 }, ...over }) as GymVerdict;

  it('cenário onde PARAR é o certo não entra no denominador', () => {
    const r = advanceRate([
      v('cetico-preco', { avancou: true }),
      v('sem-interesse', { avancou: false }),
      v('auto-atendimento', { avancou: false }),
      v('pessoa-errada', { avancou: false }),
    ]);
    // 1 de 1 possível — não 1 de 4. Contar os três como fracasso é medir a
    // Vitória por não ter vendido para um menu automático.
    expect({ advanced: r.advanced, total: r.total, rate: r.rate }).toEqual({ advanced: 1, total: 1, rate: 100 });
  });

  it('as quatro rodadas de controle: 4/11, 5/11, 5/11, 8/11', () => {
    // Ancorado nos números reais de 30/jul. Se alguém mexer no conjunto de
    // personas excluídas, estes valores mudam e o teste conta a história.
    const possiveis = PROSPECT_PERSONAS.filter((p) => !p.pararEhOCerto).length;
    expect(possiveis).toBe(11);
  });

  it('violação continua vetando, mesmo com avanço', () => {
    const r = advanceRate([v('cetico-preco', { avancou: true, violacoes: ['citou preço'] })]);
    expect(r.advanced).toBe(0);
  });

  it('o aviso de ruído acompanha o número — medido, não adjetivo', () => {
    expect(AVANCO_AVISO).toMatch(/4.*8|rodadas id[êe]nticas/i);
  });
});
