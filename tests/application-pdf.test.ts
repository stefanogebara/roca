import { describe, it, expect } from 'vitest';
import { buildApplicationsPdf } from '../api/_lib/report/pdf';
import { buildApplicationsReport } from '../api/_lib/cards/applications';
import type { ApplicationRow } from '../api/_lib/db';

function row(over: Partial<ApplicationRow>): ApplicationRow {
  return {
    applied_on: '2026-07-14',
    crop: 'soja',
    product_name: 'Priori Xtra',
    active_ingredient: 'azoxistrobina',
    dose_text: '0,3 L/ha',
    area_ha: 12,
    target: 'ferrugem',
    source: 'declared_text',
    raw_text: 'apliquei',
    ...over,
  };
}

const PDF_MAGIC = Buffer.from('%PDF');

describe('buildApplicationsPdf', () => {
  it('produces a valid PDF byte stream', async () => {
    const report = buildApplicationsReport({ uf: 'MT', crop: ['soja'] }, [
      row({ applied_on: '2026-07-14' }),
      row({ applied_on: '2026-07-10', product_name: 'Roundup', target: 'planta daninha', dose_text: '2 L/ha' }),
    ]);
    const bytes = await buildApplicationsPdf(report);
    expect(Buffer.from(bytes.subarray(0, 4))).toEqual(PDF_MAGIC);
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it('paginates when there are many records', async () => {
    const rows = Array.from({ length: 60 }, (_, i) =>
      row({ applied_on: `2026-05-${String((i % 28) + 1).padStart(2, '0')}` })
    );
    const report = buildApplicationsReport({ uf: 'MT', crop: ['soja'] }, rows, { maxLines: 200 });
    const bytes = await buildApplicationsPdf(report);
    expect(Buffer.from(bytes.subarray(0, 4))).toEqual(PDF_MAGIC);
    expect(report.lines.length).toBe(60);
  });

  it('never throws on emoji / exotic unicode in farmer free-text (sanitized)', async () => {
    const report = buildApplicationsReport({ uf: 'MT', crop: ['soja'] }, [
      row({ product_name: '🌾 Veneno™ 中文 — Priori', target: 'ferrugãozão 🐛' }),
    ]);
    const bytes = await buildApplicationsPdf(report);
    expect(Buffer.from(bytes.subarray(0, 4))).toEqual(PDF_MAGIC);
  });
});
