import { describe, it, expect } from 'vitest';
import {
  wetBulbC,
  deltaT,
  assessHour,
  sprayWindow,
  type HourWeather,
} from '../api/_lib/tools/deltaT';

describe('wetBulbC (Stull formula)', () => {
  it('equals dry-bulb at 100% humidity (saturation)', () => {
    // At saturation, wet-bulb ≈ dry-bulb. Stull is empirical so allow a small gap.
    expect(wetBulbC(25, 100)).toBeCloseTo(25, 0);
  });

  it('is well below dry-bulb in hot dry air', () => {
    // 35 °C / 20% RH → strong evaporative cooling, wet-bulb far below dry-bulb.
    expect(wetBulbC(35, 20)).toBeLessThan(25);
  });

  it('matches a known reference point (20 °C, 50% RH ≈ 13.7 °C)', () => {
    expect(wetBulbC(20, 50)).toBeCloseTo(13.7, 0);
  });
});

describe('deltaT', () => {
  it('is near zero in saturated air', () => {
    expect(deltaT(25, 100)).toBeLessThan(1);
  });

  it('is large in hot dry air', () => {
    expect(deltaT(35, 20)).toBeGreaterThan(10);
  });
});

describe('assessHour', () => {
  const base: HourWeather = { time: 't', tempC: 24, humidity: 65, windKmh: 5 };

  it('returns go in the favourable window with calm wind', () => {
    const a = assessHour(base);
    expect(a.deltaT).toBeGreaterThanOrEqual(2);
    expect(a.deltaT).toBeLessThanOrEqual(8);
    expect(a.verdict).toBe('go');
  });

  it('returns no-go when Delta T is too high (evaporation/drift)', () => {
    const a = assessHour({ ...base, tempC: 38, humidity: 15 });
    expect(a.verdict).toBe('no-go');
    expect(a.reasons.join(' ')).toMatch(/evapora|deriva/i);
  });

  it('returns caution when humidity is very high (Delta T too low)', () => {
    const a = assessHour({ ...base, tempC: 18, humidity: 97 });
    expect(a.verdict).toBe('caution');
  });

  it('returns no-go when wind exceeds the hard limit', () => {
    const a = assessHour({ ...base, windKmh: 20 });
    expect(a.verdict).toBe('no-go');
    expect(a.reasons.join(' ')).toMatch(/vento/i);
  });

  it('returns caution for moderate wind alone', () => {
    const a = assessHour({ ...base, windKmh: 12 });
    expect(a.verdict).toBe('caution');
  });

  it('returns no-go on high rain probability', () => {
    const a = assessHour({ ...base, precipProb: 80 });
    expect(a.verdict).toBe('no-go');
    expect(a.reasons.join(' ')).toMatch(/chuva/i);
  });

  it('escalates to the worst condition among several', () => {
    // Good Delta T but both moderate wind and rain — worst wins.
    const a = assessHour({ ...base, windKmh: 12, precipProb: 85 });
    expect(a.verdict).toBe('no-go');
  });
});

describe('sprayWindow', () => {
  it('reports now as go and no upcoming needed', () => {
    const hours: HourWeather[] = [
      { time: '14:00', tempC: 24, humidity: 65, windKmh: 5 },
      { time: '15:00', tempC: 25, humidity: 60, windKmh: 6 },
    ];
    const w = sprayWindow(hours);
    expect(w.now.verdict).toBe('go');
    expect(w.bestUpcoming).toBeNull();
  });

  it('finds the next good hour when now is no-go', () => {
    const hours: HourWeather[] = [
      { time: '13:00', tempC: 38, humidity: 15, windKmh: 5 }, // no-go
      { time: '17:00', tempC: 22, humidity: 60, windKmh: 4 }, // go
    ];
    const w = sprayWindow(hours);
    expect(w.now.verdict).toBe('no-go');
    expect(w.bestUpcoming?.time).toBe('17:00');
  });

  it('returns null upcoming when no good hour exists', () => {
    const hours: HourWeather[] = [
      { time: '13:00', tempC: 38, humidity: 15, windKmh: 5 },
      { time: '14:00', tempC: 39, humidity: 12, windKmh: 20 },
    ];
    const w = sprayWindow(hours);
    expect(w.bestUpcoming).toBeNull();
  });

  it('throws on empty input', () => {
    expect(() => sprayWindow([])).toThrow();
  });
});
