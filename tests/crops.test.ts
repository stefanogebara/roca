import { describe, it, expect } from 'vitest';
import { parseCrops, joinCrops } from '../api/_lib/tools/crops';

describe('parseCrops', () => {
  it('parses a single crop', () => {
    expect(parseCrops('planto soja')).toEqual(['soja']);
  });

  it('parses multiple crops in one answer, in stable order', () => {
    expect(parseCrops('trabalho com soja e milho')).toEqual(['soja', 'milho']);
  });

  it('recognizes pasture/cattle vocabulary', () => {
    expect(parseCrops('tenho pasto pro gado')).toEqual(['pastagem']);
    expect(parseCrops('crio boi')).toEqual(['pastagem']);
  });

  it('is accent-insensitive (café, citros)', () => {
    expect(parseCrops('tenho um cafezal')).toEqual(['café']);
    expect(parseCrops('planto laranja')).toEqual(['citros']);
  });

  it('dedupes repeated mentions', () => {
    expect(parseCrops('soja, mais soja e um pouco de soja')).toEqual(['soja']);
  });

  it('returns empty when no crop is recognized', () => {
    expect(parseCrops('na verdade quero saber do tempo')).toEqual([]);
  });

  it('does not false-match substrings', () => {
    // "limão" matches citros, but an unrelated word should not.
    expect(parseCrops('bom dia, tudo certo?')).toEqual([]);
  });
});

describe('joinCrops', () => {
  it('formats lists naturally', () => {
    expect(joinCrops(['soja'])).toBe('soja');
    expect(joinCrops(['soja', 'milho'])).toBe('soja e milho');
    expect(joinCrops(['soja', 'milho', 'pastagem'])).toBe('soja, milho e pastagem');
  });
  it('handles empty', () => {
    expect(joinCrops([])).toBe('');
  });
});
