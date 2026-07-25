import { describe, it, expect } from 'vitest';
import {
  cafeSacaBrl,
  sojaSacaBrl,
  milhoSacaBrl,
  formatPricesReply,
  askedCommodities,
  type CommodityQuote,
} from '../api/_lib/tools/prices';
import { isPriceRequest } from '../api/_lib/pipeline';

describe('saca conversions', () => {
  it('converts NY arabica ¢/lb to R$/saca 60kg', () => {
    // 300 ¢/lb × 132.276 lb/saca × R$5.00 = R$1.984,14
    expect(cafeSacaBrl(300, 5)).toBeCloseTo(1984.1, 0);
  });
  it('converts CBOT soy ¢/bu to R$/saca 60kg', () => {
    // 1000 ¢/bu → $10/bu; 60kg = 2.2046 bu → $22.05 × R$5 = R$110.23
    expect(sojaSacaBrl(1000, 5)).toBeCloseTo(110.2, 0);
  });
  it('converts CBOT corn ¢/bu to R$/saca 60kg', () => {
    // 400 ¢/bu → $4/bu; 60kg = 2.3621 bu → $9.45 × R$5 = R$47.24
    expect(milhoSacaBrl(400, 5)).toBeCloseTo(47.2, 0);
  });
});

describe('formatPricesReply', () => {
  const quotes: CommodityQuote[] = [
    { key: 'cafe', label: 'Café arábica (NY)', sacaBrl: 1984.1, weekChangePct: 2.3 },
    { key: 'soja', label: 'Soja (Chicago)', sacaBrl: 110.2, weekChangePct: -1.1 },
  ];

  it('lists each commodity with R$/saca and weekly direction', () => {
    const t = formatPricesReply(quotes, 5.42);
    expect(t).toContain('Café arábica');
    expect(t).toMatch(/1\.984|1984/);
    expect(t).toMatch(/saca/i);
    expect(t).toMatch(/📈.*2,3%|2,3%.*📈/);
    expect(t).toMatch(/📉.*1,1%|1,1%.*📉/);
    expect(t).toMatch(/5,42/); // dólar
  });

  it('is honest that this is an international reference, not the local price', () => {
    const t = formatPricesReply(quotes, 5.42);
    expect(t).toMatch(/refer[êe]ncia internacional/i);
    expect(t).toMatch(/cooperativa|corretor|regi[ãa]o/i);
  });

  it('handles an empty quote list without pretending', () => {
    const t = formatPricesReply([], 5.42);
    expect(t).toMatch(/n[ãa]o consegui/i);
  });
});

describe('askedCommodities', () => {
  it('extracts explicitly named commodities', () => {
    expect(askedCommodities('cotação do café')).toEqual(['cafe']);
    expect(askedCommodities('quanto tá a soja e o milho?')).toEqual(['soja', 'milho']);
  });
  it('returns empty for a generic ask (falls back to profile)', () => {
    expect(askedCommodities('cotações')).toEqual([]);
    expect(askedCommodities('quanto tá o dólar')).toEqual([]);
  });
});

describe('isPriceRequest', () => {
  it('detects price asks', () => {
    for (const t of [
      'cotação do café',
      'quanto tá a soja?',
      'preço do milho hoje',
      'quanto está o dólar',
      'cotações',
      'quanto tá a saca do café?', // intervening "saca do" before the commodity
      'quanto tá a saca do milho',
      'quanto está o preço da soja',
    ]) {
      expect(isPriceRequest(t), t).toBe(true);
    }
  });
  it('ignores unrelated messages', () => {
    for (const t of [
      'posso pulverizar hoje?',
      'que praga é essa?',
      'o preço do frete subiu', // not a commodity quote ask
      'quanto tá o trabalho hoje', // "quanto tá <noun>" with no commodity
      'quanto tá a saca de arroz', // arroz isn't a commodity we quote
      'meu histórico',
    ]) {
      expect(isPriceRequest(t), t).toBe(false);
    }
  });
});
