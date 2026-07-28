import { describe, it, expect } from 'vitest';
import {
  needsEscalation,
  gateAgentReply,
  agentSystemPrompt,
  formatThreadBlock,
  isNonReply,
  repeatedInbound,
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

describe('repeatedInbound — contraparte automática repetindo o mesmo texto', () => {
  const menu = 'Bem-vindo(a) à Agro.com!\n\nDigite a opção:\n[ 1 ] - Vendas\n[ 2 ] - Financeiro';
  it('segunda repetição do mesmo menu = conversa travada', () => {
    const thread = [
      { direction: 'in', text: menu },
      { direction: 'out', text: 'Poderia me passar o responsável técnico?' },
    ];
    expect(repeatedInbound(thread as never, menu)).toBe(true);
  });
  it('primeira vez não é loop — a Vitória tem direito a uma tentativa', () => {
    expect(repeatedInbound([] as never, menu)).toBe(false);
  });
  it('ignora diferença de espaço/caixa (o bot re-renderiza)', () => {
    const thread = [{ direction: 'in', text: menu.toUpperCase() + '   ' }];
    expect(repeatedInbound(thread as never, menu)).toBe(true);
  });
  it('mensagens humanas diferentes NÃO são loop', () => {
    const thread = [
      { direction: 'in', text: 'Oi, tudo bem?' },
      { direction: 'in', text: 'Pode me explicar melhor?' },
    ];
    expect(repeatedInbound(thread as never, 'Quanto custa?')).toBe(false);
  });
  it('não confunde nossa própria mensagem repetida com loop do outro lado', () => {
    const thread = [
      { direction: 'out', text: 'Oi!' },
      { direction: 'out', text: 'Oi!' },
    ];
    expect(repeatedInbound(thread as never, 'Oi!')).toBe(false);
  });
});
