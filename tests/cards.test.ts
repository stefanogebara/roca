import { describe, it, expect } from 'vitest';
import { spraySvg } from '../api/_lib/cards/spray';
import { ndviSvg } from '../api/_lib/cards/ndviCard';
import { farmSvg } from '../api/_lib/cards/farm';
import { svgToPng } from '../api/_lib/cards/render';
import type { HourAssessment } from '../api/_lib/tools/deltaT';

const hour = (h: number, verdict: HourAssessment['verdict'], deltaT = 5): HourAssessment => ({
  time: `2026-07-09T${String(h).padStart(2, '0')}:00`,
  deltaT,
  windKmh: 8,
  precipProb: 10,
  verdict,
  reasons: ['teste'],
});

describe('spraySvg', () => {
  const hours = [hour(12, 'no-go', 11), hour(13, 'caution'), hour(16, 'go'), hour(17, 'go')];
  it('renders the current verdict, hours and branding', () => {
    const svg = spraySvg(hours, hours[2]);
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain('Melhor não agora'); // now = no-go
    expect(svg).toContain('12h');
    expect(svg).toContain('16h');
    expect(svg).toMatch(/Janela de pulverização/);
    expect(svg).toContain('agora');
    expect(svg).toContain('melhor'); // bestUpcoming marker
  });
  it('is valid single-root SVG', () => {
    const svg = spraySvg(hours, null);
    expect(svg.trim().endsWith('</svg>')).toBe(true);
  });
});

describe('ndviSvg', () => {
  it('renders the value, band label and area scope', () => {
    const svg = ndviSvg({
      ndvi: 0.62,
      date: '2026-06-29',
      samples: 9,
      vigor: { label: 'lavoura vigorosa', note: 'boa massa verde' },
      uniformity: { label: 'lavoura parelha', note: 'uniforme' },
    });
    expect(svg).toContain('NDVI 0.62');
    expect(svg).toContain('lavoura vigorosa');
    expect(svg).toContain('29/06/2026');
    expect(svg).toContain('média de 9 pontos da lavoura');
    expect(svg).toMatch(/Uniformidade/);
  });
  it('omits uniformity when not provided', () => {
    const svg = ndviSvg({ ndvi: 0.2, date: '2026-06-29', vigor: { label: 'rala', note: 'x' }, uniformity: null });
    expect(svg).not.toMatch(/Uniformidade/);
    expect(svg).toContain('leitura de um ponto');
  });
});

describe('farmSvg', () => {
  it('renders soil, spray verdict and vazio, with UF', () => {
    const svg = farmSvg({
      uf: 'MT',
      soil: { texture: 'argiloso (terra pesada)', ph: 5.2, acid: true },
      spray: { verdict: 'no-go', deltaT: 10.3, windKmh: 7 },
      vazio: { active: true },
    });
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain('Estado: MT');
    expect(svg).toContain('argiloso (terra pesada)');
    expect(svg).toContain('pH ~5.2');
    expect(svg).toContain('ácido');
    expect(svg).toContain('Melhor não agora');
    expect(svg).toContain('Vazio sanitário da soja ATIVO');
    expect(svg.trim().endsWith('</svg>')).toBe(true);
  });
  it('degrades gracefully when layers are missing', () => {
    const svg = farmSvg({ uf: null, soil: null, spray: null, vazio: null });
    expect(svg).toContain('Localização registrada');
    expect(svg).toContain('Não consegui ler o solo agora.');
    expect(svg).toContain('Sem dados de clima agora.');
    expect(svg).not.toContain('undefined');
  });
  it('rasterizes to a valid PNG', () => {
    const png = svgToPng(
      farmSvg({
        uf: 'GO',
        soil: { texture: 'textura média', ph: 6.1, acid: false },
        spray: { verdict: 'go', deltaT: 5, windKmh: 8 },
        vazio: { active: false },
      })
    );
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  });
});

describe('svgToPng (rasterizer + bundled fonts)', () => {
  it('produces a valid PNG buffer', () => {
    const png = svgToPng(ndviSvg({ ndvi: 0.5, date: '2026-06-29', vigor: { label: 'x', note: 'y' } }));
    expect(png.length).toBeGreaterThan(1000);
    // PNG magic number: 89 50 4E 47 0D 0A 1A 0A
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  });
});
