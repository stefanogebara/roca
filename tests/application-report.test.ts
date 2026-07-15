import { describe, it, expect } from 'vitest';
import {
  buildApplicationsReport,
  applicationsSvg,
  applicationsCaption,
  applicationsEmptyReply,
  applicationsTextSummary,
} from '../api/_lib/cards/applications';
import { svgToPng } from '../api/_lib/cards/render';
import { checkOutbound } from '../api/_lib/compliance';
import {
  reportCardParams,
  verifyReportToken,
  reportSecretConfigured,
} from '../api/_lib/reportToken';
import type { ApplicationRow } from '../api/_lib/db';

function row(over: Partial<ApplicationRow>): ApplicationRow {
  return {
    applied_on: '2026-07-14',
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

describe('buildApplicationsReport', () => {
  const profile = { uf: 'MT', crop: ['soja', 'milho'] };

  it('sorts newest-first, computes the period, and counts the total', () => {
    const rows = [
      row({ applied_on: '2026-07-10' }),
      row({ applied_on: '2026-07-14' }),
      row({ applied_on: '2026-07-12' }),
    ];
    const r = buildApplicationsReport(profile, rows);
    expect(r.total).toBe(3);
    expect(r.period).toEqual({ from: '2026-07-10', to: '2026-07-14' });
    expect(r.lines[0].applied_on).toBe('2026-07-14'); // newest first
    expect(r.cropLabel).toBe('soja, milho');
    expect(r.uf).toBe('MT');
    // product name only (no named active) can't match an active ingredient →
    // "há registro p/ esse alvo", not a confirmed product.
    expect(r.lines[0].verdict.level).toBe('existe_registro');
  });

  it('caps the visible lines but keeps the true total', () => {
    const rows = [
      row({ applied_on: '2026-07-10' }),
      row({ applied_on: '2026-07-11' }),
      row({ applied_on: '2026-07-12' }),
    ];
    const r = buildApplicationsReport(profile, rows, { maxLines: 2 });
    expect(r.lines).toHaveLength(2);
    expect(r.total).toBe(3);
  });

  it('handles an empty period', () => {
    const r = buildApplicationsReport({ uf: null, crop: null }, []);
    expect(r.total).toBe(0);
    expect(r.period).toBeNull();
    expect(r.cropLabel).toBeNull();
  });
});

describe('applicationsSvg', () => {
  const report = buildApplicationsReport({ uf: 'MT', crop: ['soja'] }, [
    row({ applied_on: '2026-07-14', target: 'ferrugem', active_ingredient: 'azoxistrobina' }),
    row({ applied_on: '2026-07-10', product_name: 'Roundup', target: 'planta daninha', dose_text: '2 L/ha' }),
  ]);

  it('renders the header, records, and the legal footer', () => {
    const svg = applicationsSvg(report);
    expect(svg).toContain('Caderno de Aplicações');
    expect(svg).toContain('declarado pelo produtor');
    expect(svg).toContain('Priori Xtra');
    expect(svg).toContain('não é receituário nem certificação técnica');
  });

  it('rasterizes to a valid PNG', () => {
    const png = svgToPng(applicationsSvg(report));
    // PNG magic number
    expect(png.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    expect(png.length).toBeGreaterThan(1000);
  });
});

describe('report text replies are gate-safe (survive checkOutbound)', () => {
  const report = buildApplicationsReport({ uf: 'MT', crop: ['soja'] }, [
    row({ dose_text: '0,3 L/ha', product_name: 'Priori Xtra' }),
  ]);

  it('caption passes the compliance gate and states nothing prescriptive', () => {
    const c = applicationsCaption(5);
    expect(checkOutbound(c).safe).toBe(true);
    expect(c).toContain('caderno de aplicações');
  });

  it('empty reply passes and nudges logging', () => {
    expect(checkOutbound(applicationsEmptyReply()).safe).toBe(true);
  });

  it('text summary passes the gate and never restates a numeric dose', () => {
    const s = applicationsTextSummary(report);
    expect(checkOutbound(s).safe).toBe(true);
    expect(s).not.toContain('0,3 L/ha');
  });
});

describe('reportToken — signed, expiring report URLs', () => {
  const USER = '11111111-2222-3333-4444-555555555555';

  it('without a secret: no params, verify always false', () => {
    delete process.env.REPORT_URL_SECRET;
    expect(reportSecretConfigured()).toBe(false);
    expect(reportCardParams(USER)).toBeNull();
    expect(verifyReportToken(USER, String(Date.now() + 1000), 'deadbeef')).toBe(false);
  });

  it('with a secret: signs and round-trips, and rejects tampering/expiry', () => {
    process.env.REPORT_URL_SECRET = 'test-secret-value';
    const now = 1_800_000_000_000;
    const qs = reportCardParams(USER, { now, ttlMs: 3600_000 });
    expect(qs).not.toBeNull();
    const params = new URLSearchParams(qs!);
    const exp = params.get('exp')!;
    const sig = params.get('sig')!;

    expect(verifyReportToken(USER, exp, sig, now)).toBe(true); // valid within window
    expect(verifyReportToken(USER, exp, sig, Number(exp) + 1)).toBe(false); // expired
    expect(verifyReportToken(USER, exp, sig.replace(/.$/, '0'), now)).toBe(false); // tampered sig
    expect(verifyReportToken('other-user', exp, sig, now)).toBe(false); // wrong user
    delete process.env.REPORT_URL_SECRET;
  });
});
