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
  prometeuPrazo,
  recusou,
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
    const a = resolverSilencio(silencio, { robo: false }, 'Coop', { jaSeDespediu: true, recusou: true });
    expect(a.tipo).toBe('silencio');
  });

  it('primeira vez APÓS RECUSA, continua encerrando com dignidade — isso não regride', () => {
    // Contrato estreitado de propósito: antes bastava ser a primeira vez. O gym
    // mostrou que "primeira vez" incluía prospect animado, e ela se despedia de
    // quem estava dentro. Agora encerrar exige recusa.
    const a = resolverSilencio(silencio, { robo: false }, 'Coop', { jaSeDespediu: false, recusou: true });
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

/**
 * Os dois defeitos que o gym das 14 personas mostrou com a rubrica corrigida —
 * as duas acusações que eu conferi no transcript e que se sustentam.
 *
 * 1. PRAZO DO FUNDADOR. quer-fechar-agora, turno 7: "Vou chamar o Stefano […]
 *    já já ele te dá um retorno por aqui". Prometer quando um TERCEIRO responde
 *    é regra dura, e o commit e1011d4 existia pra matar isso — no prompt. Sem
 *    gate, "já já" passou por fora. Sétima vez no dia: a regra existe e não tem
 *    mecanismo.
 *
 * 2. A DESPEDIDA VIROU RESPOSTA UNIVERSAL. resolverSilencio devolve o mesmo
 *    "não vou insistir" para três situações diferentes: ele recusou, ele está
 *    animado, e ela não tem o que dizer. No mesmo cenário, turno 11, o prospect
 *    diz "fica ligado, qualquer coisa me chama! 👍" e ela responde "não vou
 *    insistir", como se ele tivesse recusado. Em sem-interesse ela encerra bem
 *    no turno 3 e encerra DE NOVO no turno 5, com texto diferente — a duplicata
 *    quase idêntica que eu tinha barrado não pega isso.
 *
 *    A regra que sobrevive aos dois casos: encerrar só quando a ÚLTIMA mensagem
 *    dele é recusa. "Tá bom, valeu" e "qualquer coisa me chama" não são recusa.
 */
describe('prometeuPrazo — destino sim, prazo não', () => {
  it('pega o caso real: "já já ele te dá um retorno"', () => {
    expect(
      prometeuPrazo('Vou chamar o Stefano pra ele falar direto com vocês. Obrigada pela abertura, já já ele te dá um retorno por aqui! 🌱')
    ).toBe(true);
  });

  it('pega as outras formas de prometer a agenda de terceiro', () => {
    for (const t of [
      'Em breve ele entra em contato com você',
      'Ele te responde ainda hoje',
      'Logo mais o Stefano te chama',
      'Em instantes ele retorna',
    ]) {
      expect(prometeuPrazo(t), t).toBe(true);
    }
  });

  it('NÃO acusa quando ela recusa dar prazo — que é o comportamento certo', () => {
    // Turno 5 real do mesmo cenário: ela faz exatamente a coisa certa.
    expect(prometeuPrazo('Entendi! Data eu não confirmo, isso é com o Stefano direto.')).toBe(false);
  });

  it('NÃO acusa o nosso próprio fallback de escalada', () => {
    expect(
      prometeuPrazo('Essa parte é com o Stefano (fundador) — já vou pedir pra ele te responder direto por aqui.')
    ).toBe(false);
  });

  it('NÃO acusa tempo que não é sobre resposta de ninguém', () => {
    expect(prometeuPrazo('A janela de pulverização abre logo mais na semana que vem.')).toBe(false);
  });
});

describe('recusou — o que autoriza encerrar', () => {
  it('reconhece a recusa explícita', () => {
    expect(recusou('Não tenho interesse, obrigado')).toBe(true);
    expect(recusou('não quero, valeu')).toBe(true);
  });

  it('NÃO trata acolhimento como recusa — foi assim que ela se despediu duas vezes', () => {
    expect(recusou('Tá bom, valeu.')).toBe(false);
  });

  it('NÃO trata prospect ENGAJADO como recusa — o erro do turno 11', () => {
    expect(recusou('Blz! Fica ligado que vou ficar atento no WhatsApp. Qualquer coisa me chama! 👍')).toBe(false);
  });
});

describe('resolverSilencio — encerrar só quando ele recusou', () => {
  const silencio = { tipo: 'silencio' as const, motivo: 'nada a dizer', deliberado: true };

  it('ele recusou: encerra com dignidade, como sempre fez', () => {
    const a = resolverSilencio(silencio, { robo: false }, 'Coop', { jaSeDespediu: false, recusou: true });
    expect(a.tipo).toBe('responder');
    if (a.tipo === 'responder') expect(a.texto).toMatch(/n[ãa]o vou insistir/i);
  });

  it('ele está engajado: silêncio de verdade, não despedida', () => {
    const a = resolverSilencio(silencio, { robo: false }, 'Coop', { jaSeDespediu: false, recusou: false });
    expect(a.tipo).toBe('silencio');
  });

  it('já encerrou antes: não encerra de novo nem depois de recusa', () => {
    const a = resolverSilencio(silencio, { robo: false }, 'Coop', { jaSeDespediu: true, recusou: true });
    expect(a.tipo).toBe('silencio');
  });
});
