import { describe, it, expect } from 'vitest';
import { formatDigest, type DigestStats } from '../api/_lib/digest';

const base: DigestStats = {
  since: '2026-07-07T21:00:00.000Z',
  until: '2026-07-08T21:00:00.000Z',
  inboundTotal: 12,
  uniqueUsers: 4,
  newUsers: 2,
  byIntent: { pest_triage: 5, spray_window: 3, field_health: 2, referral: 1, smalltalk: 1 },
  byKind: { text: 8, image: 2, location: 1, voice: 1 },
  referrals: 1,
  openLeads: 3,
  returningUsers: 2,
  failures: 1,
  sampleQuestions: ['que praga é essa na soja?', 'posso pulverizar hoje?'],
};

describe('formatDigest', () => {
  it('summarizes volume, intents, kinds, referrals and failures', () => {
    const t = formatDigest(base);
    expect(t).toMatch(/resumo do dia/i);
    expect(t).toMatch(/12 mensagens de 4 produtor/);
    expect(t).toMatch(/2 novo/);
    expect(t).toMatch(/pest_triage 5/);
    expect(t).toMatch(/Pedidos de agrônomo: 1/);
    expect(t).toMatch(/Leads a contatar: 3/);
    expect(t).toMatch(/Falhas.*1/);
  });

  it('ranks intents/kinds by count (most common first)', () => {
    const t = formatDigest(base);
    // pest_triage (5) must appear before spray_window (3) in the intents line.
    const intentLine = t.split('\n').find((l) => l.includes('Intenções'))!;
    expect(intentLine.indexOf('pest_triage')).toBeLessThan(intentLine.indexOf('spray_window'));
  });

  it('reports returning farmers — the retention signal', () => {
    const t = formatDigest(base);
    expect(t).toMatch(/🔁.*2 de 4/);
  });

  it('includes sample questions', () => {
    const t = formatDigest(base);
    expect(t).toMatch(/que praga é essa/);
  });

  it('shows a green check when there were no failures', () => {
    expect(formatDigest({ ...base, failures: 0 })).toMatch(/✅ Falhas.*0/);
  });

  it('handles a quiet day gracefully', () => {
    const quiet: DigestStats = {
      ...base,
      inboundTotal: 0,
      uniqueUsers: 0,
      newUsers: 0,
      byIntent: {},
      byKind: {},
      referrals: 0,
      openLeads: 0,
      returningUsers: 0,
      failures: 0,
      sampleQuestions: [],
    };
    const t = formatDigest(quiet);
    expect(t).toMatch(/Nenhuma conversa/i);
    expect(t).not.toMatch(/Intenções/); // no noise on an empty day
  });

  it('shows the open-lead backlog even on an otherwise quiet day', () => {
    const quietWithLeads: DigestStats = {
      ...base,
      inboundTotal: 0,
      uniqueUsers: 0,
      newUsers: 0,
      byIntent: {},
      byKind: {},
      referrals: 0,
      openLeads: 2,
      sampleQuestions: [],
    };
    const t = formatDigest(quietWithLeads);
    expect(t).toMatch(/Leads a contatar: 2/);
    expect(t).toMatch(/Nenhuma conversa/i); // backlog appears before the quiet notice
  });
});
