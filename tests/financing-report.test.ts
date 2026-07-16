import { describe, it, expect } from 'vitest';
import {
  buildFinancingReport,
  financingCaption,
  financingEmptyReply,
} from '../api/_lib/report/financing';
import { buildFinancingPdf } from '../api/_lib/report/pdf';
import { isFinancingReportRequest } from '../api/_lib/tools/applicationParse';
import { checkOutbound } from '../api/_lib/compliance';
import type { ApplicationRow } from '../api/_lib/db';
import type { ActivityRow } from '../api/_lib/caderno';

function row(over: Partial<ApplicationRow>): ApplicationRow {
  return {
    applied_on: '2026-07-10',
    crop: 'soja',
    product_name: 'Priori Xtra',
    active_ingredient: null,
    dose_text: '0,3 L/ha',
    area_ha: 12,
    target: 'ferrugem',
    source: 'declared_text',
    raw_text: 'apliquei',
    ...over,
  };
}

function act(intent: string, iso: string): ActivityRow {
  return { intent, created_at: `${iso}T12:00:00Z` };
}

describe('isFinancingReportRequest — credit-context document asks only', () => {
  it('matches financing/credit document asks', () => {
    expect(isFinancingReportRequest('me faz um relatório pro banco')).toBe(true);
    expect(isFinancingReportRequest('preciso do documento pro pronaf')).toBe(true);
    expect(isFinancingReportRequest('quero pedir crédito rural')).toBe(true);
    expect(isFinancingReportRequest('histórico de manejo')).toBe(true);
    expect(isFinancingReportRequest('relatório de aplicações pro financiamento')).toBe(true);
  });
  it('does NOT match info questions or the plain caderno ask', () => {
    expect(isFinancingReportRequest('o que é pronaf?')).toBe(false);
    expect(isFinancingReportRequest('como funciona o financiamento?')).toBe(false);
    expect(isFinancingReportRequest('meu caderno de aplicações')).toBe(false);
    expect(isFinancingReportRequest('quanto tá a soja hoje?')).toBe(false);
    expect(isFinancingReportRequest('posso pulverizar hoje?')).toBe(false);
  });
});

describe('buildFinancingReport — safra aggregates from data we already hold', () => {
  const profile = { uf: 'MG', crop: ['café'] };
  const rows = [
    row({ applied_on: '2026-06-01', crop: 'soja', area_ha: 12 }),
    row({ applied_on: '2026-06-20', crop: 'soja', area_ha: null }),
    row({ applied_on: '2026-07-10', crop: 'milho', area_ha: 2.5 }),
  ];
  const activity = [
    act('pest_triage', '2026-05-01'),
    act('pest_triage', '2026-06-15'),
    act('field_health', '2026-06-02'),
    act('spray_window', '2026-06-03'),
    act('spray_window', '2026-06-04'),
    act('spray_window', '2026-07-01'),
    act('brief', '2026-07-02'),
    act('send_failed', '2026-07-03'), // noise — must not count
  ];

  it('sums declared area, dedupes crops, counts activity by kind', () => {
    const fr = buildFinancingReport('João da Silva', profile, rows, activity);
    expect(fr.producer).toBe('João da Silva');
    expect(fr.base.total).toBe(3);
    expect(fr.base.period).toEqual({ from: '2026-06-01', to: '2026-07-10' });
    expect(fr.areaHa).toBe(14.5);
    expect(fr.cropsTreated).toEqual(['soja', 'milho']);
    expect(fr.activity).toEqual({ triages: 2, satellite: 1, sprayConsults: 3, briefs: 1 });
    expect(fr.activitySince).toBe('2026-05-01');
  });

  it('handles an empty season without throwing', () => {
    const fr = buildFinancingReport(null, { uf: null, crop: null }, [], []);
    expect(fr.base.total).toBe(0);
    expect(fr.areaHa).toBeNull();
    expect(fr.cropsTreated).toEqual([]);
    expect(fr.activitySince).toBeNull();
  });
});

describe('financing replies are gate-safe and honestly framed', () => {
  it('caption survives checkOutbound and disclaims the projeto técnico/application', () => {
    const c = financingCaption(5);
    expect(checkOutbound(c).safe).toBe(true);
    expect(c).toMatch(/hist[óo]rico de manejo/i);
    expect(c).toMatch(/agr[ôo]nomo|cooperativa|banco/i);
    expect(c).toMatch(/n[ãa]o [ée] o projeto/i);
  });
  it('empty reply survives the gate and nudges logging', () => {
    const e = financingEmptyReply();
    expect(checkOutbound(e).safe).toBe(true);
    expect(e).toMatch(/registr/i);
  });
});

describe('buildFinancingPdf', () => {
  it('renders a valid PDF with identificação + aggregates + records', async () => {
    const fr = buildFinancingReport(
      'Maria Oliveira',
      { uf: 'MG', crop: ['café'] },
      [row({}), row({ applied_on: '2026-06-01', product_name: 'Roundup', target: 'daninha' })],
      [act('pest_triage', '2026-05-01')]
    );
    const bytes = await buildFinancingPdf(fr);
    expect(Buffer.from(bytes.subarray(0, 4))).toEqual(Buffer.from('%PDF'));
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it('paginates a long season without throwing', async () => {
    const rows = Array.from({ length: 55 }, (_, i) =>
      row({ applied_on: `2026-05-${String((i % 28) + 1).padStart(2, '0')}` })
    );
    const fr = buildFinancingReport('P', { uf: 'MT', crop: ['soja'] }, rows, []);
    const bytes = await buildFinancingPdf(fr);
    expect(Buffer.from(bytes.subarray(0, 4))).toEqual(Buffer.from('%PDF'));
  });
});
