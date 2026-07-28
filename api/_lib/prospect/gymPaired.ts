/**
 * Juiz PAREADO do gym da Vitória — decide qual de duas versões do prompt é
 * melhor, em vez de dar nota a uma.
 *
 * Por que trocar a nota absoluta: o time da Olímpia mediu que a mesma versão
 * recebe notas variando ±1,4 no MESMO cenário. Com esse ruído, uma diferença de
 * 0,3 na média entre duas versões não significa nada — e foi assim que decisões
 * de prompt vinham sendo tomadas. "Qual das duas é melhor?" é uma pergunta que
 * um juiz responde com muito menos variância do que "quão boa é esta?".
 *
 * Três defesas contra o juiz se enganar sozinho:
 *  1. Três LENTES independentes (a mesma conversa julgada por critérios
 *     diferentes), com maioria simples — número ímpar de propósito.
 *  2. POSIÇÃO EMBARALHADA por (cenário, lente): LLM tem viés pela primeira
 *     opção, e mostrar sempre A primeiro transformaria esse viés em resultado.
 *  3. O juiz responde 'primeiro'/'segundo' — ele nunca sabe qual versão é qual.
 *     O desembaralhamento é feito aqui, por código puro e testado.
 *
 * A promoção é por VITÓRIAS EM CENÁRIOS, não por média de nada.
 */

import { chat } from '../llm';
import { createLogger } from '../logger';
import { withRetry, type GymTurn, type ProspectPersona } from './gym';

const log = createLogger('gym-paired');

export interface PairedLens {
  key: string;
  /** O que este juiz deve olhar. Vai literal no prompt. */
  pergunta: string;
}

/**
 * As três lentes. Diversidade é o ponto: três juízes com o MESMO critério são
 * um juiz caro; com critérios diferentes, um pega o que o outro não vê.
 */
export const PAIRED_LENSES: PairedLens[] = [
  {
    key: 'naturalidade',
    pergunta:
      'Qual das duas soa mais como uma PESSOA escrevendo no WhatsApp, e menos como robô corporativo? ' +
      'Considere: tamanho da mensagem, uma pergunta por vez, calor sem bajulação, português falado do Brasil.',
  },
  {
    key: 'conducao',
    pergunta:
      'Qual das duas conduz melhor a conversa para um próximo passo concreto, RESPEITANDO o ritmo do ' +
      'interlocutor? Insistir com quem já disse não, ou repetir pergunta já respondida, é conduzir MAL. ' +
      'Parar na hora certa conta como boa condução.',
  },
  {
    key: 'correcao',
    // A lente que existe por causa de 28/jul: a Vitória ping-pongou com um menu
    // automático e mandou "(sem resposta)" nove vezes. Nota de simpatia não
    // enxerga isso; uma lente que pergunta "o que ela NÃO devia ter feito" sim.
    pergunta:
      'Qual das duas comete MENOS erros graves? Erros graves são: citar preço ou valor, prometer prazo ' +
      'do número +55, não se apresentar como assistente digital, conversar com atendimento automático em ' +
      'vez de parar, mandar mensagem vazia ou de conteúdo inútil, inventar número/cliente/funcionalidade, ' +
      'prescrever produto ou dose. Se uma delas comete um erro grave e a outra não, a outra vence.',
  },
];

/** FNV-1a — barato e determinístico; não precisa ser criptográfico. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Se a versão B deve ser mostrada PRIMEIRO para esta dupla (cenário, lente).
 *
 * Determinístico de propósito: sorteio tornaria a suíte irreprodutível, e o que
 * se quer não é aleatoriedade — é que o viés de posição não caia sempre do
 * mesmo lado.
 *
 * O cenário decide de que lado a alternância COMEÇA; o índice da lente
 * alterna a partir dali. Hashear "cenário:lente" direto foi a primeira
 * tentativa e o teste derrubou: em 'dono_ocupado' as três lentes caíram do
 * mesmo lado por azar, e aí o viés de posição não é cancelado DENTRO daquele
 * cenário. Hash espalha em média; alternância por índice garante.
 */
export function posicaoTrocada(cenario: string, lente: string): boolean {
  const idx = PAIRED_LENSES.findIndex((l) => l.key === lente);
  // Lente desconhecida (uso fora da lista): cai no hash do próprio nome.
  const passo = idx >= 0 ? idx : hash(lente);
  return ((hash(cenario) & 1) + passo) % 2 === 1;
}

export type Posicao = 'primeiro' | 'segundo' | 'empate';
export type Vencedor = 'A' | 'B' | 'empate';

/**
 * Traduz a resposta posicional do juiz na versão que ela realmente indica.
 *
 * É a função mais perigosa do arquivo: um erro aqui inverte toda a conclusão
 * do experimento sem que nada quebre. Qualquer coisa fora do contrato vira
 * empate — jamais uma vitória inventada.
 */
export function resolverVoto(posicao: Posicao, trocada: boolean): Vencedor {
  if (posicao === 'primeiro') return trocada ? 'B' : 'A';
  if (posicao === 'segundo') return trocada ? 'A' : 'B';
  return 'empate';
}

export interface LensVote {
  lente: string;
  vencedor: Vencedor;
  motivo: string;
}

/** Maioria simples entre as lentes. Empate não vota em ninguém. */
export function apurarLentes(votos: LensVote[]): Vencedor {
  const a = votos.filter((v) => v.vencedor === 'A').length;
  const b = votos.filter((v) => v.vencedor === 'B').length;
  const maioria = Math.floor(votos.length / 2) + 1;
  if (a >= maioria) return 'A';
  if (b >= maioria) return 'B';
  return 'empate';
}

export interface ScenarioResult {
  persona: string;
  vencedor: Vencedor;
  votos: LensVote[];
}

export interface PairedTally {
  a: number;
  b: number;
  empates: number;
  total: number;
  vencedor: Vencedor;
}

/**
 * Placar final: quantos CENÁRIOS cada versão venceu. Deliberadamente não é
 * média de nota — média esconde que uma versão ganhou muito num cenário e
 * perdeu pouco em três.
 */
export function apurarCenarios(resultados: ScenarioResult[]): PairedTally {
  const a = resultados.filter((r) => r.vencedor === 'A').length;
  const b = resultados.filter((r) => r.vencedor === 'B').length;
  const empates = resultados.length - a - b;
  const vencedor: Vencedor = a > b ? 'A' : b > a ? 'B' : 'empate';
  return { a, b, empates, total: resultados.length, vencedor };
}

// ── Pareamento de duas rodadas ───────────────────────────────────────────────

export interface ParPersona {
  persona: string;
  a: GymTurn[];
  b: GymTurn[];
}

/**
 * Casa duas rodadas do gym persona a persona. Só compara o que existe nos DOIS
 * lados — uma persona presente só numa rodada não tem contra o que ser julgada,
 * e incluí-la enviesaria o placar a favor de quem a tem.
 *
 * A ordem da rodada A é preservada para o relatório ficar estável entre
 * execuções.
 */
export function parearCenarios(
  runA: Array<{ persona: string; transcript: GymTurn[] }>,
  runB: Array<{ persona: string; transcript: GymTurn[] }>
): ParPersona[] {
  const porChave = new Map(runB.map((v) => [v.persona, v.transcript]));
  return runA
    .filter((v) => porChave.has(v.persona))
    .map((v) => ({ persona: v.persona, a: v.transcript, b: porChave.get(v.persona) as GymTurn[] }));
}

// ── Chamada ao juiz ──────────────────────────────────────────────────────────

const JUDGE_SYSTEM =
  'Você compara DUAS conversas de prospecção B2B por WhatsApp (agro, Brasil). São a MESMA situação, ' +
  'conduzida por duas versões da mesma assistente ("Vitória", da Stevi). Julgue SÓ as mensagens dela.\n' +
  'A PRIMEIRA mensagem de cada transcrição é um template fixo aprovado pela Meta, idêntico nas duas — ' +
  'ignore-a na comparação.\n' +
  'Responda SÓ JSON: {"vencedor":"primeiro"|"segundo"|"empate","motivo":"1 frase em pt-BR"}. ' +
  'Use "empate" só quando forem realmente equivalentes na lente pedida — empate por preguiça não ajuda ninguém.';

const render = (t: GymTurn[]): string =>
  t.map((x) => `${x.role === 'vitoria' ? 'VITÓRIA' : 'PROSPECT'}: ${x.text}`).join('\n');

/**
 * Julga um cenário nas três lentes. `a` e `b` são transcrições da MESMA persona
 * geradas por versões diferentes do prompt.
 */
export async function judgePaired(
  persona: ProspectPersona,
  a: GymTurn[],
  b: GymTurn[]
): Promise<ScenarioResult> {
  const votos: LensVote[] = [];

  for (const lente of PAIRED_LENSES) {
    const trocada = posicaoTrocada(persona.key, lente.key);
    const primeira = trocada ? b : a;
    const segunda = trocada ? a : b;
    try {
      const raw = await withRetry(`judge-paired:${lente.key}`, () =>
        chat({
          // Cross-family: um juiz da mesma família que escreveu a resposta
          // abençoa o próprio estilo (mesma disciplina do juiz absoluto).
          model: process.env.ROCA_JUDGE_MODEL || 'google/gemini-2.5-flash',
          maxTokens: 200,
          system: JUDGE_SYSTEM,
          user:
            `Cenário: ${persona.label} — ${persona.brief}\n\n` +
            `LENTE — ${lente.pergunta}\n\n` +
            `=== CONVERSA PRIMEIRO ===\n${render(primeira)}\n\n` +
            `=== CONVERSA SEGUNDO ===\n${render(segunda)}`,
        })
      );
      const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as {
        vencedor?: string;
        motivo?: string;
      };
      votos.push({
        lente: lente.key,
        vencedor: resolverVoto(json.vencedor as Posicao, trocada),
        motivo: json.motivo ?? '',
      });
    } catch (e) {
      // Juiz que falhou não vota. Contar como empate é honesto; chutar não.
      log.error(`paired judge failed (${persona.key}/${lente.key}):`, (e as Error).message);
      votos.push({ lente: lente.key, vencedor: 'empate', motivo: 'juiz falhou' });
    }
  }

  return { persona: persona.key, vencedor: apurarLentes(votos), votos };
}

// ── Runner ───────────────────────────────────────────────────────────────────

export interface PairedRun {
  resultados: ScenarioResult[];
  placar: PairedTally;
  /** Personas que só existiam numa das rodadas — ficaram de fora do placar. */
  ignoradas: string[];
}

/**
 * Compara duas rodadas do gym. Cada persona presente nas duas é julgada nas
 * três lentes; o placar é por cenários vencidos.
 *
 * `ignoradas` é reportado de propósito: um placar de 4×2 significa uma coisa
 * quando são 6 personas e outra bem diferente quando eram 14 e 8 não casaram.
 * Truncamento silencioso lê como cobertura total.
 */
export async function runPairedGym(
  runA: Array<{ persona: string; transcript: GymTurn[] }>,
  runB: Array<{ persona: string; transcript: GymTurn[] }>,
  personas: ProspectPersona[]
): Promise<PairedRun> {
  const pares = parearCenarios(runA, runB);
  const casadas = new Set(pares.map((p) => p.persona));
  const ignoradas = [...new Set([...runA, ...runB].map((v) => v.persona))].filter((k) => !casadas.has(k));

  const resultados: ScenarioResult[] = [];
  for (const par of pares) {
    const persona = personas.find((p) => p.key === par.persona);
    if (!persona) {
      ignoradas.push(par.persona); // persona sumiu do código desde a rodada
      continue;
    }
    log.info(`judging paired: ${par.persona}`);
    resultados.push(await judgePaired(persona, par.a, par.b));
  }

  return { resultados, placar: apurarCenarios(resultados), ignoradas };
}
