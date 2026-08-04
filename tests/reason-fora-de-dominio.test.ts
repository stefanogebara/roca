/**
 * Cultura fora de domínio não pode sair com a mesma embalagem de confiança
 * (achado #9 da auditoria de 04/ago).
 *
 * O prompt da visão obrigava a cultura a caber num enum —
 * `"crop":"soja|milho|pastagem|cafe|citros|outro"` — e o código convertia
 * `"outro"` em `null`, o MESMO valor de "não deu pra ver a cultura". A partir
 * dali as duas situações eram indistinguíveis, e a resposta saía genérica com o
 * mesmo tom de quem sabe do assunto.
 *
 * Foi o caso do mamão, 03/ago: foto de mancha em folha de mamoeiro respondida
 * como se fosse mais um diagnóstico de rotina. As culturas que a Stevi de fato
 * ancora no Agrofit são cinco (soja, milho, pastagem, café, citros); mamão não
 * é uma delas, e o produtor não tinha como saber disso pela resposta.
 *
 * O conserto inverte quem decide: o modelo diz o que VÊ ("mamão"), em texto
 * livre, e o CÓDIGO decide se é cultura de casa, com o `normalizeCrop` que já
 * existia. Enum no prompt é o modelo apagando informação antes de nós.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api/_lib/llm', () => ({ chat: vi.fn() }));
vi.mock('../api/_lib/stylepack', () => ({
  steviSystemPrompt: vi.fn(async () => 'SYSTEM-PROMPT'),
}));
vi.mock('../api/_lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/_lib/db')>();
  return {
    ...actual,
    getFarmLocation: vi.fn().mockResolvedValue(null),
    getFarmProfile: vi.fn().mockResolvedValue({ uf: null, crop: null }),
  };
});

import { reason } from '../api/_lib/reason';
import { chat } from '../api/_lib/llm';
import type { InboundMessage } from '../api/_lib/transport/types';
import type { ChatImage } from '../api/_lib/llm';

const foto = { base64: 'x', mime: 'image/jpeg' } as unknown as ChatImage;
const msg = (text: string | null = null): InboundMessage =>
  ({ from: '+55', messageId: 'm1', kind: 'image', text, mediaUrl: null, mediaMime: 'image/jpeg', location: null, profileName: 'J' }) as InboundMessage;

/** Resposta da 1ª chamada (visão) + da 2ª (composição). */
function respostas(visao: object): void {
  vi.mocked(chat)
    .mockResolvedValueOnce(JSON.stringify(visao))
    .mockResolvedValueOnce('resposta ao produtor');
}

/** O prompt `user` da chamada de composição (a 2ª). */
const promptDaComposicao = (): string =>
  String(vi.mocked(chat).mock.calls[1]?.[0]?.user ?? '');

beforeEach(() => vi.clearAllMocks());

describe('foto de cultura fora das cinco de casa', () => {
  it('a composição é avisada de que a cultura está fora do domínio', async () => {
    respostas({ pest: 'mancha-de-corinespora', crop: 'mamão', confidence: 'media', evidence: 'lesões circulares' });

    await reason(msg(), 'pest_triage', { userId: 'u1', media: foto });

    expect(promptDaComposicao()).toMatch(/fora das culturas|fora do dom[íi]nio/i);
  });

  it('a cultura vista aparece por extenso — some no null era o bug', async () => {
    respostas({ pest: 'mancha-de-corinespora', crop: 'mamão', confidence: 'media', evidence: 'lesões' });

    await reason(msg(), 'pest_triage', { userId: 'u1', media: foto });

    expect(promptDaComposicao()).toContain('mamão');
  });

  it('cultura DE CASA não leva o aviso — senão a Stevi se diminui à toa', async () => {
    respostas({ pest: 'ferrugem asiática', crop: 'soja', confidence: 'alta', evidence: 'pústulas' });

    await reason(msg(), 'pest_triage', { userId: 'u1', media: foto });

    expect(promptDaComposicao()).not.toMatch(/fora das culturas|fora do dom[íi]nio/i);
  });

  it('cultura que não deu pra ver NÃO é tratada como fora de domínio', async () => {
    // A distinção que o `null` único destruía: "é mamão, não é meu forte" e
    // "não consegui ver a cultura" pedem respostas diferentes.
    respostas({ pest: 'lagarta', crop: '', confidence: 'media', evidence: 'folha roída' });

    await reason(msg(), 'pest_triage', { userId: 'u1', media: foto });

    expect(promptDaComposicao()).not.toMatch(/fora das culturas|fora do dom[íi]nio/i);
  });

  it('o prompt da visão pede o nome da cultura, não um enum', async () => {
    // A causa-raiz: com enum, o modelo era obrigado a responder "outro" e a
    // informação morria antes de chegar aqui. Nenhum conserto a jusante
    // recuperaria o nome depois disso.
    respostas({ pest: 'x', crop: 'soja', confidence: 'alta', evidence: 'y' });

    await reason(msg(), 'pest_triage', { userId: 'u1', media: foto });

    const sistemaVisao = String(vi.mocked(chat).mock.calls[0]?.[0]?.system ?? '');
    expect(sistemaVisao).not.toMatch(/soja\|milho\|pastagem/);
  });
});
