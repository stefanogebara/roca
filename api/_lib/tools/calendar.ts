/**
 * Vazio sanitário da soja — 2026/2027 season windows per UF.
 *
 * Source: Portaria SDA/MAPA nº 1.579, de 09/04/2026 (PDF via EMBRAPA; raw text
 * kept at knowledge/portaria-sda-mapa-1579-2026.txt). Dates change EVERY season
 * by portaria — this table must be refreshed yearly (Stage 2 daily monitor).
 *
 * States where the portaria subdivides by region carry `regional: true` and an
 * envelope window (earliest start → latest end across regions); replies must
 * hedge and point at the portaria rather than assert one date.
 */

export interface VazioWindow {
  /** ISO dates, inclusive. */
  start: string;
  end: string;
  /** True when the UF has per-region windows; dates are the envelope. */
  regional: boolean;
}

export const VAZIO_SOJA_2026: Record<string, VazioWindow> = {
  AC: { start: '2026-06-22', end: '2026-09-20', regional: false },
  AM: { start: '2026-06-10', end: '2026-09-10', regional: false },
  BA: { start: '2026-06-14', end: '2026-10-07', regional: true },
  DF: { start: '2026-07-01', end: '2026-09-30', regional: false },
  GO: { start: '2026-06-27', end: '2026-09-24', regional: false },
  MA: { start: '2026-07-03', end: '2026-10-31', regional: true },
  MG: { start: '2026-07-01', end: '2026-09-30', regional: false },
  MT: { start: '2026-06-08', end: '2026-09-06', regional: false },
  MS: { start: '2026-06-15', end: '2026-09-15', regional: false },
  PR: { start: '2026-06-02', end: '2026-09-19', regional: true },
  PI: { start: '2026-07-01', end: '2026-10-31', regional: true },
  RJ: { start: '2026-06-15', end: '2026-09-28', regional: false },
  RS: { start: '2026-07-03', end: '2026-09-30', regional: false },
  RO: { start: '2026-06-10', end: '2026-09-10', regional: false },
  SC: { start: '2026-06-01', end: '2026-09-15', regional: true },
  SP: { start: '2026-06-13', end: '2026-10-12', regional: true },
  TO: { start: '2026-07-01', end: '2026-09-30', regional: false },
};

const SOURCE_LINE = 'Portaria SDA/MAPA nº 1.579/2026';

export interface VazioStatus {
  known: boolean;
  active: boolean;
  /** WhatsApp-ready PT-BR line, or null when we know nothing for the UF. */
  line: string | null;
}

function fmt(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];
  return `${d.toString().padStart(2, '0')}/${months[m - 1]}`.replace('/', ' de ') + (y !== 2026 ? ` de ${y}` : '');
}

/**
 * Vazio sanitário status for a UF at a date. Only speaks when the window is in
 * the grounded table; regional states get an honest hedge, unknown UFs get null.
 */
export function vazioStatus(uf: string | null, date: Date): VazioStatus {
  const w = uf ? VAZIO_SOJA_2026[uf.toUpperCase()] : undefined;
  if (!w) return { known: false, active: false, line: null };

  const iso = date.toISOString().slice(0, 10);
  const active = iso >= w.start && iso <= w.end;

  if (w.regional) {
    const line = active
      ? `⚠️ No seu estado o vazio sanitário da soja varia por região — a janela geral vai de ${fmt(w.start)} a ${fmt(w.end)} (${SOURCE_LINE}). Nesse período, nada de soja viva no campo (nem guaxa). Confirme a data exata da sua região com seu agrônomo ou na portaria.`
      : null;
    return { known: true, active, line };
  }

  const line = active
    ? `⚠️ Seu estado está em vazio sanitário da soja até ${fmt(w.end)} (${SOURCE_LINE}): nenhuma planta viva de soja no campo, inclusive guaxa. Isso corta a ponte da ferrugem pra próxima safra.`
    : `📅 Vazio sanitário da soja no seu estado: ${fmt(w.start)} a ${fmt(w.end)} (${SOURCE_LINE}).`;
  return { known: true, active, line };
}

export interface CalendarTransition {
  uf: string;
  kind: 'vazio_start' | 'vazio_end';
  date: string;
  daysAway: number;
}

function daysBetween(fromIso: string, toIso: string): number {
  const ms = Date.parse(toIso) - Date.parse(fromIso);
  return Math.round(ms / 86_400_000);
}

/**
 * Vazio sanitário transitions (start or end) falling within `withinDays` of the
 * given date, across all grounded UFs. Feeds the daily monitor: a vazio ending
 * soon means planting opens (proactive-alert opportunity); one starting soon
 * means "clear volunteer soy now".
 */
export function upcomingTransitions(date: Date, withinDays = 7): CalendarTransition[] {
  const today = date.toISOString().slice(0, 10);
  const out: CalendarTransition[] = [];
  for (const [uf, w] of Object.entries(VAZIO_SOJA_2026)) {
    for (const [kind, d] of [
      ['vazio_start', w.start],
      ['vazio_end', w.end],
    ] as const) {
      const daysAway = daysBetween(today, d);
      if (daysAway >= 0 && daysAway <= withinDays) {
        out.push({ uf, kind, date: d, daysAway });
      }
    }
  }
  return out.sort((a, b) => a.daysAway - b.daysAway);
}

/**
 * Heuristic: if `date` is past the latest vazio end across all states, the
 * grounded 2026/27 windows are stale and a new season portaria likely exists —
 * the monitor should flag "refresh the knowledge base".
 */
export function isCalendarStale(date: Date): boolean {
  const iso = date.toISOString().slice(0, 10);
  const latestEnd = Object.values(VAZIO_SOJA_2026)
    .map((w) => w.end)
    .sort()
    .at(-1)!;
  // Give a season's grace: stale only once we're ~2 months past the last window.
  return daysBetween(latestEnd, iso) > 60;
}
