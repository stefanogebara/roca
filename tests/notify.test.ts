import { describe, it, expect, afterEach } from 'vitest';
import { formatReferralEmail, pingFoundersWhatsApp } from '../api/_lib/notify';

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
