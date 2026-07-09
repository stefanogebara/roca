import { describe, it, expect } from 'vitest';
import { groundedHit } from '../api/_lib/reason';

// Regression for the crop-confusion bug the gym surfaced: a generic pest query
// must ground in the farmer's OWN crop, not whichever crop wins by product-count.
describe('groundedHit — crop scoping', () => {
  it('grounds a generic "ferrugem" in the farmer\'s known crop (café, not soja)', () => {
    const hit = groundedHit(null, 'ferrugem', ['cafe']);
    expect(hit).not.toBeNull();
    expect(hit!.crop).toBe('cafe');
  });

  it('grounds the same query in soja when that is the known crop', () => {
    const hit = groundedHit(null, 'ferrugem', ['soja']);
    expect(hit).not.toBeNull();
    expect(hit!.crop).toBe('soja');
  });

  it('lets an explicit crop in the message override the known crop', () => {
    const hit = groundedHit('soja', 'ferrugem', ['cafe']);
    expect(hit).not.toBeNull();
    expect(hit!.crop).toBe('soja');
  });

  it('falls back to crop-agnostic search when no crop is known', () => {
    const hit = groundedHit(null, 'ferrugem', null);
    expect(hit).not.toBeNull(); // still grounds something rather than nothing
  });

  it('uses the first known crop the pest is actually registered for', () => {
    // Soybean rust is not a citrus pest; a soja+citros grower asking "ferrugem"
    // should land on soja, the crop it's registered for.
    const hit = groundedHit(null, 'ferrugem', ['citros', 'soja']);
    expect(hit).not.toBeNull();
    expect(['citros', 'soja']).toContain(hit!.crop);
  });
});
