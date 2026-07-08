import { describe, it, expect } from 'vitest';
import {
  lookupPest,
  normalizeCrop,
  groundingBlock,
} from '../api/_lib/tools/agrofit';

describe('normalizeCrop', () => {
  it('maps common crop words to canonical keys', () => {
    expect(normalizeCrop('soja')).toBe('soja');
    expect(normalizeCrop('Milho safrinha')).toBe('milho');
    expect(normalizeCrop('pasto')).toBe('pastagem');
    expect(normalizeCrop('braquiária')).toBe('pastagem');
  });
  it('returns null for non-covered crops', () => {
    expect(normalizeCrop('trigo')).toBeNull();
    expect(normalizeCrop('arroz')).toBeNull();
    expect(normalizeCrop(null)).toBeNull();
  });
});

describe('lookupPest', () => {
  it('grounds ferrugem on soy to Phakopsora with registered products', () => {
    const hit = lookupPest('soja', 'ferrugem');
    expect(hit).not.toBeNull();
    expect(hit!.entry.sci.join(' ')).toMatch(/Phakopsora/i);
    expect(hit!.entry.products).toBeGreaterThan(0);
    expect(hit!.entry.ativos.length).toBeGreaterThan(0);
  });

  it('matches accent-insensitively and via scientific name', () => {
    const a = lookupPest('milho', 'lagarta do cartucho');
    expect(a).not.toBeNull();
    expect(a!.entry.sci.join(' ')).toMatch(/Spodoptera/i);
    const b = lookupPest('milho', 'Spodoptera frugiperda');
    expect(b).not.toBeNull();
  });

  it('returns null below the confidence floor (never mis-ground)', () => {
    expect(lookupPest('soja', 'xyzqwk nonsense')).toBeNull();
  });

  it('searches all crops when crop is unknown', () => {
    const hit = lookupPest(null, 'ferrugem');
    expect(hit).not.toBeNull();
  });

  it('grounds café pests (ferrugem do cafeeiro, broca)', () => {
    const rust = lookupPest('cafe', 'ferrugem do café');
    expect(rust).not.toBeNull();
    expect(rust!.crop).toBe('cafe');
    expect(rust!.entry.products).toBeGreaterThan(0);
    expect(lookupPest('cafe', 'broca do café')).not.toBeNull();
  });

  it('grounds citros pests (cancro cítrico)', () => {
    const cancro = lookupPest('citros', 'cancro cítrico');
    expect(cancro).not.toBeNull();
    expect(cancro!.crop).toBe('citros');
    expect(cancro!.entry.products).toBeGreaterThan(0);
  });
});

describe('normalizeCrop — café + citros', () => {
  it('maps coffee and citrus vocabulary', () => {
    expect(normalizeCrop('cafezal')).toBe('cafe');
    expect(normalizeCrop('meu café')).toBe('cafe');
    expect(normalizeCrop('laranja')).toBe('citros');
    expect(normalizeCrop('citros')).toBe('citros');
  });
});

describe('groundingBlock', () => {
  it('states what is registered and reasserts the prescription boundary', () => {
    const hit = lookupPest('soja', 'ferrugem')!;
    const block = groundingBlock(hit);
    expect(block).toMatch(/Agrofit/);
    expect(block).toMatch(/registrad/i);
    expect(block).toMatch(/receituário/i);
    // Must not emit an application dose/rate.
    expect(block).not.toMatch(/\d+\s?(l|kg|g|ml)\s?\/\s?ha/i);
  });
});
