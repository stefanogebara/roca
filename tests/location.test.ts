import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api/_lib/llm', () => ({ chat: vi.fn() }));
vi.mock('../api/_lib/tools/geo', () => ({ geocodeCityBR: vi.fn() }));

import {
  isLocationSettingRequest,
  resolveStatedLocation,
  confirmLocationReply,
} from '../api/_lib/location';
import { chat } from '../api/_lib/llm';
import { geocodeCityBR } from '../api/_lib/tools/geo';

beforeEach(() => vi.clearAllMocks());

describe('isLocationSettingRequest', () => {
  it('matches explicit "where my field is" statements', () => {
    for (const t of [
      'minha lavoura fica em Patrocínio',
      'minha fazenda é em Espera Feliz-MG',
      'minha roça fica no Alto Paranaíba',
      'sou de Patrocínio, planto café',
    ]) {
      expect(isLocationSettingRequest(t), t).toBe(true);
    }
  });

  it('does NOT hijack a spray/pest question that merely names a city', () => {
    for (const t of [
      'posso pulverizar em Patrocínio hoje?',
      'que praga é essa?',
      'minha lavoura tá com ferrugem', // farm noun but no location — a pest report
      'quanto tá a saca do café?',
    ]) {
      expect(isLocationSettingRequest(t), t).toBe(false);
    }
  });
});

describe('resolveStatedLocation', () => {
  it('extracts city+UF and geocodes to a centroid', async () => {
    vi.mocked(chat).mockResolvedValue('{"city":"Patrocínio","uf":"MG"}');
    vi.mocked(geocodeCityBR).mockResolvedValue({ lat: -18.94, lon: -46.99 });

    const r = await resolveStatedLocation('minha lavoura fica em Patrocínio-MG');

    expect(r).toEqual({ kind: 'resolved', lat: -18.94, lon: -46.99, city: 'Patrocínio', uf: 'MG' });
    expect(vi.mocked(geocodeCityBR)).toHaveBeenCalledWith('Patrocínio', 'MG');
  });

  it('no_place when nothing was named — the caller must fall through, not say "não achei"', async () => {
    vi.mocked(chat).mockResolvedValue('{"city":"","uf":""}');
    expect(await resolveStatedLocation('sou do João, ele me indicou')).toEqual({ kind: 'no_place' });
    expect(vi.mocked(geocodeCityBR)).not.toHaveBeenCalled();
  });

  it('ungeocodable when a place was named but not found (no coordinates beats wrong ones)', async () => {
    vi.mocked(chat).mockResolvedValue('{"city":"Cidade Inventada","uf":""}');
    vi.mocked(geocodeCityBR).mockResolvedValue(null);
    expect(await resolveStatedLocation('minha fazenda é em Cidade Inventada')).toEqual({
      kind: 'ungeocodable',
      city: 'Cidade Inventada',
    });
  });

  it('drops an invalid UF rather than passing garbage to the geocoder', async () => {
    vi.mocked(chat).mockResolvedValue('{"city":"Uberaba","uf":"XX"}');
    vi.mocked(geocodeCityBR).mockResolvedValue({ lat: -19.75, lon: -47.93 });
    await resolveStatedLocation('sou de Uberaba');
    expect(vi.mocked(geocodeCityBR)).toHaveBeenCalledWith('Uberaba', null);
  });
});

describe('confirmLocationReply', () => {
  it('names the place, flags the approximation, and asks for the pin', () => {
    const reply = confirmLocationReply({ lat: 0, lon: 0, city: 'Patrocínio', uf: 'MG' });
    expect(reply).toContain('Patrocínio-MG');
    expect(reply).toMatch(/aproximad/i);
    expect(reply).toMatch(/pin/i);
  });
});
