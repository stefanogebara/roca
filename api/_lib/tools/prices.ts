/**
 * Commodity quotes — the price habit loop, v1 (on demand).
 *
 * Sources: exchange futures via Yahoo Finance's public chart API (delayed
 * quotes) — NY arabica (KC=F, ¢/lb), CBOT soy (ZS=F, ¢/bu), CBOT corn (ZC=F,
 * ¢/bu) and USD/BRL (BRL=X). These are the references Brazilian growers track
 * ("o café em NY"); the reply is explicit that physical prices in the farmer's
 * region differ (basis/freight/quality) — CEPEA's regional indicators are
 * copyrighted and would need licensing to redistribute, so we deliberately
 * quote the international reference instead.
 */

const YAHOO = 'https://query1.finance.yahoo.com/v8/finance/chart';

// Unit conversions to the Brazilian saca (60 kg).
const LB_PER_SACA = 132.276; // 60 kg in pounds
const SOY_BU_PER_SACA = 60 / 27.2155; // soy bushel = 27.2155 kg
const CORN_BU_PER_SACA = 60 / 25.4012; // corn bushel = 25.4012 kg

export function cafeSacaBrl(centsPerLb: number, usdBrl: number): number {
  return (centsPerLb / 100) * LB_PER_SACA * usdBrl;
}
export function sojaSacaBrl(centsPerBu: number, usdBrl: number): number {
  return (centsPerBu / 100) * SOY_BU_PER_SACA * usdBrl;
}
export function milhoSacaBrl(centsPerBu: number, usdBrl: number): number {
  return (centsPerBu / 100) * CORN_BU_PER_SACA * usdBrl;
}

export interface CommodityQuote {
  key: 'cafe' | 'soja' | 'milho';
  label: string;
  sacaBrl: number;
  /** vs ~one week ago, percent. */
  weekChangePct: number | null;
}

interface Series {
  last: number;
  weekAgo: number | null;
}

/** Last close + ~week-ago close from Yahoo's chart API. Throws on failure. */
async function fetchSeries(symbol: string): Promise<Series> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${YAHOO}/${encodeURIComponent(symbol)}?range=10d&interval=1d`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Yahoo ${symbol} returned ${res.status}`);
    const data = (await res.json()) as {
      chart?: { result?: Array<{ indicators?: { quote?: Array<{ close?: Array<number | null> }> } }> };
    };
    const closes = (data.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []).filter(
      (c): c is number => c != null
    );
    if (closes.length === 0) throw new Error(`Yahoo ${symbol}: no closes`);
    return {
      last: closes[closes.length - 1],
      weekAgo: closes.length >= 6 ? closes[closes.length - 6] : closes[0] ?? null,
    };
  } finally {
    clearTimeout(timer);
  }
}

const COMMODITIES: Array<{
  key: CommodityQuote['key'];
  label: string;
  symbol: string;
  toSaca: (raw: number, usdBrl: number) => number;
}> = [
  { key: 'cafe', label: 'Café arábica (NY)', symbol: 'KC=F', toSaca: cafeSacaBrl },
  { key: 'soja', label: 'Soja (Chicago)', symbol: 'ZS=F', toSaca: sojaSacaBrl },
  { key: 'milho', label: 'Milho (Chicago)', symbol: 'ZC=F', toSaca: milhoSacaBrl },
];

/** Commodities explicitly named in a message — an explicit ask beats the
 * profile filter ("cotação do café" from a soy grower must quote café). */
export function askedCommodities(text: string): string[] {
  const asked: string[] = [];
  if (/caf[ée]/i.test(text)) asked.push('cafe');
  if (/\bsoja\b/i.test(text)) asked.push('soja');
  if (/\bmilho\b/i.test(text)) asked.push('milho');
  return asked;
}

export interface PricesResult {
  quotes: CommodityQuote[];
  usdBrl: number | null;
}

/**
 * Fetch quotes for the given crops (default: all three). Fail-soft per
 * commodity — a Yahoo hiccup on one symbol doesn't kill the reply.
 */
export async function fetchPrices(cropKeys?: string[] | null): Promise<PricesResult> {
  let usdBrl: number | null = null;
  try {
    usdBrl = (await fetchSeries('BRL=X')).last;
  } catch {
    return { quotes: [], usdBrl: null };
  }

  const wanted = COMMODITIES.filter(
    (c) => !cropKeys?.length || cropKeys.some((k) => k.includes(c.key))
  );
  const targets = wanted.length > 0 ? wanted : COMMODITIES;

  const quotes = await Promise.all(
    targets.map(async (c): Promise<CommodityQuote | null> => {
      try {
        const s = await fetchSeries(c.symbol);
        return {
          key: c.key,
          label: c.label,
          sacaBrl: c.toSaca(s.last, usdBrl as number),
          weekChangePct: s.weekAgo ? ((s.last - s.weekAgo) / s.weekAgo) * 100 : null,
        };
      } catch {
        return null;
      }
    })
  );
  return { quotes: quotes.filter((q): q is CommodityQuote => q !== null), usdBrl };
}

function brl(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Compose the PT-BR quotes reply. Pure — unit-tested. */
export function formatPricesReply(quotes: CommodityQuote[], usdBrl: number | null): string {
  if (quotes.length === 0 || usdBrl == null) {
    return 'Não consegui puxar as cotações agora. 🙈 Tenta de novo daqui a pouco.';
  }
  const lines: string[] = ['💰 *Cotações de hoje* (referência internacional)', ''];
  for (const q of quotes) {
    const dir =
      q.weekChangePct == null
        ? ''
        : q.weekChangePct >= 0
          ? ` 📈 +${q.weekChangePct.toFixed(1).replace('.', ',')}% na semana`
          : ` 📉 ${q.weekChangePct.toFixed(1).replace('.', ',')}% na semana`;
    lines.push(`• ${q.label}: ~R$ ${brl(q.sacaBrl)}/saca${dir}`);
  }
  lines.push(`• Dólar: R$ ${brl(usdBrl)}`);
  lines.push('');
  lines.push(
    '_Isso é a referência internacional (bolsa) convertida pra saca — o preço físico na sua região ' +
      'varia com frete, qualidade e praça. Confirme com sua cooperativa ou corretor antes de fechar negócio._'
  );
  return lines.join('\n');
}
