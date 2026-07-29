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
  dicaDeTurno,
  resolverSilencio,
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
  // Achado pelo gym em 29/jul, depois de ligá-lo no caminho real: o bot da
  // Coopagro escreveu "digite **2**" e o padrão /digite\s+\d/ não pegou —
  // o asterisco de markdown fica entre o verbo e o dígito. A Vitória deu
  // despedida de humano para um robô.
  it('pega o dígito mesmo com markdown/pontuação no meio', () => {
    for (const t of ['digite **2** para técnico', 'Digite: 1', 'digite "3"', 'tecle *0*', 'digite  ➡ 2']) {
      expect(pareceAutoAtendimento(t), t).toBe(true);
    }
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

// O limite foi 2 e virou 1, por MEDIÇÃO. Em 28/jul justifiquei 2 com o caso da
// Agro.com — o fundador mandou "1" no menu e o Felipe apareceu. O juiz pareado
// de 29/jul derrubou o raciocínio:
//   conducao → "a segunda conversa INSISTE ao REPETIR a mesma mensagem"
//   correcao → "a versão antiga cessou as mensagens; a nova insistiu"
// O "1" foi um HUMANO navegando o menu, e a Vitória é proibida de navegar menu.
// A segunda tentativa dela não tem para onde ir: só repete o mesmo pedido — e
// repetir com robô é o que o porteiro existe para evitar.
describe('porteiroEsgotado — UMA tentativa, e encerra', () => {
  it('a primeira tentativa é permitida', () => {
    expect(porteiroEsgotado(0)).toBe(false);
  });
  it('a partir do limite, para', () => {
    expect(porteiroEsgotado(PORTEIRO_MAX)).toBe(true);
    expect(porteiroEsgotado(PORTEIRO_MAX + 5)).toBe(true);
  });
  it('o default é 1 — decisão medida, não número mágico', () => {
    expect(PORTEIRO_MAX).toBe(1);
  });
  it('nunca é 0 nem absurdo, mesmo com env malformada', () => {
    // 0 = nunca tenta furar o menu; 99 = insiste com robô a tarde inteira.
    expect(PORTEIRO_MAX).toBeGreaterThanOrEqual(1);
    expect(PORTEIRO_MAX).toBeLessThanOrEqual(3);
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

// O pareado de 28/jul perdeu dois cenários, e os dois pela mesma raiz: o
// porteiro DETECTAVA o robô e não contava pro modelo. Ele caía no
// buildAgentReply sem saber com quem falava.
//   auto-atendimento: "a segunda ignorou a dica do bot e ficou em um impasse"
//   manda-material:   "comete erro grave ao ficar em silêncio, equiparado a
//                      mensagem inútil"
describe('dicaDeTurno — o que o modelo precisa saber ANTES de responder', () => {
  it('robô detectado: instrui a pedir o responsável técnico em UMA linha', () => {
    const d = dicaDeTurno({ robo: true, tentativa: 0 });
    expect(d).toMatch(/autom[áa]tic/i);
    expect(d).toMatch(/respons[áa]vel|t[ée]cnic/i);
    expect(d).toMatch(/uma linha|1 linha/i);
  });

  it('robô na ÚLTIMA tentativa: instrui a encerrar, não a insistir', () => {
    const d = dicaDeTurno({ robo: true, tentativa: PORTEIRO_MAX });
    expect(d).toMatch(/encerr|despedi|parar/i);
  });

  it('humano: nenhuma dica — não poluir o prompt do caso normal', () => {
    expect(dicaDeTurno({ robo: false, tentativa: 0 })).toBe('');
  });
});

describe('silêncio com HUMANO do outro lado vira encerramento', () => {
  it('robô: silêncio deliberado continua silêncio', () => {
    const a = resolverSilencio({ tipo: 'silencio', motivo: 'x', deliberado: true }, { robo: true }, 'Coop');
    expect(a.tipo).toBe('silencio');
  });

  it('humano: silêncio deliberado vira UMA linha de encerramento', () => {
    const a = resolverSilencio({ tipo: 'silencio', motivo: 'x', deliberado: true }, { robo: false }, 'Coop');
    expect(a.tipo).toBe('responder');
    if (a.tipo === 'responder') {
      expect((a.texto.match(/\?/g) ?? []).length).toBe(0); // encerra, não pergunta
      expect(a.texto.length).toBeLessThan(220);
    }
  });

  it('silêncio por FALHA nunca vira mensagem — não é decisão dela', () => {
    const a = resolverSilencio({ tipo: 'silencio', motivo: 'truncou', deliberado: false }, { robo: false }, 'Coop');
    expect(a.tipo).toBe('silencio');
  });

  it('resposta normal passa intacta', () => {
    const a = resolverSilencio({ tipo: 'responder', texto: 'oi' }, { robo: false }, 'Coop');
    expect(a).toEqual({ tipo: 'responder', texto: 'oi' });
  });
})

// gap:proposta_de_horario_flexivel — apontado pelo juiz na rodada 32c510f3.
// A raiz era o próprio prompt: ele MANDAVA propor um dia fixo, com o exemplo
// literal "quinta de manhã serve?". O modelo obedecia, e o juiz reclamava em
// dois lugares diferentes:
//   "marcar a reunião sem confirmar a agenda do prospect de forma mais flexível"
//   "se prende a datas fixas sem contextualizar"
// Ela também não tem acesso à agenda do Stefano — cravar horário é prometer
// disponibilidade de terceiro, o mesmo defeito do "ele te chama ainda hoje".
describe('prompt de AVANÇO — pergunta a preferência, não crava horário', () => {
  const p = agentSystemPrompt('Vitória');

  it('não instrui a cravar um dia específico', () => {
    expect(p).not.toMatch(/quinta de manh[ãa]/i);
  });

  it('manda perguntar quando é melhor PRA ELE', () => {
    expect(p).toMatch(/melhor\s+(pra|para)\s+(voc[êe]|vocês)|qual.*melhor.*hor[áa]rio|que\s+dia.*melhor/i);
  });

  it('proíbe prometer a agenda do Stefano — ela não a conhece', () => {
    expect(p).toMatch(/n[ãa]o.*(crav|prometa|marque).*hor[áa]rio|agenda do stefano/i);
  });

  it('mantém a regra de que interesse sem próximo passo esfria', () => {
    expect(p).toMatch(/esfria/i);
  });
})

// Irmão do mesmo defeito, achado ao consertar o horário: três lugares
// prometiam que o Stefano responde "hoje ainda". É disponibilidade de TERCEIRO
// que ela não controla — se ele não responder hoje, o prospect foi enganado. O
// juiz já havia marcado: "promete que o Stefano chamará 'ainda hoje'... uma
// promessa que não pode ser feita por uma assistente virtual".
describe('nunca prometer prazo de terceiro', () => {
  // Cuidado que este teste já me pegou: proibir a SUBSTRING é ingênuo, porque o
  // prompt cita "hoje ainda" justamente para PROIBIR. O que não pode existir é
  // a construção afirmativa — "responde hoje ainda", "chama hoje ainda".
  it('o prompt não promete resposta do Stefano no mesmo dia', () => {
    const p = agentSystemPrompt('Vitória');
    expect(p).not.toMatch(/(responde|chama|retorna|liga)\w*[^.\n]{0,40}(hoje ainda|ainda hoje)/i);
  });

  it('e proíbe prazo explicitamente', () => {
    expect(agentSystemPrompt('Vitória')).toMatch(/nunca\s+prometa\s+prazo/i);
  });

  it('o fallback do gate de preço também não', () => {
    expect(gateAgentReply('cobramos R$ 50 por lead').text).not.toMatch(/hoje ainda|ainda hoje/i);
  });

  it('o fallback continua encaminhando pro Stefano — sem prazo, mas com destino', () => {
    const t = gateAgentReply('cobramos R$ 50 por lead').text;
    expect(t).toMatch(/stefano/i);
    expect(t).not.toMatch(/R\$/);
  });
})
