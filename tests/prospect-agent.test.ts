import { describe, it, expect } from 'vitest';
import {
  needsEscalation,
  gateAgentReply,
  agentSystemPrompt,
  formatThreadBlock,
  isNonReply,
  interpretAgentOutput,
  pareceAutoAtendimento,
  ecoDeMaquina,
  porteiroEsgotado,
  podeFalarDeNovo,
  PORTEIRO_MAX,
} from '../api/_lib/prospect/agent';
import { parseVcards } from '../api/_lib/transport/vcard';

describe('needsEscalation', () => {
  it('escalates pricing negotiation', () => {
    for (const t of [
      'quanto custa por lead?',
      'qual o valor?',
      'quanto vocês cobram',
      'me manda a proposta de preço',
    ]) {
      expect(needsEscalation(t), t).toBe(true);
    }
  });
  it('escalates explicit human/founder asks and calls', () => {
    for (const t of ['quero falar com o Stefano', 'podemos fazer uma ligação?', 'me liga', 'prefiro falar com uma pessoa']) {
      expect(needsEscalation(t), t).toBe(true);
    }
  });
  it('escalates contract/legal asks', () => {
    expect(needsEscalation('vocês têm contrato de parceria?')).toBe(true);
  });
  it('does not escalate normal questions', () => {
    for (const t of ['como funciona a triagem?', 'atendo Varginha e Três Pontas', 'atenderia sim, em 12h']) {
      expect(needsEscalation(t), t).toBe(false);
    }
  });
});

describe('gateAgentReply', () => {
  it('blocks replies that state prices or commit terms', () => {
    expect(gateAgentReply('Custa R$ 50 por lead.').safe).toBe(false);
    expect(gateAgentReply('O valor é 30 reais por indicação.').safe).toBe(false);
    expect(gateAgentReply('Fechamos contrato de exclusividade.').safe).toBe(false);
  });
  it('replaces blocked replies with an honest handoff', () => {
    const g = gateAgentReply('Custa R$ 50 por lead.');
    expect(g.text).toMatch(/Stefano|fundador/i);
  });
  it('passes normal partnership talk', () => {
    const g = gateAgentReply(
      'Durante a validação os leads são gratuitos. Quais municípios você atende?'
    );
    expect(g.safe).toBe(true);
  });
});

describe('agentSystemPrompt', () => {
  const p = agentSystemPrompt('Olívia');
  it('carries the persona name, honesty rules and the 3-question mission', () => {
    expect(p).toContain('Olívia');
    expect(p).toMatch(/nunca invente/i);
    expect(p).toMatch(/indica[çc][ãa]o|cliente novo/i); // Q1
    expect(p).toMatch(/receitu[áa]rio/i); // Q2
    expect(p).toMatch(/formato|por lead/i); // Q3
    expect(p).toMatch(/UMA pergunta/i); // one question per message
  });
  it('forbids stating prices', () => {
    expect(p).toMatch(/pre[çc]o|valor/i);
  });
});

describe('formatThreadBlock', () => {
  it('renders labeled turns oldest-first', () => {
    const b = formatThreadBlock(
      [
        { direction: 'in', text: 'oi, como funciona?' },
        { direction: 'out', text: 'A Stevi faz triagem...' },
      ],
      'Olívia'
    );
    expect(b).toContain('Prospect: oi, como funciona?');
    expect(b).toContain('Olívia: A Stevi faz triagem...');
  });
});

describe('parseVcards', () => {
  const vcf = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:João da Silva',
    'TEL;TYPE=CELL:+55 35 99999-1234',
    'END:VCARD',
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:Maria Souza',
    'TEL:+5511988887777',
    'END:VCARD',
  ].join('\r\n');

  it('extracts names and phones from multi-card payloads', () => {
    const cards = parseVcards(vcf);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toEqual({ name: 'João da Silva', phones: ['+55 35 99999-1234'] });
    expect(cards[1].phones).toEqual(['+5511988887777']);
  });

  it('returns empty for junk', () => {
    expect(parseVcards('not a vcard')).toEqual([]);
  });
});

// 28/jul: a Agro.com respondeu com menu automático ("[1] Vendas [2] Financeiro").
// A Vitória tentou uma vez, o menu voltou igual, e o ping-pong rodou 2 minutos —
// 12 mensagens nossas, 9 delas o texto literal "(sem resposta)", que o próprio
// modelo gerou quando não tinha o que dizer e nós mandamos ao pé da letra.
describe('isNonReply — placeholder do modelo nunca vira mensagem', () => {
  it('pega o que queimou a gente', () => {
    expect(isNonReply('(sem resposta)')).toBe(true);
  });
  it('pega as variações de placeholder', () => {
    for (const t of ['', '   ', '[sem resposta]', '(nenhuma resposta)', '—', '...', '(silêncio)', '(sem retorno)']) {
      expect(isNonReply(t), JSON.stringify(t)).toBe(true);
    }
  });
  it('NÃO engole uma resposta curta de verdade', () => {
    for (const t of ['Perfeito, obrigada!', 'Claro! Te mando amanhã.', 'Sim', 'Combinado 🌱']) {
      expect(isNonReply(t), t).toBe(false);
    }
  });
});


// #1 do relatório da Olímpia: enquanto buildAgentReply devolver `string`, o
// silêncio é inexprimível — e o modelo, mandado "parar", escreve a palavra
// "silêncio" e nós enviamos. A correção é de TIPO, não de prompt: o retorno
// vira uma união onde não-responder é um caso legítimo.
describe('interpretAgentOutput — silêncio é um resultado, não um texto', () => {
  it('texto normal vira resposta', () => {
    const a = interpretAgentOutput('Claro! Te mando o exemplo hoje.', 'stop');
    expect(a).toEqual({ tipo: 'responder', texto: 'Claro! Te mando o exemplo hoje.' });
  });

  it('o sentinela SILENCIO vira silêncio, não mensagem', () => {
    for (const raw of ['SILENCIO', 'silencio', '  SILÊNCIO  ', 'SILENCIO.']) {
      expect(interpretAgentOutput(raw, 'stop').tipo, raw).toBe('silencio');
    }
  });

  it('resposta vazia vira silêncio em vez de mensagem em branco', () => {
    expect(interpretAgentOutput('', 'stop').tipo).toBe('silencio');
    expect(interpretAgentOutput('   ', 'stop').tipo).toBe('silencio');
  });

  it('placeholder do modelo vira silêncio — o bug de 28/jul', () => {
    const a = interpretAgentOutput('(sem resposta)', 'stop');
    expect(a.tipo).toBe('silencio');
    if (a.tipo === 'silencio') expect(a.motivo).toMatch(/placeholder/i);
  });

  it('resposta truncada NUNCA sai pela metade', () => {
    const a = interpretAgentOutput('Olha, o que a gente faz é receber a foto e', 'length');
    expect(a.tipo).toBe('silencio');
    if (a.tipo === 'silencio') expect(a.motivo).toMatch(/truncad/i);
  });

  it('texto que só CONTÉM a palavra silêncio segue sendo mensagem', () => {
    const a = interpretAgentOutput('Prefiro o silêncio a insistir — fico à disposição!', 'stop');
    expect(a.tipo).toBe('responder');
  });
});

// #2 do relatório da Olímpia — porteiro determinístico, em duas camadas.
describe('pareceAutoAtendimento — assinatura de atendedor automático', () => {
  it('pega o menu que nos travou hoje', () => {
    expect(pareceAutoAtendimento('Bem-vindo(a) à Agro.com!\n\nDigite a opção desejada:\n[ 1 ] - Vendas')).toBe(true);
  });
  it('pega as fórmulas institucionais mais comuns', () => {
    for (const t of [
      'Agradecemos o seu contato! Em breve retornaremos.',
      'Horários: seg a sex das 8h às 18h',
      'Estamos fechados no momento',
      'Digite 2 para falar com um atendente',
      'Sua solicitação foi registrada sob o protocolo 88213',
      'Aguarde, em alguns instantes você será atendido',
    ]) {
      expect(pareceAutoAtendimento(t), t).toBe(true);
    }
  });
  it('NÃO acusa gente falando normal', () => {
    for (const t of [
      'boa tarde, tudo certo?',
      'opa, me manda esse exemplo aí',
      'to em reunião agora, me chama mais tarde',
      'quem fala é o Felipe, sou o gerente da loja',
      'nosso horário de pulverização é de manhã',
    ]) {
      expect(pareceAutoAtendimento(t), t).toBe(false);
    }
  });
});

describe('ecoDeMaquina — repetição literal, com piso anti-falso-positivo', () => {
  const menu = 'Bem-vindo(a) à Agro.com! Por favor, digite a opção desejada para continuar: 1 Vendas 2 Financeiro';
  it('mesmo texto longo repetido = máquina', () => {
    expect(ecoDeMaquina([{ direction: 'in', text: menu }] as never, menu)).toBe(true);
  });
  it('"ok" repetido é HUMANO, não eco — gente repete monossílabo o dia todo', () => {
    const thread = [{ direction: 'in', text: 'ok' }, { direction: 'in', text: 'ok' }];
    expect(ecoDeMaquina(thread as never, 'ok')).toBe(false);
    expect(ecoDeMaquina(thread as never, 'blz')).toBe(false);
  });
  it('primeira ocorrência não é eco', () => {
    expect(ecoDeMaquina([] as never, menu)).toBe(false);
  });
  it('só olha o que ELES mandaram', () => {
    expect(ecoDeMaquina([{ direction: 'out', text: menu }] as never, menu)).toBe(false);
  });
});

// A lição de hoje: o "1" que o fundador mandou no menu FUNCIONOU — trouxe o
// Felipe Augusto, o primeiro humano da campanha. Desligar na primeira mensagem
// automática teria matado esse lead. Uma tentativa educada vale a pena; a
// terceira é teimosia.
describe('porteiroEsgotado — uma tentativa vale, duas já é insistência', () => {
  it('deixa tentar até o limite', () => {
    expect(porteiroEsgotado(0)).toBe(false);
    expect(porteiroEsgotado(1)).toBe(false);
  });
  it('para no limite', () => {
    expect(porteiroEsgotado(PORTEIRO_MAX)).toBe(true);
    expect(porteiroEsgotado(PORTEIRO_MAX + 5)).toBe(true);
  });
  it('o limite é 2 — a decisão está no código, não num número mágico', () => {
    expect(PORTEIRO_MAX).toBe(2);
  });
});

// #3 — teto de cadência nas NOSSAS mensagens. Hoje saíram 12 em 2 minutos.
describe('podeFalarDeNovo — cadência mínima entre falas nossas', () => {
  const t0 = new Date('2026-07-28T16:00:00Z');
  it('primeira fala sempre pode', () => {
    expect(podeFalarDeNovo(null, t0)).toBe(true);
  });
  it('bloqueia resposta em rajada', () => {
    expect(podeFalarDeNovo(new Date('2026-07-28T15:59:55Z'), t0)).toBe(false);
  });
  it('libera depois do intervalo', () => {
    expect(podeFalarDeNovo(new Date('2026-07-28T15:59:00Z'), t0)).toBe(true);
  });
  it('data inválida não trava a conversa (falha aberta)', () => {
    expect(podeFalarDeNovo(new Date('lixo'), t0)).toBe(true);
  });
});

// O gym de 28/jul encerrava a conversa em QUALQUER silêncio. Só que silêncio
// por decisão ("é um robô, vou parar") e silêncio por falha ("o modelo
// truncou") são coisas opostas: um é acerto, o outro é defeito de
// infraestrutura. Contar os dois igual fez a Vitória parecer pior do que é.
describe('silêncio deliberado vs silêncio por falha', () => {
  it('sentinela é decisão dela', () => {
    const a = interpretAgentOutput('SILENCIO', 'stop');
    expect(a).toMatchObject({ tipo: 'silencio', deliberado: true });
  });
  it('placeholder também é decisão — ela quis calar, só errou a forma', () => {
    expect(interpretAgentOutput('(sem resposta)', 'stop')).toMatchObject({ deliberado: true });
  });
  it('truncamento é FALHA, não decisão', () => {
    expect(interpretAgentOutput('metade de uma frase que', 'length')).toMatchObject({ deliberado: false });
  });
  it('resposta vazia é FALHA', () => {
    expect(interpretAgentOutput('', 'stop')).toMatchObject({ deliberado: false });
  });
});
