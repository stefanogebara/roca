/**
 * Delta T spray-window logic.
 *
 * Delta T = dry-bulb temperature − wet-bulb temperature. It predicts how fast a
 * spray droplet evaporates between nozzle and leaf. Together with wind (drift)
 * and rain (wash-off) it answers "posso pulverizar agora?".
 *
 * Pure functions only — no I/O. The Open-Meteo fetch lives in weather.ts so this
 * file stays unit-testable and deterministic.
 */

/** A single hour of weather relevant to spraying. */
export interface HourWeather {
  /** ISO local time, e.g. "2026-07-07T14:00". */
  time: string;
  /** Dry-bulb air temperature, °C. */
  tempC: number;
  /** Relative humidity, %. */
  humidity: number;
  /** Wind speed, km/h. */
  windKmh: number;
  /** Precipitation probability, % (0–100). May be undefined if unavailable. */
  precipProb?: number;
}

export type SprayVerdict = 'go' | 'caution' | 'no-go';

export interface HourAssessment {
  time: string;
  deltaT: number;
  windKmh: number;
  precipProb?: number;
  verdict: SprayVerdict;
  reasons: string[];
}

/**
 * Wet-bulb temperature via the Stull (2011) empirical formula.
 * Valid roughly for RH 5–99% and T −20…50 °C — the field range that matters here.
 * Returns °C.
 */
export function wetBulbC(tempC: number, humidity: number): number {
  const rh = Math.min(100, Math.max(1, humidity));
  const t = tempC;
  return (
    t * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
    Math.atan(t + rh) -
    Math.atan(rh - 1.676331) +
    0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) -
    4.686035
  );
}

/** Delta T in °C from temperature and relative humidity. */
export function deltaT(tempC: number, humidity: number): number {
  return tempC - wetBulbC(tempC, humidity);
}

// Thresholds. Delta T favourable window is ~2–8 °C (EMBRAPA/Brazilian extension
// guidance). Wind: drift risk climbs above ~10 km/h, unacceptable above ~15.
const DELTA_T_MIN = 2;
const DELTA_T_MAX = 8;
const DELTA_T_HARD_MAX = 10;
const WIND_CAUTION = 10;
const WIND_MAX = 15;
const RAIN_CAUTION = 40;
const RAIN_MAX = 70;

/** Assess a single hour into go / caution / no-go with plain-language reasons. */
export function assessHour(h: HourWeather): HourAssessment {
  const dt = deltaT(h.tempC, h.humidity);
  const reasons: string[] = [];
  let verdict: SprayVerdict = 'go';

  const worsen = (to: SprayVerdict) => {
    const rank = { go: 0, caution: 1, 'no-go': 2 } as const;
    if (rank[to] > rank[verdict]) verdict = to;
  };

  // Delta T
  if (dt < DELTA_T_MIN) {
    worsen('caution');
    reasons.push(
      `Delta T ${dt.toFixed(1)} °C está baixo: gota seca devagar, risco de escorrimento e doença.`
    );
  } else if (dt > DELTA_T_HARD_MAX) {
    worsen('no-go');
    reasons.push(
      `Delta T ${dt.toFixed(1)} °C está muito alto: a gota evapora antes de chegar na folha e deriva pro vizinho.`
    );
  } else if (dt > DELTA_T_MAX) {
    worsen('caution');
    reasons.push(
      `Delta T ${dt.toFixed(1)} °C está no limite alto: perde eficiência, atenção à deriva.`
    );
  }

  // Wind
  if (h.windKmh > WIND_MAX) {
    worsen('no-go');
    reasons.push(`Vento ${h.windKmh.toFixed(0)} km/h: forte demais, deriva quase certa.`);
  } else if (h.windKmh > WIND_CAUTION) {
    worsen('caution');
    reasons.push(`Vento ${h.windKmh.toFixed(0)} km/h: no limite, cuidado com a deriva.`);
  }

  // Rain
  if (h.precipProb != null) {
    if (h.precipProb >= RAIN_MAX) {
      worsen('no-go');
      reasons.push(`Chance de chuva ${h.precipProb}%: pode lavar o produto da folha.`);
    } else if (h.precipProb >= RAIN_CAUTION) {
      worsen('caution');
      reasons.push(`Chance de chuva ${h.precipProb}%: fique de olho no tempo.`);
    }
  }

  if (verdict === 'go' && reasons.length === 0) {
    reasons.push(`Delta T ${dt.toFixed(1)} °C, vento fraco: janela boa pra pulverizar.`);
  }

  return {
    time: h.time,
    deltaT: Number(dt.toFixed(1)),
    windKmh: h.windKmh,
    precipProb: h.precipProb,
    verdict,
    reasons,
  };
}

export interface SprayWindow {
  now: HourAssessment;
  /** Best upcoming 'go' hour today, if the current hour isn't already good. */
  bestUpcoming: HourAssessment | null;
}

/**
 * Given the current hour and the rest of today's hours, produce a go/no-go for
 * now plus the next favourable window if now isn't ideal.
 * `hours[0]` is treated as "now".
 */
export function sprayWindow(hours: HourWeather[]): SprayWindow {
  if (hours.length === 0) {
    throw new Error('sprayWindow requires at least one hour of weather');
  }
  const assessed = hours.map(assessHour);
  const now = assessed[0];

  let bestUpcoming: HourAssessment | null = null;
  if (now.verdict !== 'go') {
    bestUpcoming = assessed.slice(1).find((a) => a.verdict === 'go') ?? null;
  }

  return { now, bestUpcoming };
}
