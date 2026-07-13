import { describe, it, expect } from 'vitest';
import { buildHistoryReply, type ActivityRow } from '../api/_lib/caderno';
import { isHistoryRequest } from '../api/_lib/pipeline';

describe('isHistoryRequest', () => {
  it('detects history asks', () => {
    for (const t of [
      'meu histórico',
      'Meu caderno',
      'o que já conversamos?',
      'o que a gente falou até agora',
      // "a gente" conjugates third-singular — the most natural phrasing.
      // Caught by the golden baseline: routed to smalltalk before the fix.
      'o que a gente já conversou?',
      'quero ver meu historico',
    ]) {
      expect(isHistoryRequest(t), t).toBe(true);
    }
  });
  it('ignores unrelated messages', () => {
    for (const t of [
      'posso pulverizar hoje?',
      'que praga é essa?',
      'Montar resumo',
      'histórico de chuva na região', // weather question, not the caderno
    ]) {
      expect(isHistoryRequest(t), t).toBe(false);
    }
  });
});

const rows: ActivityRow[] = [
  { intent: 'pest_triage', created_at: '2026-07-01T12:00:00Z' },
  { intent: 'spray_window', created_at: '2026-07-03T09:00:00Z' },
  { intent: 'spray_window', created_at: '2026-07-05T09:00:00Z' },
  { intent: 'field_health', created_at: '2026-07-06T10:00:00Z' },
  { intent: 'referral', created_at: '2026-07-08T15:00:00Z' },
];

describe('buildHistoryReply', () => {
  it('summarizes the season activity with dates and counts', () => {
    const t = buildHistoryReply({ uf: 'MG', crop: ['cafe'] }, rows);
    expect(t).toMatch(/hist[óo]rico/i);
    expect(t).toContain('cafe');
    expect(t).toContain('MG');
    expect(t).toContain('01/07'); // first event date
    expect(t).toMatch(/2.*janela|janela.*2/i); // 2 spray checks
    expect(t).toMatch(/agr[ôo]nomo/i); // the referral shows up
  });

  it('is honest when there is no history yet', () => {
    const t = buildHistoryReply({ uf: null, crop: null }, []);
    expect(t).toMatch(/ainda n[ãa]o/i);
    expect(t).not.toMatch(/01\/07/);
  });

  it('skips noise intents entirely', () => {
    const t = buildHistoryReply({ uf: null, crop: null }, [
      { intent: 'smalltalk', created_at: '2026-07-01T12:00:00Z' },
      { intent: 'general', created_at: '2026-07-02T12:00:00Z' },
    ]);
    expect(t).toMatch(/ainda n[ãa]o/i);
  });

  it('never has a prescription shape', () => {
    const t = buildHistoryReply({ uf: 'MG', crop: ['cafe'] }, rows);
    expect(t).not.toMatch(/\d+\s?(l|ml|kg|g)\s?\/\s?ha/i);
    expect(t).not.toMatch(/aplique/i);
  });
});
