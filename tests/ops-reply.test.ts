/**
 * Resposta livre a um prospect pelo painel/automação (05/ago).
 *
 * O caso que criou a necessidade: a Nathállia, RT da Pró Solo, se identificou
 * e perguntou "como posso te ajudar?" às 12:39. O porteiro tinha classificado a
 * saudação anterior da empresa como atendimento automático, gastado sua única
 * tentativa e DESLIGADO a agente. Quando a humana apareceu, não havia mais
 * ninguém escutando — e não existia nenhum caminho no sistema para responder
 * fora do agente: `send.ts` só sabia mandar TEMPLATE.
 *
 * Template não serve aqui. Dentro da janela de 24h a conversa é livre, e mandar
 * template pra quem já está conversando lê como robô que esqueceu o papo.
 *
 * As travas que este teste fixa:
 *
 * 1. SÓ NÚMERO COM CITAÇÃO (sendablePhone). A mesma régua do disparo: número
 *    sem fonte citada é palpite, e palpite é o que queima a reputação do
 *    número. Responder não é desculpa para furar isso.
 * 2. TEXTO VAZIO NÃO SAI. Um POST malformado não pode virar mensagem em branco
 *    no WhatsApp de um lead.
 * 3. O QUE FOI ENVIADO FICA NA THREAD. Se a mensagem sai e não é registrada, o
 *    painel mente sobre a conversa e a próxima decisão é tomada às cegas — e a
 *    thread é o insumo do agente quando ele voltar a responder.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const enviados: Array<{ to: string; text?: string }> = [];
const logados: Array<{ id: string; dir: string; text: string }> = [];

vi.mock('../api/_lib/transport/cloud', () => ({
  CloudApiAdapter: class {
    async send(m: { to: string; text?: string }): Promise<void> {
      enviados.push(m);
    }
  },
}));
vi.mock('../api/_lib/prospect/db', () => ({
  getProspectById: vi.fn(),
  logProspectMessage: vi.fn(async (id: string, dir: string, _k: string, text: string) => {
    logados.push({ id, dir, text });
  }),
}));

import { responderProspect } from '../api/_lib/prospect/reply';
import { getProspectById } from '../api/_lib/prospect/db';

const COM_CITACAO = {
  id: 'p1',
  name: 'Pró Solo',
  phone: '+553533211234',
  wa_phone: '+5535997429321',
  wa_phone_source: 'http://www.prosolomg.com.br/',
};

beforeEach(() => {
  vi.clearAllMocks();
  enviados.length = 0;
  logados.length = 0;
  vi.mocked(getProspectById).mockResolvedValue(COM_CITACAO as never);
});

describe('responderProspect', () => {
  it('envia para o número CITADO e registra na thread', async () => {
    const r = await responderProspect('p1', 'Oi, Nathállia!');

    expect(r.ok).toBe(true);
    expect(enviados).toEqual([{ to: '+5535997429321', text: 'Oi, Nathállia!' }]);
    expect(logados).toEqual([{ id: 'p1', dir: 'out', text: 'Oi, Nathállia!' }]);
  });

  it('sem fonte citada NÃO envia — mesma régua do disparo', async () => {
    vi.mocked(getProspectById).mockResolvedValue({ ...COM_CITACAO, wa_phone_source: null } as never);

    const r = await responderProspect('p1', 'oi');

    expect(r.ok).toBe(false);
    expect(enviados).toHaveLength(0);
    expect(logados).toHaveLength(0); // nem registra o que não saiu
  });

  it('texto vazio não vira mensagem em branco', async () => {
    for (const t of ['', '   ', '\n']) {
      const r = await responderProspect('p1', t);
      expect(r.ok).toBe(false);
    }
    expect(enviados).toHaveLength(0);
  });

  it('prospect inexistente falha limpo', async () => {
    vi.mocked(getProspectById).mockResolvedValue(null as never);
    expect((await responderProspect('nope', 'oi')).ok).toBe(false);
    expect(enviados).toHaveLength(0);
  });

  it('falha de envio NÃO registra a mensagem como enviada', async () => {
    // Registrar o que não saiu é pior que não registrar: a thread passa a
    // mostrar uma mensagem que o lead nunca recebeu, e a próxima decisão sai
    // errada por causa do nosso livro-caixa.
    const { CloudApiAdapter } = await import('../api/_lib/transport/cloud');
    vi.spyOn(CloudApiAdapter.prototype, 'send').mockRejectedValueOnce(new Error('131047'));

    const r = await responderProspect('p1', 'oi');

    expect(r.ok).toBe(false);
    expect(logados).toHaveLength(0);
  });
});
