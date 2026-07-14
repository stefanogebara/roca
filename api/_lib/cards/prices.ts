/**
 * Price card: the day's cotações as a shareable image. Prices are the
 * highest-frequency habit intent and the most forwarded content in rural
 * WhatsApp groups — this card is the product's organic distribution surface,
 * so it carries the Stevi identity and reads at arm's length.
 */

import type { CommodityQuote } from '../tools/prices';
import { C, esc } from './render';

const W = 900;
const H = 520;

const EMOJI_LABEL: Record<CommodityQuote['key'], string> = {
  cafe: 'Café arábica',
  soja: 'Soja',
  milho: 'Milho',
};

function brl(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function trend(weekChangePct: number | null): { mark: string; color: string; label: string } {
  if (weekChangePct == null) return { mark: '', color: C.muted, label: '' };
  const pct = `${Math.abs(weekChangePct).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  if (weekChangePct > 0.05) return { mark: '▲', color: C.go, label: `+${pct} na semana` };
  if (weekChangePct < -0.05) return { mark: '▼', color: C.nogo, label: `-${pct} na semana` };
  return { mark: '—', color: C.muted, label: 'estável na semana' };
}

/** Build the price-card SVG. Pure. */
export function pricesSvg(
  quotes: CommodityQuote[],
  usdBrl: number | null,
  dateLabel: string
): string {
  const rows = quotes.slice(0, 3);
  const rowH = 92;
  const startY = 170;

  const body = rows
    .map((q, i) => {
      const y = startY + i * rowH;
      const t = trend(q.weekChangePct);
      return `
      <text x="64" y="${y}" font-family="DM Sans" font-size="30" font-weight="700" fill="${C.ink}">${esc(EMOJI_LABEL[q.key] ?? q.label)}</text>
      <text x="64" y="${y + 32}" font-family="DM Sans" font-size="20" fill="${C.muted}">${esc(q.label)}</text>
      <text x="${W - 260}" y="${y + 8}" font-family="Instrument Serif" font-size="44" fill="${C.green}" text-anchor="end">R$ ${brl(q.sacaBrl)}</text>
      <text x="${W - 260}" y="${y + 34}" font-family="DM Sans" font-size="18" fill="${C.muted}" text-anchor="end">por saca 60 kg</text>
      <text x="${W - 64}" y="${y + 8}" font-family="DM Sans" font-size="26" font-weight="700" fill="${t.color}" text-anchor="end">${t.mark}</text>
      <text x="${W - 64}" y="${y + 34}" font-family="DM Sans" font-size="17" fill="${t.color}" text-anchor="end">${esc(t.label)}</text>`;
    })
    .join('');

  const footer = usdBrl
    ? `Dólar R$ ${brl(usdBrl)} · mercado internacional convertido, valores de referência (defasados)`
    : 'Mercado internacional convertido, valores de referência (defasados)';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.cream}"/>
  <rect x="24" y="24" width="${W - 48}" height="${H - 48}" rx="24" fill="${C.card}" stroke="${C.line}" stroke-width="2"/>

  <text x="64" y="92" font-family="DM Sans" font-size="26" font-weight="700" fill="${C.muted}">Stevi · Cotações de hoje (${esc(dateLabel)})</text>

  ${body}

  <text x="64" y="${H - 70}" font-family="DM Sans" font-size="19" fill="${C.green2}">${esc(footer)}</text>
  <text x="64" y="${H - 40}" font-family="DM Sans" font-size="18" fill="${C.muted}">Quer todo dia? Manda "cotação" pra Stevi no WhatsApp. 🌱</text>
</svg>`;
}
