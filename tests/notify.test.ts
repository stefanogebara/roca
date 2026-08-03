import { describe, it, expect, afterEach } from 'vitest';
import { formatReferralEmail, formatProspectReplyEmail, pingFoundersWhatsApp, resumoDoLote } from '../api/_lib/notify';
import { escolhaDeCanal } from '../api/_lib/alert';

describe('formatProspectReplyEmail', () => {
  it('carries name, kind, region, masked phone, reply excerpt and the painel link', () => {
    const { subject, body } = formatProspectReplyEmail({
      name: 'Cooperativa Serrana',
      kind: 'cooperativa',
      city: 'Patrocínio',
      uf: 'MG',
      maskedPhone: '+55 ••••7766',
      replyText: 'Interessante, como funciona a parceria de vocês?',
    });
    expect(subject).toContain('respondeu');
    expect(subject).toContain('Cooperativa Serrana');
    expect(body).toContain('cooperativa');
    expect(body).toContain('Patrocínio');
    expect(body).toContain('••••7766');
    expect(body).toContain('como funciona a parceria');
    expect(body).toContain('/painel');
    expect(body).not.toMatch(/\d{8,}/); // never a raw phone
  });

  it('truncates long replies and survives missing fields', () => {
    const { subject, body } = formatProspectReplyEmail({
      name: null,
      kind: 'revenda',
      city: null,
      uf: null,
      maskedPhone: '••••',
      replyText: 'x'.repeat(500),
    });
    expect(subject).toContain('revenda');
    expect(body.length).toBeLessThan(900);
    expect(body).toContain('…');
  });
});

describe('formatReferralEmail', () => {
  it('carries UF, crops, topic and the masked phone — never a raw number', () => {
    const { subject, body } = formatReferralEmail({
      maskedPhone: '+55 ••••2121',
      uf: 'MG',
      crops: ['cafe', 'milho'],
      topic: 'me indica um agrônomo pra ver a ferrugem',
    });
    expect(subject).toContain('MG');
    expect(subject).toContain('cafe, milho');
    expect(body).toContain('+55 ••••2121');
    expect(body).toContain('ferrugem');
    expect(body).toContain('/painel');
    expect(body).not.toMatch(/\d{8,}/); // no raw phone-like digit runs
  });

  it('degrades gracefully when profile fields are missing', () => {
    const { subject, body } = formatReferralEmail({
      maskedPhone: '••••',
      uf: null,
      crops: null,
      topic: 'quero um agrônomo',
    });
    expect(subject).toContain('UF não informada');
    expect(body).toContain('culturas não informadas');
  });
});

describe('pingFoundersWhatsApp', () => {
  afterEach(() => {
    delete process.env.FOUNDER_WA_NUMBERS;
  });

  const notice = {
    maskedPhone: '+55 ••••2121',
    uf: 'MG',
    crops: ['cafe'],
    topic: 'quero um agrônomo',
  };

  it('pings every configured number with the masked notice', async () => {
    process.env.FOUNDER_WA_NUMBERS = '+5511999002121, +5511888001111';
    const sent: Array<{ to: string; text: string }> = [];
    await pingFoundersWhatsApp(async (to, text) => void sent.push({ to, text }), notice);
    expect(sent.map((s) => s.to)).toEqual(['+5511999002121', '+5511888001111']);
    expect(sent[0].text).toContain('••••2121');
    expect(sent[0].text).toContain('/painel');
  });

  it('does nothing when unconfigured', async () => {
    const sent: string[] = [];
    await pingFoundersWhatsApp(async (to) => void sent.push(to), notice);
    expect(sent).toEqual([]);
  });

  it('one failing number does not block the others', async () => {
    process.env.FOUNDER_WA_NUMBERS = '+5511999002121,+5511888001111';
    const sent: string[] = [];
    await pingFoundersWhatsApp(async (to) => {
      if (to === '+5511999002121') throw new Error('Twilio send failed 400: not in sandbox');
      sent.push(to);
    }, notice);
    expect(sent).toEqual(['+5511888001111']);
  });
});

/**
 * Resumo do lote pros founders — a "automação diária" pedida em 02/ago.
 *
 * Desenho deliberado: NÃO é cron novo nem rotina em nuvem. O próprio disparo é
 * o evento (regra da casa: evento > cron), e o resumo sai no fim de cada lote
 * real pelo mesmo canal de WhatsApp que já avisa pedido de agrônomo. A rotina
 * em nuvem foi descartada por não ter como ler o banco sem espalhar segredo.
 */
describe('resumoDoLote — o push das 10h em linguagem de founder', () => {
  const base = {
    dryRun: false, skippedOutsideHours: false, aborted: false,
    eligible: 139, planned: 8, sent: 8, failed: 0,
    recipients: [], cap: 20, capGrade: 'graded',
  };

  it('lote normal vira frase com enviados e fila', () => {
    const r = resumoDoLote({ ...base }, null);
    expect(r).toMatch(/8 convites enviados/);
    expect(r).toMatch(/131 na fila/); // eligible - sent
    expect(r).toMatch(/painel/i);
  });

  it('falhas aparecem com o motivo típico traduzido', () => {
    const r = resumoDoLote({ ...base, sent: 5, failed: 3 }, null);
    expect(r).toMatch(/5 convites enviados/);
    expect(r).toMatch(/3 não tinham WhatsApp/);
  });

  it('aborto de segurança é o aviso mais importante do dia', () => {
    const r = resumoDoLote({ ...base, aborted: true, error: 'optouts indisponíveis', sent: 0 }, null);
    expect(r).toMatch(/⛔/);
    expect(r).toMatch(/nenhum convite saiu/i);
  });

  it('bumps entram na conta quando existem', () => {
    const r = resumoDoLote({ ...base }, { sent: 2, failed: 0 });
    expect(r).toMatch(/2 lembretes/);
  });

  it('nada aconteceu → null: silêncio, não spam', () => {
    // 13h e 16h com cap do dia já esgotado não podem virar três pings iguais.
    expect(resumoDoLote({ ...base, sent: 0, failed: 0 }, null)).toBeNull();
    expect(resumoDoLote({ ...base, sent: 0, failed: 0, skippedOutsideHours: true }, null)).toBeNull();
  });

  it('dry run NUNCA vira mensagem', () => {
    expect(resumoDoLote({ ...base, dryRun: true }, null)).toBeNull();
  });
});

/**
 * O canal de alerta da empresa — incidente descoberto em 03/ago.
 *
 * alertFounders tinha só dois degraus: ALERT_WEBHOOK_URL (nunca configurado) e
 * WhatsApp via Twilio. Consulta à API do Twilio: TODA mensagem pros founders
 * falhou com 63015 ("o sandbox só entrega a quem entrou nele") — e a sessão do
 * sandbox expira em 3 DIAS, então mesmo quem entrou cai fora sozinho. Ou seja:
 * alerta de incidente do webhook, canário, LLM caindo e lead quente apontavam
 * pra um cano morto, e ninguém percebeu porque falha de alerta falha calada
 * (o HTTP 201 "queued" do Twilio esconde o fracasso assíncrono).
 *
 * E-mail já era o canal comprovado (lead quente usa e chega). Agora ele é um
 * degrau do alerta, entre o webhook e o Twilio legado.
 */
describe('escolhaDeCanal — ordem de tentativa do alerta', () => {
  it('WhatsApp PRIMEIRO — alerta que chega em caixa de entrada não acorda ninguém', () => {
    expect(escolhaDeCanal({ webhook: true, email: true, whatsapp: true })).toEqual([
      'whatsapp', 'webhook', 'email',
    ]);
  });

  it('sem número de founder, cai pros canais de texto', () => {
    expect(escolhaDeCanal({ webhook: true, email: true, whatsapp: false })).toEqual(['webhook', 'email']);
  });

  it('só e-mail configurado: ainda entrega', () => {
    expect(escolhaDeCanal({ webhook: false, email: true, whatsapp: false })).toEqual(['email']);
  });
});
