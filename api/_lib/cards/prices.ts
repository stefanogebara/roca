/**
 * Price card: the day's cotações as a shareable image. Prices are the
 * highest-frequency habit intent and the most forwarded content in rural
 * WhatsApp groups — this card is the product's organic distribution surface.
 *
 * Design system v2 (plan 2026-07-16-card-design-system): brand header, five-step
 * type scale on an 8px grid, drawn trend chips (no font glyphs — tofu-proof),
 * honest sparkline from real closes, atmosphere + depth via cardShell. No emoji
 * in rendered images.
 */

import type { CommodityQuote } from '../tools/prices';
import { C, T, esc, cardShell, brandHeader, trendChip, sparkline, hairline } from './render';

const W = 900;

const NAME: Record<CommodityQuote['key'], { name: string; sub: string }> = {
  cafe: { name: 'Café arábica', sub: 'NY · saca 60 kg' },
  soja: { name: 'Soja', sub: 'Chicago · saca 60 kg' },
  milho: { name: 'Milho', sub: 'Chicago · saca 60 kg' },
};

function brl(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Build the price-card SVG. Pure. */
export function pricesSvg(
  quotes: CommodityQuote[],
  usdBrl: number | null,
  dateLabel: string
): string {
  const rows = quotes.slice(0, 3);
  const M = T.margin;
  const headerY = 96;
  const rowsTop = 152;
  const rowH = 112;
  const footY = rowsTop + rows.length * rowH + 16;
  const H = footY + 88;

  const body = rows
    .map((q, i) => {
      const top = rowsTop + i * rowH;
      const base = top + 46; // shared baseline: name + price
      const meta = NAME[q.key] ?? { name: q.label, sub: '' };
      const spark =
        q.series && q.series.length >= 3
          ? sparkline(
              320,
              top + 16,
              108,
              40,
              q.series,
              q.weekChangePct != null && q.weekChangePct < -0.05 ? C.nogo : C.leaf
            )
          : '';
      return `
      <text x="${M}" y="${base}" font-family="DM Sans" font-size="26" font-weight="700" fill="${C.ink}">${esc(meta.name)}</text>
      <text x="${M}" y="${base + 26}" font-family="DM Sans" font-size="${T.small}" fill="${C.muted}">${esc(meta.sub)}</text>
      ${spark}
      <text x="${W - 200}" y="${base}" font-family="Instrument Serif" font-size="${T.display}" fill="${C.green}" text-anchor="end">R$ ${brl(q.sacaBrl)}</text>
      ${trendChip(W - M, base + 16, q.weekChangePct)}
      ${i < rows.length - 1 ? hairline(M, W - M, top + rowH - 8) : ''}`;
    })
    .join('');

  const dolar = usdBrl != null ? `Dólar R$ ${brl(usdBrl)}  ·  ` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${cardShell(W, H)}

  ${brandHeader(M, headerY, 'Cotações de hoje')}
  <rect x="${W - M - 96}" y="${headerY - 24}" width="96" height="32" rx="16" fill="${T.pillFlat}"/>
  <text x="${W - M - 48}" y="${headerY - 2}" font-family="DM Sans" font-size="${T.small}" font-weight="700" fill="${T.inkSoft}" text-anchor="middle">${esc(dateLabel)}</text>

  ${body}

  ${hairline(M, W - M, footY)}
  <text x="${M}" y="${footY + 32}" font-family="DM Sans" font-size="${T.small}" fill="${C.green2}">${esc(`${dolar}referência internacional convertida — o preço na sua praça varia com frete e qualidade`)}</text>
  <text x="${M}" y="${footY + 58}" font-family="DM Sans" font-size="${T.small}" fill="${C.muted}">Quer todo dia? Manda "cotação" pra Stevi no WhatsApp.</text>
</svg>`;
}
