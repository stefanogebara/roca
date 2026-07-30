/**
 * O detector de repetição, medido contra o que o juiz realmente vê.
 *
 * 30/jul: `repeticaoNossa` disparou 0 vezes em 20 turnos crus (rodada c170efec,
 * pré-gate) — justamente a rodada onde o juiz pareado disse "repete perguntas e
 * adiciona steps". Fui ler o transcript e não havia pergunta repetida ao pé da
 * letra em lugar nenhum. Dois motivos:
 *
 * 1. Jaccard sobre a MENSAGEM INTEIRA dilui a pergunta. As mensagens dela têm
 *    150-200 chars — contexto, calor humano e a pergunta no fim. Duas mensagens
 *    com a MESMA pergunta e contexto diferente ficam longe de 0,7, porque a
 *    união inclui todo o resto.
 * 2. Conjunto simétrico pune assimetria de tamanho: repetir a pergunta com
 *    palavras a mais faz a união crescer e a similaridade cair.
 *
 * E o que o juiz chama de "repetir" inclui uma coisa que o detector nem olhava:
 * mandar DUAS perguntas numa mensagem (7% das 125 mensagens medidas), violando
 * a regra "no máximo uma pergunta" que o prompt já mandava sem gate nenhum.
 *
 * O acoplamento perigoso: com o detector disparando mais, a segunda reincidência
 * virava `silencio deliberado`, e diante de gente resolverSilencio converte isso
 * na DESPEDIDA ("não vou insistir") — exatamente o "erro grave" que o juiz
 * pareado marcou em quer-fechar-agora. "Não tenho pergunta nova" e "ele não quer
 * falar comigo" estavam na mesma ação. Não estão mais.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api/_lib/llm', () => ({ chat: vi.fn(), chatDetailed: vi.fn() }));
vi.mock('../api/_lib/prospect/learn', () => ({
  loadPlaybook: vi.fn().mockResolvedValue([]),
  playbookBlock: vi.fn().mockReturnValue(''),
}));

import { chatDetailed } from '../api/_lib/llm';
import {
  perguntas,
  perguntasDemais,
  repeticaoNossa,
  buildAgentReply,
  jaSeDespediu,
  resolverSilencio,
} from '../api/_lib/prospect/agent';

const nossa = (text: string) => ({ direction: 'out' as const, text });
const dele = (text: string) => ({ direction: 'in' as const, text });

describe('perguntas — a pergunta é a unidade que o juiz julga', () => {
  it('separa cada pergunta da mensagem', () => {
    expect(perguntas('Perfeito, anotado! Vocês atendem quais municípios? E manhã ou tarde?')).toEqual([
      'Vocês atendem quais municípios?',
      'E manhã ou tarde?',
    ]);
  });

  it('ignora o texto solto depois da última pergunta', () => {
    expect(perguntas('Faz sentido pra vocês? Obrigada!')).toEqual(['Faz sentido pra vocês?']);
  });

  it('mensagem sem pergunta não tem pergunta', () => {
    expect(perguntas('Vou passar pro Stefano organizar o piloto.')).toEqual([]);
  });
});

describe('perguntasDemais — a regra existia no prompt e não tinha gate', () => {
  it('duas perguntas numa mensagem é demais', () => {
    // Turno 9 real da rodada 6b592ecf, agronomo-sobrecarregado.
    expect(
      perguntasDemais(
        'Só uma coisa pra alinhar o formato: vocês prefeririam por lead atendido ou mensalidade fixa? ' +
          'E vale uma conversa de 15 min com o Stefano — qual dia costuma ser melhor pra vocês?'
      )
    ).toBe(true);
  });

  it('uma pergunta é o certo', () => {
    expect(perguntasDemais('Hoje como chega cliente novo pra vocês?')).toBe(false);
  });

  it('nenhuma pergunta também é válido — nem todo turno pergunta', () => {
    expect(perguntasDemais('Perfeito, anotado. Já passo pro Stefano.')).toBe(false);
  });
});

describe('repeticaoNossa — comparar pergunta com pergunta', () => {
  const Q = 'Hoje como chega cliente novo pra vocês, indicação ou vem procurar?';

  it('pega a pergunta idêntica', () => {
    expect(repeticaoNossa([nossa(Q)], Q)).toBe(true);
  });

  it('pega a MESMA pergunta com contexto diferente em volta — o caso que passava batido', () => {
    const antes = `Boa pergunta, isso varia caso a caso. ${Q}`;
    const agora = `Entendi, faz sentido. Deixa eu voltar num ponto: ${Q}`;
    expect(repeticaoNossa([nossa(antes)], agora)).toBe(true);
  });

  it('pega a pergunta repetida com palavras a mais', () => {
    expect(
      repeticaoNossa([nossa(Q)], 'Hoje como chega cliente novo pra vocês hoje em dia, por indicação ou vem procurar?')
    ).toBe(true);
  });

  it('NÃO acusa perguntas diferentes que dividem vocabulário', () => {
    expect(
      repeticaoNossa([nossa('Hoje como chega cliente novo pra vocês?')], 'Vocês aceitariam receber cliente já triado?')
    ).toBe(false);
  });

  it('NÃO acusa avanço legítimo depois de uma resposta', () => {
    expect(
      repeticaoNossa(
        [nossa('Vocês atendem em quais municípios e culturas?'), dele('Três Corações, Varginha. Café e milho.')],
        'Perfeito, anotado! Qual dia da semana costuma ser melhor pra vocês?'
      )
    ).toBe(false);
  });

  it('não compara com o que ELE disse — repetir o prospect não é o defeito', () => {
    expect(repeticaoNossa([dele(Q)], Q)).toBe(false);
  });

  it('mensagem sem pergunta não repete pergunta nenhuma', () => {
    expect(repeticaoNossa([nossa(Q)], 'Perfeito, já passo pro Stefano.')).toBe(false);
  });

  it('não dispara com pergunta curta demais pra distinguir', () => {
    expect(repeticaoNossa([nossa('E hoje?')], 'E hoje?')).toBe(false);
  });
});

describe('segunda reincidência NUNCA vira despedida', () => {
  const Q = 'Hoje como chega cliente novo pra vocês, indicação ou vem procurar?';
  const thread = [nossa(`Deixa eu entender: ${Q}`), dele('Depende, mas é bem misto por aqui.')];

  beforeEach(() => vi.clearAllMocks());

  it('repetindo duas vezes, ela MANDA a segunda tentativa em vez de se despedir', async () => {
    // Modelo teimoso: repete a pergunta nas duas vezes.
    vi.mocked(chatDetailed).mockResolvedValue({ text: `Voltando: ${Q}`, finishReason: 'stop' });

    const acao = await buildAgentReply('Consultoria Rocha', thread, 'e aí?', { robo: false, tentativa: 0 });

    // Pergunta meio repetida custa pouco. Despedida com prospect vivo é o "erro
    // grave" que o juiz mediu — nunca é o preço certo a pagar.
    expect(acao.tipo).toBe('responder');
    if (acao.tipo === 'responder') expect(acao.texto).not.toMatch(/n[ãa]o vou insistir/i);
    expect(chatDetailed).toHaveBeenCalledTimes(2); // uma retentativa, não mais
  });

  it('se a segunda tentativa avança, é ela que vai', async () => {
    vi.mocked(chatDetailed)
      .mockResolvedValueOnce({ text: `Voltando: ${Q}`, finishReason: 'stop' })
      .mockResolvedValueOnce({ text: 'Perfeito! Qual dia costuma ser melhor pra vocês?', finishReason: 'stop' });

    const acao = await buildAgentReply('Consultoria Rocha', thread, 'e aí?', { robo: false, tentativa: 0 });
    expect(acao).toEqual({ tipo: 'responder', texto: 'Perfeito! Qual dia costuma ser melhor pra vocês?' });
  });

  it('duas perguntas numa mensagem também aciona a correção', async () => {
    vi.mocked(chatDetailed)
      .mockResolvedValueOnce({ text: 'Prefere por lead ou mensalidade? E qual dia é melhor?', finishReason: 'stop' })
      .mockResolvedValueOnce({ text: 'Prefere por lead ou mensalidade fixa?', finishReason: 'stop' });

    const acao = await buildAgentReply('Consultoria Rocha', thread, 'e aí?', { robo: false, tentativa: 0 });
    expect(acao).toEqual({ tipo: 'responder', texto: 'Prefere por lead ou mensalidade fixa?' });
    expect(chatDetailed).toHaveBeenCalledTimes(2);
  });
});

/**
 * O falso positivo que a medição nos 125 turnos reais entregou.
 *
 * "Faz sentido pra vocês?" são 4 palavras, três delas a própria fórmula. O
 * coeficiente de sobreposição divide pelo conjunto MENOR, então essa fórmula
 * casava 0,75 com qualquer pergunta maior que a contivesse — inclusive uma
 * pergunta genuinamente nova. Repetição de verdade veio sempre com tamanhos
 * parecidos (13 vs 14 palavras, 10 vs 11).
 */
describe('repeticaoNossa — fórmula curta não é repetição', () => {
  it('não confunde "faz sentido pra vocês?" com uma pergunta nova que a contém', () => {
    // Caso literal da rodada e4f364ca, coop-quer-nao-perder-produtor.
    expect(
      repeticaoNossa(
        [nossa('Legal! Faz sentido pra vocês?')],
        'Faz sentido eu marcar uma conversa rápida com o Stefano pra ele explicar como funciona esse direcionamento por região?'
      )
    ).toBe(false);
  });

  it('mas ainda pega a mesma pergunta reformulada, que é do mesmo tamanho', () => {
    // Caso literal da rodada 6b592ecf, manda-material.
    expect(
      repeticaoNossa(
        [nossa('Hoje, como costuma chegar cliente novo pra vocês — mais indicação, redes sociais, ou outro canal?')],
        'hoje como costuma chegar cliente novo pra vocês — indicação, redes sociais, outro canal?'
      )
    ).toBe(true);
  });

  it('e pega "que dia" virando "qual dia" — troca de palavra não é assunto novo', () => {
    // Caso literal da rodada c170efec, coop-quer-nao-perder-produtor.
    expect(
      repeticaoNossa(
        [nossa('Que dia da semana costuma ser melhor pra vocês, manhã ou tarde?')],
        'qual dia da semana costuma ser melhor pra vocês, e prefere manhã ou tarde?'
      )
    ).toBe(true);
  });
});

/**
 * Os dois defeitos que o gym das 14 personas entregou, em sem-interesse.
 *
 * Turnos 5 e 7 da rodada 24acf8c3 são a MESMA despedida, palavra por palavra:
 *   "Tudo bem, Consultoria Pinheiro, não vou insistir. 🌱 Fico à disposição…"
 *
 * Duas causas somadas:
 * 1. resolverSilencio devolve o mesmo texto canned toda vez que o modelo escolhe
 *    calar. Encerrar uma vez é digno; encerrar duas é defeito.
 * 2. Eu estreitei o detector para PERGUNTAS no commit anterior — e despedida não
 *    tem "?". `perguntas()` devolve [], então nada barrava. O Jaccard antigo,
 *    sobre a mensagem inteira, pegaria isso (texto idêntico = 1,0). Consertei
 *    diluição e perdi cobertura de mensagem repetida sem pergunta.
 */
describe('mensagem quase idêntica também é repetição, mesmo sem pergunta', () => {
  const DESP = 'Tudo bem, Consultoria Pinheiro, não vou insistir. 🌱 Fico à disposição por aqui se um dia fizer sentido receber produtores da região.';

  it('pega a despedida repetida palavra por palavra — o caso real do gym', () => {
    expect(repeticaoNossa([nossa(DESP)], DESP)).toBe(true);
  });

  it('pega a mesma mensagem com uma variação mínima', () => {
    expect(repeticaoNossa([nossa(DESP)], DESP.replace('Tudo bem', 'Beleza'))).toBe(true);
  });

  it('NÃO acusa duas mensagens diferentes que dividem vocabulário', () => {
    expect(
      repeticaoNossa(
        [nossa('Vou passar pro Stefano organizar o piloto com vocês.')],
        'Perfeito, anotado. O Stefano confirma o piloto direto com você.'
      )
    ).toBe(false);
  });

  it('não acusa quando foi ELE que repetiu', () => {
    expect(repeticaoNossa([dele(DESP)], DESP)).toBe(false);
  });
});

describe('jaSeDespediu / resolverSilencio — encerrar é uma vez só', () => {
  const DESP = 'Tudo bem, Coop, não vou insistir. 🌱 Fico à disposição por aqui.';
  const silencio = { tipo: 'silencio' as const, motivo: 'o agente escolheu não responder', deliberado: true };

  it('reconhece que a despedida já foi mandada', () => {
    expect(jaSeDespediu([nossa(DESP), dele('Valeu, sucesso aí.')])).toBe(true);
  });

  it('não confunde conversa normal com despedida', () => {
    expect(jaSeDespediu([nossa('Hoje como chega cliente novo pra vocês?')])).toBe(false);
  });

  it('não conta despedida DELE como nossa', () => {
    expect(jaSeDespediu([dele('Valeu, não vou insistir mais nisso, abraço.')])).toBe(false);
  });

  it('já despedida, silêncio vira silêncio DE VERDADE — não a mesma despedida de novo', () => {
    const a = resolverSilencio(silencio, { robo: false }, 'Coop', true);
    expect(a.tipo).toBe('silencio');
  });

  it('primeira vez, continua encerrando com dignidade — isso não regride', () => {
    const a = resolverSilencio(silencio, { robo: false }, 'Coop', false);
    expect(a.tipo).toBe('responder');
    if (a.tipo === 'responder') expect(a.texto).toMatch(/n[ãa]o vou insistir/i);
  });
});

describe('buildAgentReply — não manda a segunda despedida', () => {
  const DESP = 'Tudo bem, Consultoria Pinheiro, não vou insistir. 🌱 Fico à disposição por aqui.';

  beforeEach(() => vi.clearAllMocks());

  it('modelo cala e a despedida já foi: não sai mensagem nenhuma', async () => {
    vi.mocked(chatDetailed).mockResolvedValue({ text: 'SILENCIO', finishReason: 'stop' });
    const thread = [nossa(DESP), dele('Valeu, Vitória. Sucesso aí.')];

    const acao = await buildAgentReply('Consultoria Pinheiro', thread, 'Valeu, sucesso aí.', {
      robo: false,
      tentativa: 0,
    });

    expect(acao.tipo).toBe('silencio');
  });
});
