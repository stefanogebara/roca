import { describe, it, expect } from 'vitest';
import { parseCrops, joinCrops, isCropsOnlyMessage } from '../api/_lib/tools/crops';

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

describe('isCropsOnlyMessage', () => {
  // Discriminates "an answer to 'o que você planta?'" from "a question that
  // happens to name a crop" — the pipeline only confirms-and-stops on the
  // former; the latter must route normally (caught live: the crop capture
  // swallowed "posso pulverizar na soja?").
  it('accepts bare and scaffolded crop answers', () => {
    expect(isCropsOnlyMessage('soja')).toBe(true);
    expect(isCropsOnlyMessage('soja e milho')).toBe(true);
    expect(isCropsOnlyMessage('planto soja e milho')).toBe(true);
    expect(isCropsOnlyMessage('trabalho com café, uns pés de laranja')).toBe(true);
    expect(isCropsOnlyMessage('tenho pasto pro gado')).toBe(true);
    expect(isCropsOnlyMessage('crio boi')).toBe(true);
    expect(isCropsOnlyMessage('bom dia! planto café')).toBe(true);
    expect(isCropsOnlyMessage('uns 50 hectares de soja')).toBe(true);
  });

  it('rejects questions and statements that only mention a crop', () => {
    expect(isCropsOnlyMessage('posso pulverizar na soja?')).toBe(false);
    expect(isCropsOnlyMessage('posso pulverizar na soja')).toBe(false); // no "?" but clearly not an answer
    expect(isCropsOnlyMessage('como está minha soja')).toBe(false);
    expect(isCropsOnlyMessage('a soja tá amarelando, o que faço')).toBe(false);
    expect(isCropsOnlyMessage('perdi 50 hectares de soja na geada')).toBe(false);
    expect(isCropsOnlyMessage('soja?')).toBe(false); // a question, even if crops-only
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
