import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the network tools + db; keep the REAL interpretLand so the 0.15 gate is
// exercised end-to-end. fetchFieldNdvi is the one satellite call we drive.
vi.mock('../api/_lib/tools/ndvi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/_lib/tools/ndvi')>();
  return { ...actual, fetchFieldNdvi: vi.fn() };
});
vi.mock('../api/_lib/tools/soil', () => ({ fetchSoil: vi.fn(), textureLabel: vi.fn() }));
vi.mock('../api/_lib/tools/weather', () => ({ fetchHourlyWeather: vi.fn() }));
vi.mock('../api/_lib/tools/geo', () => ({ reverseGeocodeUf: vi.fn() }));
vi.mock('../api/_lib/reason', () => ({ phraseSpray: vi.fn(() => 'spray') }));
vi.mock('../api/_lib/db', () => ({
  setFarmLocation: vi.fn(),
  setUserState: vi.fn(),
  setCachedSoil: vi.fn(),
  getCachedSoil: vi.fn(),
  setCachedNdvi: vi.fn(),
  setAwaiting: vi.fn(),
}));

import { buildFarmCard, isFarmConfirmYes } from '../api/_lib/farmcard';
import { fetchFieldNdvi } from '../api/_lib/tools/ndvi';
import { fetchSoil } from '../api/_lib/tools/soil';
import { fetchHourlyWeather } from '../api/_lib/tools/weather';
import { reverseGeocodeUf } from '../api/_lib/tools/geo';
import { setFarmLocation, getCachedSoil, setCachedNdvi, setAwaiting } from '../api/_lib/db';

const reading = (ndvi: number) => ({ ndvi, std: 0.02, samples: 9, date: '2026-07-10', cloud: 10 });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(setFarmLocation).mockResolvedValue('farm-1');
  vi.mocked(getCachedSoil).mockResolvedValue(null);
  vi.mocked(fetchSoil).mockResolvedValue(null); // no soil line — keeps the card minimal
  vi.mocked(fetchHourlyWeather).mockRejectedValue(new Error('no weather')); // no spray line
  vi.mocked(reverseGeocodeUf).mockResolvedValue(null); // no vazio line
});

describe('buildFarmCard vegetation gate', () => {
  it('no vegetation on the pin → honest redirect, holds for farm_confirm, NO card image', async () => {
    vi.mocked(fetchFieldNdvi).mockResolvedValue(reading(0.05)); // rooftop / concrete
    const res = await buildFarmCard('u1', -23.55, -46.63); // downtown São Paulo

    expect(res.text).toMatch(/não achei vegetação/i);
    expect(res.text).not.toMatch(/guardei a localização da sua lavoura/i);
    expect(res.card).toBe(false); // never ship a "SUA LAVOURA" image over a rooftop
    expect(vi.mocked(setAwaiting)).toHaveBeenCalledWith('u1', 'farm_confirm');
    expect(vi.mocked(setAwaiting)).not.toHaveBeenCalledWith('u1', 'crop');
    // Still pre-warms the NDVI cache from the read it already made.
    expect(vi.mocked(setCachedNdvi)).toHaveBeenCalled();
  });

  it('vegetation on the pin → normal farm card (+ image) + awaiting crop', async () => {
    vi.mocked(fetchFieldNdvi).mockResolvedValue(reading(0.48));
    const res = await buildFarmCard('u1', -21.2, -45.0);

    expect(res.text).toMatch(/guardei a localização da sua lavoura/i);
    expect(res.text).toMatch(/o que você planta/i);
    expect(res.card).toBe(true);
    expect(vi.mocked(setAwaiting)).toHaveBeenCalledWith('u1', 'crop');
    expect(vi.mocked(setAwaiting)).not.toHaveBeenCalledWith('u1', 'farm_confirm');
  });

  it('no satellite read (clouds / service down) → fails OPEN to the normal card', async () => {
    vi.mocked(fetchFieldNdvi).mockResolvedValue(null);
    const res = await buildFarmCard('u1', -21.2, -45.0);

    expect(res.text).toMatch(/guardei a localização da sua lavoura/i);
    expect(res.card).toBe(true);
    expect(vi.mocked(setAwaiting)).toHaveBeenCalledWith('u1', 'crop');
  });
});

describe('isFarmConfirmYes', () => {
  it('affirms the pin (keep it) on yes / bare-field explanations', () => {
    for (const t of ['é aí mesmo', 'sim', 'isso mesmo', 'tá em pousio', 'acabei de colher', 'recém plantado', 'pode manter', 'confirmo']) {
      expect(isFarmConfirmYes(t), t).toBe(true);
    }
  });
  it('a redirect/negation is NOT a confirm — it falls through to the location path', () => {
    for (const t of ['não, é em Patrocínio', 'não é aqui', 'tá errado', 'é em outro lugar']) {
      expect(isFarmConfirmYes(t), t).toBe(false);
    }
  });
  it('an unrelated message is not a confirm', () => {
    expect(isFarmConfirmYes('quanto custa?')).toBe(false);
  });
});
