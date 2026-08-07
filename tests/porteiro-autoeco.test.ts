/**
 * O porteiro parqueava leads humanos porque a mensagem ecoava a SI MESMA.
 *
 * Diagnóstico de 05/ago, feito pelos logs de produção depois que a RT da Pró
 * Solo ficou sem resposta:
 *
 *   12:38  in  "Boa tarde ! Tudo bem ? Como podemos te ajudar ?"
 *   12:38  log  porteiro attempt 1/1
 *   12:39  in  "Meu nome é Nathállia , sou RT da Pro Solo"
 *   12:39  log  agent parked — porteiro esgotado
 *
 * As duas mensagens são humanas, e `pareceAutoAtendimento` acerta as duas
 * (verificado). Quem disparou foi a OUTRA metade do teste de robô:
 *
 *   const robo = pareceAutoAtendimento(texto) || ecoDeMaquina(thread, texto);
 *
 * `respondAsProspectAgent` gravava o inbound na thread ANTES de ler a thread.
 * Então `ecoDeMaquina` procurava a mensagem numa lista que já continha ela
 * mesma, achava, e concluía "a contraparte repetiu o que já tinha dito".
 *
 * O efeito é sistemático, não de borda: TODA primeira resposta com 40+ chars ou
 * 5+ palavras casa consigo mesma. Ou seja, quanto mais a pessoa escreve, mais
 * certo é ser tratada como robô — o oposto do sinal. Só respostas curtas ("É
 * comigo mesmo") escapavam, por ficarem abaixo do piso.
 *
 * Que a thread NÃO deve conter a mensagem atual já estava dito no próprio
 * arquivo, três linhas abaixo: `extractQualification([...thread, {in, texto}])`
 * anexa o inbound à mão. Se a thread já o tivesse, ele entraria duas vezes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * O mock imita o BANCO, não um retorno fixo: `logProspectMessage` grava e
 * `getProspectThread` devolve o que está gravado. Sem isso o teste não
 * discrimina — foi o que aconteceu na primeira versão deste arquivo, em que
 * três casos passaram ANTES do conserto porque a thread mockada nunca continha
 * a mensagem atual. Um mock que não reproduz a ordem real esconde exatamente o
 * bug que se quer pegar.
 */
const linhas: Array<{ direction: string; text: string; created_at: string }> = [];

vi.mock('../api/_lib/prospect/db', () => ({
  // Reivindicação atômica do turno (07/ago): sem o mock ela vem undefined e
  // o fluxo quebra. Sempre `true` aqui — a corrida em si tem teste próprio
  // em turno-atomico.test.ts, com um banco simulado de verdade.
  claimAgentTurn: vi.fn(async () => true),
  logProspectMessage: vi.fn(async (_id: string, direction: string, _k: string, text: string) => {
    linhas.push({ direction, text, created_at: new Date().toISOString() });
  }),
  getProspectThread: vi.fn(async () => [...linhas]),
  mergeProspectQualification: vi.fn(async () => undefined),
  setProspectAgentEnabled: vi.fn(async () => undefined),
  bumpPorteiroTentativas: vi.fn(async () => undefined),
}));
vi.mock('../api/_lib/alert', () => ({ alertFounders: vi.fn() }));

import { respondAsProspectAgent } from '../api/_lib/prospect/inbound';
import {
  getProspectThread,
  logProspectMessage,
  bumpPorteiroTentativas,
  setProspectAgentEnabled,
} from '../api/_lib/prospect/db';

const PROSPECT = {
  id: 'p1',
  name: 'Pró Solo',
  porteiro_tentativas: 0,
  agent_enabled: true,
};

/** A thread REAL no momento do primeiro retorno: só o template que mandamos. */
const SO_O_TEMPLATE = [
  { direction: 'out', text: 'Oi! Falo com a Pró Solo? Aqui é a Vitória, da Stevi.', created_at: '2026-08-05T15:11:00Z' },
];

beforeEach(() => {
  vi.clearAllMocks();
  linhas.length = 0;
  for (const l of SO_O_TEMPLATE) linhas.push({ ...l });
});

describe('primeira resposta humana não é eco', () => {
  it('a saudação da Pró Solo não gasta tentativa do porteiro', async () => {
    await respondAsProspectAgent(PROSPECT as never, 'Boa tarde ! \nTudo bem ? \nComo podemos te ajudar ?', 'text');
    expect(bumpPorteiroTentativas).not.toHaveBeenCalled();
    expect(setProspectAgentEnabled).not.toHaveBeenCalled();
  });

  it('a apresentação da RT não parqueia o lead', async () => {
    await respondAsProspectAgent(PROSPECT as never, 'Meu nome é Nathállia , sou RT da Pro Solo', 'text');
    expect(setProspectAgentEnabled).not.toHaveBeenCalled();
  });

  it('quanto MAIS a pessoa escreve, menos robô ela deveria parecer', async () => {
    // O bug invertia isto: texto longo casava consigo mesmo e virava robô.
    await respondAsProspectAgent(
      PROSPECT as never,
      'Olá, boa tarde! Tudo joia? Hoje nós trabalhamos com sistemas de gestão de fazendas e monitoramento de frota agrícola.',
      'text'
    );
    expect(bumpPorteiroTentativas).not.toHaveBeenCalled();
  });

  it('a thread é lida SEM a mensagem atual', async () => {
    // A invariante que sustenta tudo acima, checada na ordem das chamadas: se
    // o log vier primeiro, a leitura traz a mensagem de volta e o eco renasce.
    await respondAsProspectAgent(PROSPECT as never, 'qualquer coisa com cinco palavras aqui', 'text');
    const ordemLog = vi.mocked(logProspectMessage).mock.invocationCallOrder[0];
    const ordemLeitura = vi.mocked(getProspectThread).mock.invocationCallOrder[0];
    expect(ordemLeitura).toBeLessThan(ordemLog);
  });

  it('eco DE VERDADE segue pego: a contraparte repete o que ela já disse', async () => {
    const repetida = 'Agradecemos seu contato, um de nossos atendentes falará com você em instantes.';
    // Ela JÁ tinha mandado isto antes; agora manda de novo. Este é o eco que o
    // guard existe para pegar, e ele tem que continuar pegando.
    linhas.push(
      { direction: 'in', text: repetida, created_at: '2026-08-05T15:20:00Z' },
      { direction: 'out', text: 'Consegue me passar o responsável técnico?', created_at: '2026-08-05T15:21:00Z' }
    );

    await respondAsProspectAgent({ ...PROSPECT, porteiro_tentativas: 0 } as never, repetida, 'text');
    expect(bumpPorteiroTentativas).toHaveBeenCalled();
  });
});
