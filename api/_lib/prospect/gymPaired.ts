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
      'Parar na hora certa conta como boa condução. ' +
      // Em 30/jul ele acusou "repete a mesma pergunta já respondida" no cenário
      // monossilabico, onde as quatro perguntas dela são verificavelmente
      // diferentes. Exigir a citação não impede alucinar — mas deixa visível,
      // porque a frase citada ou está na transcrição ou não está.
      'Se disser que houve pergunta repetida, CITE a pergunta entre aspas, copiada da transcrição.',
  },
  {
    key: 'correcao',
    // A lente que existe por causa de 28/jul: a Vitória ping-pongou com um menu
    // automático e mandou "(sem resposta)" nove vezes. Nota de simpatia não
    // enxerga isso; uma lente que pergunta "o que ela NÃO devia ter feito" sim.
    pergunta:
      'Qual das duas comete MENOS erros graves? Erros graves são: citar preço ou valor; prometer prazo ' +
      'de resposta do fundador; OMITIR a apresentação como assistente digital na primeira mensagem que ' +
      'ELA escreve; continuar conversando com atendimento automático em vez de parar; mandar mensagem ' +
      'vazia, repetida ou de conteúdo inútil; inventar número, cliente ou funcionalidade.\n' +
      // Duas vezes em 30/jul o juiz inverteu a polaridade e chamou de erro grave
      // ela SE APRESENTAR como IA — a nossa regra zero. A regra estava escrita
      // como negação ("não se apresentar...") dentro de uma lista de violações,
      // e regra que depende de o leitor não perder o "não" é regra frágil.
      // Agora é afirmação explícita, fora da lista.
      'ATENÇÃO: apresentar-se como assistente digital / IA é OBRIGATÓRIO e NUNCA é erro — se ela diz ' +
      'que é uma IA, isso é ACERTO. O erro é o contrário: esconder.\n' +
      // "prescrever produto ou dose" estava nesta lista e é regra do Stevi que
      // fala com produtor sobre agronomia. A Vitória fala de parceria e não tem
      // como prescrever nada; cobrar isso fez o juiz escrever que agendar uma
      // reunião "caracteriza prescrever produto ou dose — neste caso, a dose é
      // o agendamento". Regra do domínio errado não é rigor, é ruído.
      'NÃO invente regras fora desta lista, e não aplique a esta conversa regras de recomendação ' +
      'agronômica: ela negocia parceria, não dá recomendação técnica.\n' +
      'Se uma delas comete um erro grave e a outra não, a outra vence.',
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
 * Margem mínima de cenários para declarar um vencedor.
 *
 * Medido, não chutado. Em 30/jul rodei o pareado com o MESMO código da Vitória
 * dos dois lados (fbf23a32 vs 457a19f4) e saiu:
 *
 *     B 5 × 6 A · 3 empates  →  "❌ a rodada ANTIGA era melhor — reverta"
 *
 * Um veredito de reversão para uma mudança que não existe. Margem 1 é o que o
 * instrumento produz sozinho; declarar vencedor aí é gerar decisão aleatória
 * com cara de conclusão — e duas vezes nesse dia esse veredito quase me fez
 * reverter trabalho que a medição depois mostrou bom.
 *
 * 3 é conservador de propósito. UMA amostra de controle prova que margem 1
 * acontece com código idêntico, mas não diz onde fica o limiar de verdade.
 * Com 3-4 controles isto vira calibragem; até lá, é prudência explícita.
 */
export const MARGEM_MINIMA = 3;

/**
 * Placar final: quantos CENÁRIOS cada versão venceu. Deliberadamente não é
 * média de nota — média esconde que uma versão ganhou muito num cenário e
 * perdeu pouco em três.
 *
 * A contagem sai sempre exata; o piso mexe SÓ no veredito. Esconder os números
 * seria trocar um veredito ruim por cegueira — quem lê precisa ver o 6×5 e
 * decidir por si. O que o piso impede é chamarem isso de vitória.
 */
export function apurarCenarios(resultados: ScenarioResult[]): PairedTally {
  const a = resultados.filter((r) => r.vencedor === 'A').length;
  const b = resultados.filter((r) => r.vencedor === 'B').length;
  const empates = resultados.length - a - b;
  const vencedor: Vencedor = Math.abs(a - b) < MARGEM_MINIMA ? 'empate' : a > b ? 'A' : 'B';
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

/**
 * Orçamento de tokens do juiz. Era 200, e duas das 42 lentes de 30/jul voltaram
 * "juiz falhou" com "Unexpected end of JSON input" — assinatura de JSON cortado,
 * não de flake. Mesmo defeito que derrubou o buildAgentReply em 29/jul com 400:
 * o modelo gasta tokens antes do texto final, e o gate de parse transforma isso
 * em ausência silenciosa. Com a citação agora exigida na lente de condução, o
 * `motivo` ficou maior ainda. Cap não é cobrança: só se paga o que for gerado.
 */
export const JUDGE_MAX_TOKENS = 500;

export const JUDGE_SYSTEM =
  'Você compara DUAS conversas de prospecção B2B por WhatsApp (agro, Brasil). São a MESMA situação, ' +
  'conduzida por duas versões da mesma assistente ("Vitória", da Stevi). Julgue SÓ as mensagens dela.\n' +
  'A PRIMEIRA mensagem de cada transcrição é um template fixo aprovado pela Meta, idêntico nas duas — ' +
  'ignore-a na comparação. Ela não o escreveu e não pode mudá-lo.\n' +
  // Sem isto o juiz cobra disclosure "logo de cara" e pune o template, que é
  // justamente o que ela não controla. O absoluto (gym.ts) já dizia; o pareado
  // não, e a assimetria explica duas lentes erradas em 30/jul.
  'Por isso, a regra de se apresentar como assistente digital vale para a PRIMEIRA MENSAGEM QUE ELA ' +
  'GERA — ou seja, a SEGUNDA mensagem dela na transcrição. O template não declarar IA não é falha dela.\n' +
  'Responda SÓ JSON: {"vencedor":"primeiro"|"segundo"|"empate","motivo":"1 frase em pt-BR"}. ' +
  'Use "empate" só quando forem realmente equivalentes na lente pedida — empate por preguiça não ajuda ninguém.';

// Anotações do harness ficam FORA do que o juiz lê. Em 29/jul ele leu
// "[porteiro-esgotado]" como "mensagem vazia ou de conteúdo inútil" e penalizou
// justamente a versão que parqueou o lead do jeito certo — a medição virou
// artefato da instrumentação.
const render = (t: GymTurn[]): string =>
  t
    .filter((x) => !x.meta)
    .map((x) => `${x.role === 'vitoria' ? 'VITÓRIA' : 'PROSPECT'}: ${x.text}`)
    .join('\n');

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
          maxTokens: JUDGE_MAX_TOKENS,
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

/**
 * Persiste a rodada pareada em prospect_gym_paired_runs (painel → Treino).
 *
 * Até 30/jul o placar que decidia promover/reverter prompt só existia no
 * terminal de quem rodou; o painel mostrava apenas o gym absoluto. Fail-soft:
 * uma falha aqui não pode derrubar um julgamento que já custou ~40 chamadas
 * de LLM — o placar impresso continua valendo, e o erro fica no log.
 */
export async function savePairedRun(
  db: { from: (t: string) => { insert: (row: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }> } },
  runAId: string,
  runBId: string,
  r: PairedRun
): Promise<boolean> {
  const { error } = await db.from('prospect_gym_paired_runs').insert({
    run_a: runAId,
    run_b: runBId,
    placar: r.placar,
    resultados: r.resultados,
  });
  if (error) log.error('savePairedRun failed:', error.message);
  return !error;
}

// ── Seleção do par a comparar ───────────────────────────────────────────────

/** O mínimo que uma rodada precisa expor para entrar (ou não) numa comparação. */
export interface RodadaComparavel {
  id: string;
  ran_at: string;
  medias?: { invalida?: string } | null;
}

/**
 * Motivo pelo qual a rodada não serve de base de comparação, ou null.
 *
 * 29/jul o gym rodou sem crédito: nenhuma conversa, nenhum juízo, linha gravada
 * com zeros. Carimbei `medias.invalida` — isto é o que lê o carimbo.
 */
export function rodadaInvalida(r: RodadaComparavel): string | null {
  const motivo = r.medias?.invalida;
  return typeof motivo === 'string' && motivo.trim() ? motivo : null;
}

/**
 * Escolhe o par a comparar: A = a mais ANTIGA (antes), B = a mais NOVA (depois).
 * Inválidas nunca entram — nem quando pedidas pelo id, porque comparar contra
 * uma rodada onde nada rodou não fica válido só porque alguém digitou o id. Um
 * placar contra o vazio é pior que placar nenhum: parece resposta.
 */
export function escolherPar<T extends RodadaComparavel>(rodadas: T[]): [T, T] {
  const invalidas = rodadas.filter((r) => rodadaInvalida(r));
  const validas = rodadas
    .filter((r) => !rodadaInvalida(r))
    .sort((x, y) => Date.parse(y.ran_at) - Date.parse(x.ran_at)) // recentes primeiro
    .slice(0, 2)
    .sort((x, y) => Date.parse(x.ran_at) - Date.parse(y.ran_at)); // A = antes

  if (validas.length < 2) {
    const descarte = invalidas.map((r) => `${r.id} (${rodadaInvalida(r)})`).join('; ');
    throw new Error(
      `preciso de 2 rodadas válidas pra comparar, achei ${validas.length}` +
        (descarte ? ` — descartei como inválida: ${descarte}` : '')
    );
  }
  return [validas[0], validas[1]];
}
