/**
 * The spray-vento gap (golden set's first catch): with no farm pin, the
 * spray path returned a fixed "send me your location" no matter what the
 * farmer said — "tá ventando 20 km/h, dá pra aplicar?" deserves an answer
 * about wind BEFORE the pin invitation. These tests pin the split: stated
 * conditions reach the model; the bare ask keeps the cheap deterministic
 * pin-ask; a model failure degrades back to the pin-ask, never an error.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api/_lib/llm', () => ({ chat: vi.fn() }));
vi.mock('../api/_lib/stylepack', () => ({
  steviSystemPrompt: vi.fn(async () => 'SYSTEM-PROMPT'),
}));
vi.mock('../api/_lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/_lib/db')>();
  return {
    ...actual,
    getFarmLocation: vi.fn().mockResolvedValue(null),
    getFarm: vi.fn().mockResolvedValue(null),
    getCachedNdvi: vi.fn().mockResolvedValue(null),
    setCachedNdvi: vi.fn(),
    getFarmProfile: vi.fn().mockResolvedValue({ uf: null, crop: null }),
  };
});

import { reason, mentionsSprayConditions, phraseSpray } from '../api/_lib/reason';
import { chat } from '../api/_lib/llm';
import * as db from '../api/_lib/db';
import type { InboundMessage } from '../api/_lib/transport/types';

const msg = (text: string): InboundMessage => ({
  from: 'test',
  messageId: 'm1',
  kind: 'text',
  text,
  mediaUrl: null,
  mediaMime: null,
  location: null,
  profileName: 'Teste',
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(chat).mockResolvedValue('RESPOSTA-SOBRE-VENTO');
});

describe('mentionsSprayConditions', () => {
  it('detects stated weather/timing conditions', () => {
    expect(mentionsSprayConditions('Tá ventando uns 20 km/h aqui, dá pra aplicar?')).toBe(true);
    expect(mentionsSprayConditions('vai chover mais tarde, aplico agora?')).toBe(true);
    expect(mentionsSprayConditions('aplicar de madrugada é melhor?')).toBe(true);
    expect(mentionsSprayConditions('tá muito quente, uns 34 °C')).toBe(true);
    expect(mentionsSprayConditions('com orvalho na folha pode?')).toBe(true);
  });
  it('stays quiet for the bare ask (deterministic pin path)', () => {
    expect(mentionsSprayConditions('Posso pulverizar hoje?')).toBe(false);
    expect(mentionsSprayConditions('posso pulverizar na soja?')).toBe(false);
    expect(mentionsSprayConditions(null)).toBe(false);
  });
});

describe('handleSpray without a pin', () => {
  it('answers a stated condition through the model, closing with the pin invitation', async () => {
    const reply = await reason(msg('Tá ventando uns 20 km/h aqui, dá pra aplicar?'), 'spray_window', {
      userId: null,
    });
    expect(reply).toBe('RESPOSTA-SOBRE-VENTO');
    expect(chat).toHaveBeenCalledTimes(1);
    const call = vi.mocked(chat).mock.calls[0][0];
    expect(call.system).toContain('SYSTEM-PROMPT'); // keeps the product voice
    expect(call.system).toMatch(/NUNCA invente previsão/i);
    expect(call.system).toMatch(/localização/i); // must invite the pin
    expect(call.system).toMatch(/[Ss]em produto, sem dose/);
  });

  it('keeps the cheap deterministic pin-ask for the bare question', async () => {
    const reply = await reason(msg('Posso pulverizar hoje?'), 'spray_window', { userId: null });
    expect(reply).toMatch(/preciso saber onde fica sua lavoura/);
    expect(chat).not.toHaveBeenCalled();
  });

  it('degrades to the pin-ask when the model call fails (never an error to the farmer)', async () => {
    vi.mocked(chat).mockRejectedValue(new Error('provider down'));
    const reply = await reason(msg('tá ventando demais, aplico?'), 'spray_window', { userId: null });
    expect(reply).toMatch(/preciso saber onde fica sua lavoura/);
  });
});

describe('phraseSpray honesty hedge (it is a forecast, not a measurement)', () => {
  const win = (verdict: 'go' | 'caution' | 'no-go') =>
    ({ now: { verdict, deltaT: 5, windKmh: 6, reasons: ['Delta T 5 °C, vento fraco'] }, bestUpcoming: null }) as never;

  it('every verdict carries a "confirm in the field" caveat', () => {
    for (const v of ['go', 'caution', 'no-go'] as const) {
      const out = phraseSpray(win(v));
      expect(out, v).toMatch(/previs[ãa]o/i);
      expect(out, v).toMatch(/confir\w+.*no campo/i);
    }
  });

  it('still leads with the verdict and its reasons', () => {
    const out = phraseSpray(win('go'));
    expect(out).toMatch(/✅ Pode pulverizar/);
    expect(out).toMatch(/Delta T 5 °C/);
  });
});

describe('field_health with an approximate (city) location', () => {
  it('asks for the exact pin instead of reading NDVI at a municipal centroid', async () => {
    vi.mocked(db.getFarm).mockResolvedValue({ id: 'f1', lat: -18.9, lon: -46.9, precision: 'city' });
    const reply = await reason(msg('como está minha lavoura?'), 'field_health', { userId: 'u1' });
    expect(reply).toMatch(/aproximada, só pela cidade/i);
    expect(reply).toMatch(/pin da porteira/i);
    expect(db.getCachedNdvi).not.toHaveBeenCalled(); // never even tries the satellite read
  });
});
