import { describe, it, expect } from 'vitest';
import { isDeletionRequest } from '../api/_lib/pipeline';
import { scrubDigestForPersistence, type DigestStats } from '../api/_lib/digest';

describe('isDeletionRequest', () => {
  it('detects the canonical and common variants', () => {
    for (const t of [
      'apaga meus dados',
      'apagar meus dados',
      'exclui meus dados',
      'quero ser esquecido',
      'quero ser esquecida',
      'cancela meu cadastro',
      'cancelar minha conta',
      'apaga minha conta',
      'exclua meu cadastro',
    ]) {
      expect(isDeletionRequest(t), t).toBe(true);
    }
  });
  it('does not fire on unrelated messages', () => {
    for (const t of [
      'como apago a ferrugem da lavoura?',
      'meus dados de solo estão certos?',
      'cancela o alerta de geada', // feature ask, not account deletion
      'posso pulverizar hoje?',
    ]) {
      expect(isDeletionRequest(t), t).toBe(false);
    }
  });
});

describe('scrubDigestForPersistence', () => {
  const stats: DigestStats = {
    since: '2026-07-08T21:00:00.000Z',
    until: '2026-07-09T21:00:00.000Z',
    inboundTotal: 5,
    uniqueUsers: 2,
    newUsers: 1,
    byIntent: { pest_triage: 3 },
    byKind: { text: 5 },
    referrals: 1,
    openLeads: 0,
    returningUsers: 1,
    failures: 0,
    sampleQuestions: ['minha soja no sítio do João está com ferrugem'],
  };

  it('strips verbatim farmer text from the persisted stats and text', () => {
    const text = 'header\n💬 Amostras do que perguntaram:\n• minha soja no sítio do João está com ferrugem';
    const scrubbed = scrubDigestForPersistence(stats, text);
    expect(scrubbed.stats.sampleQuestions).toEqual([]);
    expect(scrubbed.text).not.toContain('sítio do João');
    expect(scrubbed.text).toContain('header');
  });

  it('keeps aggregate numbers intact', () => {
    const scrubbed = scrubDigestForPersistence(stats, 'x');
    expect(scrubbed.stats.inboundTotal).toBe(5);
    expect(scrubbed.stats.referrals).toBe(1);
  });
});
