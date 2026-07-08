import { describe, it, expect } from 'vitest';
import { classifyVigor } from '../api/_lib/tools/ndvi';

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
});
