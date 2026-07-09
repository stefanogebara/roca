import { describe, it, expect } from 'vitest';
import { formatReferralEmail } from '../api/_lib/notify';

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
