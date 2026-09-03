/**
 * Price card: the day's cotações as a shareable image. Prices are the
 * highest-frequency habit intent and the most forwarded content in rural
 * WhatsApp groups — this card is the product's organic distribution surface.
 *
 * Identidade v2: cabeçalho de marca, escala tipográfica em grade de 8px, chips
 * de tendência DESENHADOS (sem glifo de fonte — à prova de tofu), sparkline
 * honesta a partir dos fechamentos reais. Sem emoji em imagem renderizada.
 */

import type { CommodityQuote } from '../tools/prices';
import { C, T, esc, cardShell, brandHeader, trendChip, sparkline, hairline, waCta, display, body, mono } from './render';

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
  const headerY = 78;
  const rowsTop = 136;
  const rowH = 112;
  const footY = rowsTop + rows.length * rowH + 16;
  const H = footY + 88;

  const body_ = rows
    .map((q, i) => {
      const top = rowsTop + i * rowH;
      const base = top + 50; // shared baseline: name + price
      const meta = NAME[q.key] ?? { name: q.label, sub: '' };
      const spark =
        q.series && q.series.length >= 3
          ? sparkline(
              330,
              top + 16,
              110,
              40,
              q.series,
              q.weekChangePct != null && q.weekChangePct < -0.05 ? C.nogo : C.folha
            )
          : '';
      return `
      ${body(M, base, meta.name, { size: 24, color: C.tinta, weight: 600 })}
      ${body(M, base + 26, meta.sub, { size: T.small, color: C.cinza })}
      ${spark}
      ${display(W - 196, base + 4, `R$ ${brl(q.sacaBrl)}`, 48, C.tinta, 'end')}
      ${trendChip(W - M, base + 16, q.weekChangePct)}
      ${i < rows.length - 1 ? hairline(M, W - M, top + rowH - 8) : ''}`;
    })
    .join('');

  const dolar = usdBrl != null ? `Dólar R$ ${brl(usdBrl)}  ·  ` : '';
  const dateW = 24 + dateLabel.length * 9.6;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${cardShell(W, H)}

  ${brandHeader(M, headerY, 'Bolsa hoje')}
  <rect x="${W - M - dateW}" y="${headerY - 22}" width="${dateW}" height="30" rx="15" fill="${C.creme2}"/>
  ${mono(W - M - dateW / 2, headerY - 1, dateLabel, { size: T.small - 1, color: C.tinta, anchor: 'middle' })}

  ${body_}

  ${hairline(M, W - M, footY)}
  ${body(M, footY + 32, `${dolar}futuros de bolsa — o físico brasileiro sai ABAIXO (indicador CEPEA/ESALQ)`, { size: T.small, color: C.cinza })}
  ${mono(M, footY + 58, waCta('cotação'), { size: T.small, color: C.tinta })}
  <desc>${esc(rows.map((q) => `${(NAME[q.key] ?? { name: q.label }).name} R$ ${brl(q.sacaBrl)}`).join(' · '))}</desc>
</svg>`;
}
