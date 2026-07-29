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
  /** Last ≤7 daily closes converted to R$/saca — the card's honest sparkline.
   * Absent when Yahoo returned too few points; the card then draws no line. */
  series?: number[];
}

interface Series {
  last: number;
  weekAgo: number | null;
  /** Raw daily closes (chronological) from the 10d window. */
  closes: number[];
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
      closes,
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
        // Honest sparkline data: the same closes, saca-converted. ≥3 or nothing.
        const series =
          s.closes.length >= 3
            ? s.closes.slice(-7).map((v) => Number(c.toSaca(v, usdBrl as number).toFixed(1)))
            : undefined;
        return {
          key: c.key,
          label: c.label,
          sacaBrl: c.toSaca(s.last, usdBrl as number),
          weekChangePct: s.weekAgo ? ((s.last - s.weekAgo) / s.weekAgo) * 100 : null,
          series,
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
  // O cabeçalho corrige a âncora ANTES dos números, de propósito. Medido em
  // 29/jul: a resposta dava R$ 2.228,75/saca de arábica no dia em que o
  // indicador CEPEA/ESALQ fechou R$ 1.782,18 — 25% acima, R$ 446 por saca. A
  // conversão está certa; a REFERÊNCIA é outra (KC=F é arábica lavado em
  // armazém americano, e o natural brasileiro sai com desconto).
  // O rodapé antigo dizia "o físico varia" e ficava depois dos números — o
  // produtor lê R$ 2.228 e ancora nisso. Ressalva pequena embaixo de número
  // grande é álibi, não honestidade.
  const lines: string[] = ['📊 *Bolsa hoje* — não é o preço da sua saca', ''];
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
    '_Esses são os futuros de bolsa convertidos pra saca. O físico brasileiro sai ABAIXO disso ' +
      '(frete, qualidade, praça) — quem mede o que você recebe é o indicador CEPEA/ESALQ, que sua ' +
      'cooperativa acompanha. Use a bolsa pra ler a TENDÊNCIA; pra fechar negócio, confirme o preço ' +
      'com sua cooperativa ou corretor._'
  );
  return lines.join('\n');
}
