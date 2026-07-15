import { describe, it, expect } from 'vitest';
import {
  classifyVigor,
  classifyUniformity,
  aggregateNdvi,
  gridPoints,
  NDVI_VIGOR_BREAKS,
} from '../api/_lib/tools/ndvi';

describe('classifyVigor', () => {
  it('flags bare soil at very low NDVI', () => {
    const c = classifyVigor(0.08);
    expect(c.label).toMatch(/solo/i);
    expect(c.emoji).toBe('🟤');
  });

  it('flags sparse vegetation', () => {
    expect(classifyVigor(0.22).label).toMatch(/rala/i);
  });

  it('reads moderate development', () => {
    expect(classifyVigor(0.4).label).toMatch(/moderado/i);
  });

  it('reads a vigorous field', () => {
    expect(classifyVigor(0.6).label).toMatch(/vigorosa/i);
    expect(classifyVigor(0.6).emoji).toBe('🟢');
  });

  it('reads a closed canopy at high NDVI', () => {
    expect(classifyVigor(0.82).label).toMatch(/vigor alto|dossel/i);
  });

  it('every band carries an honest note', () => {
    for (const v of [0.05, 0.2, 0.4, 0.6, 0.8]) {
      expect(classifyVigor(v).note.length).toBeGreaterThan(10);
    }
  });

  it('is monotonic across the band boundaries', () => {
    // Boundaries: 0.15, 0.30, 0.50, 0.70 — labels must differ across them.
    expect(classifyVigor(0.14).label).not.toBe(classifyVigor(0.16).label);
    expect(classifyVigor(0.29).label).not.toBe(classifyVigor(0.31).label);
    expect(classifyVigor(0.49).label).not.toBe(classifyVigor(0.51).label);
    expect(classifyVigor(0.69).label).not.toBe(classifyVigor(0.71).label);
  });

  // Single-source guard: the NDVI card colours off NDVI_VIGOR_BREAKS, so those
  // breaks MUST be exactly where classifyVigor's label changes — else the card
  // colour and the text label silently disagree.
  it('band transitions land exactly on the shared NDVI_VIGOR_BREAKS', () => {
    expect([...NDVI_VIGOR_BREAKS]).toEqual([0.15, 0.3, 0.5, 0.7]);
    for (const b of NDVI_VIGOR_BREAKS) {
      expect(classifyVigor(b - 0.001).label, `below ${b}`).not.toBe(classifyVigor(b).label);
    }
  });
});

describe('aggregateNdvi', () => {
  it('returns null on no samples', () => {
    expect(aggregateNdvi([])).toBeNull();
    expect(aggregateNdvi([NaN, Infinity])).toBeNull(); // non-finite filtered out
  });

  it('computes mean, population std, and count', () => {
    const a = aggregateNdvi([0.4, 0.6])!;
    expect(a.mean).toBeCloseTo(0.5, 10);
    expect(a.std).toBeCloseTo(0.1, 10); // population std of {0.4,0.6}
    expect(a.samples).toBe(2);
  });

  it('a single sample has zero spread', () => {
    const a = aggregateNdvi([0.62])!;
    expect(a.mean).toBeCloseTo(0.62, 10);
    expect(a.std).toBe(0);
    expect(a.samples).toBe(1);
  });

  it('ignores non-finite values but keeps the finite ones', () => {
    const a = aggregateNdvi([0.5, NaN, 0.7])!;
    expect(a.samples).toBe(2);
    expect(a.mean).toBeCloseTo(0.6, 10);
  });
});

describe('classifyUniformity', () => {
  it('calls a tight spread parelha', () => {
    expect(classifyUniformity(0.02).label).toMatch(/parelha/i);
  });
  it('calls a moderate spread some variation', () => {
    expect(classifyUniformity(0.09).label).toMatch(/varia/i);
  });
  it('calls a wide spread uneven', () => {
    expect(classifyUniformity(0.2).label).toMatch(/desiguais/i);
  });
  it('is monotonic across the boundaries (0.06, 0.13)', () => {
    expect(classifyUniformity(0.05).label).not.toBe(classifyUniformity(0.07).label);
    expect(classifyUniformity(0.12).label).not.toBe(classifyUniformity(0.14).label);
  });
  it('every band carries an actionable note', () => {
    for (const s of [0.02, 0.09, 0.2]) {
      expect(classifyUniformity(s).note.length).toBeGreaterThan(20);
    }
  });
});

describe('gridPoints', () => {
  const lat = -12.545;
  const lon = -55.721;

  it('returns (2·ring+1)² points and includes the exact center', () => {
    const pts = gridPoints(lat, lon, 30, 1);
    expect(pts).toHaveLength(9);
    expect(pts.some(([a, b]) => a === lat && b === lon)).toBe(true);
  });

  it('spaces neighbours by the requested ground distance (lat)', () => {
    const pts = gridPoints(lat, lon, 30, 1);
    // Any two points one row apart differ in latitude by 30 m.
    const north = pts.find(([a]) => a > lat)!;
    const metres = (north[0] - lat) * 111_320;
    expect(metres).toBeCloseTo(30, 3);
  });

  it('scales longitude by cos(lat) so ground spacing is isotropic', () => {
    const pts = gridPoints(lat, lon, 30, 1);
    const east = pts.find(([, b]) => b > lon)!;
    // East-west ground distance = Δlon · 111_320 · cos(lat).
    const metres = (east[1] - lon) * 111_320 * Math.cos((lat * Math.PI) / 180);
    expect(metres).toBeCloseTo(30, 3);
  });

  it('a larger ring yields a larger lattice', () => {
    expect(gridPoints(lat, lon, 30, 2)).toHaveLength(25);
  });
});
