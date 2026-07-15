import { describe, it, expect } from 'vitest';
import { interpretLand, VEGETATION_MIN_NDVI } from '../api/_lib/tools/ndvi';

// The pin-drop vegetation gate: a dropped pin is only treated as a field when
// satellite shows plausible vegetation. Water and built-up read below the
// "solo praticamente exposto" band (<0.15) — the same threshold classifyVigor
// already uses — and must NOT be asserted as "sua lavoura". A missing read
// (clouds / titiler down) is 'unknown' → the caller fails OPEN (behaves as today).
describe('interpretLand (pin-drop vegetation confirmation)', () => {
  it('vegetation when NDVI is at/above the bare-soil threshold', () => {
    expect(interpretLand({ ndvi: VEGETATION_MIN_NDVI })).toBe('vegetation'); // boundary is inclusive
    expect(interpretLand({ ndvi: 0.28 })).toBe('vegetation');
    expect(interpretLand({ ndvi: 0.62 })).toBe('vegetation');
  });

  it('no_vegetation for concrete / bare / water (below the threshold)', () => {
    expect(interpretLand({ ndvi: 0.05 })).toBe('no_vegetation'); // rooftop/asphalt
    expect(interpretLand({ ndvi: 0.14 })).toBe('no_vegetation'); // just under the band
    expect(interpretLand({ ndvi: -0.12 })).toBe('no_vegetation'); // open water reads negative
  });

  it('unknown when there is no reading — caller must fail open, never block onboarding', () => {
    expect(interpretLand(null)).toBe('unknown');
  });

  it('threshold matches the tool’s own "solo praticamente exposto" band', () => {
    expect(VEGETATION_MIN_NDVI).toBe(0.15);
  });
});
