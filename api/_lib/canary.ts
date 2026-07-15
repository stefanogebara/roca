/**
 * Daily production canary — the "did anything quietly break?" sweep, run from
 * the monitor cron (no extra invocation). Checks the things this system can
 * lose silently: Meta can pause a template any day (dispatch would just skip),
 * a renamed OpenRouter slug turns every farmer reply into the fallback, and
 * the keyless tool APIs (Open-Meteo, SoilGrids, STAC/titiler, Yahoo) degrade
 * tools without an error surfacing anywhere.
 *
 * Anti-noise by design: results persist to canary_runs and founders are
 * alerted ONLY on transitions — newly broken or recovered. A check that's
 * been red for a week doesn't page every morning; the monitor_runs findings
 * still record the standing state. Probes retry once to damp provider flap.
 */

import { getDb } from './db';
import { withRetry } from './retry';
import { chat } from './llm';
import { MODELS } from './env';
import { FALLBACK_REPLY } from './pipeline';
import { agrofitAgeDays, AGROFIT_MAX_AGE_DAYS, AGROFIT_GENERATED_AT } from './tools/agrofit';
import { alertFounders } from './alert';
import { createLogger } from './logger';

const log = createLogger('canary');

const PROBE_TIMEOUT_MS = 8000;
const LLM_PING_TIMEOUT_MS = 10_000;
const PUBLIC_BASE = process.env.PUBLIC_BASE_URL || 'https://roca-black.vercel.app';

export interface CanaryCheck {
  check: string;
  ok: boolean;
  detail: string | null;
}

export interface CanaryDiff {
  broke: CanaryCheck[];
  recovered: CanaryCheck[];
}

// ── Pure logic (tested) ──────────────────────────────────────────────────────

/**
 * Transitions between two runs. A check missing from the previous run counts
 * as previously-ok, so a brand-new failing check alerts (new information) and
 * the very first run alerts its failures — they're real, not baseline noise.
 */
export function diffCanary(prev: CanaryCheck[] | null, curr: CanaryCheck[]): CanaryDiff {
  const prevOk = new Map((prev ?? []).map((c) => [c.check, c.ok]));
  return {
    broke: curr.filter((c) => !c.ok && (prevOk.get(c.check) ?? true)),
    recovered: curr.filter((c) => c.ok && prevOk.get(c.check) === false),
  };
}

/** Founder alert text for a transition set; null when nothing changed. */
export function formatCanaryAlert(diff: CanaryDiff): string | null {
  if (!diff.broke.length && !diff.recovered.length) return null;
  const parts: string[] = [];
  if (diff.broke.length) {
    const items = diff.broke.map((c) => `${c.check}${c.detail ? ` (${c.detail})` : ''}`);
    parts.push(`🐤 Canário: quebrou desde ontem → ${items.join('; ')}`);
  }
  if (diff.recovered.length) {
    parts.push(`✅ Voltou ao normal: ${diff.recovered.map((c) => c.check).join('; ')}`);
  }
  return parts.join('\n');
}

/**
 * Elevated-fallback verdict: 3+ fallback replies AND >20% of the day's
 * outbound is the signature of a dead model slug / provider outage. A couple
 * of fallbacks on a busy day is normal life.
 */
export function fallbackVerdict(fallbackCount: number, totalOut: number): CanaryCheck {
  const ok = !(fallbackCount >= 3 && totalOut > 0 && fallbackCount / totalOut > 0.2);
  return {
    check: 'taxa de fallback (24h)',
    ok,
    detail: totalOut > 0 ? `${fallbackCount} de ${totalOut} respostas` : null,
  };
}

// ── Probes (I/O, each bounded + retried once) ────────────────────────────────

async function fetchOnce(url: string, headers?: Record<string, string>): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    return res.status;
  } finally {
    clearTimeout(timer);
  }
}

async function probe(
  name: string,
  url: string,
  opts: { okWhen?: (status: number) => boolean; headers?: Record<string, string> } = {}
): Promise<CanaryCheck> {
  const okWhen = opts.okWhen ?? ((s: number) => s >= 200 && s < 300);
  try {
    const status = await withRetry(() => fetchOnce(url, opts.headers), {
      attempts: 2,
      baseDelayMs: 300,
      shouldRetry: () => true, // probes retry on anything — damps provider flap
    });
    return { check: name, ok: okWhen(status), detail: okWhen(status) ? null : `HTTP ${status}` };
  } catch (e) {
    return { check: name, ok: false, detail: (e as Error).message.slice(0, 60) };
  }
}

function externalProbes(): Array<Promise<CanaryCheck>> {
  const anyResponse = (s: number) => s < 500; // host alive, path shape irrelevant
  return [
    probe(
      'open-meteo',
      'https://api.open-meteo.com/v1/forecast?latitude=-21.55&longitude=-45.43&hourly=temperature_2m&forecast_days=1'
    ),
    probe(
      'soilgrids',
      'https://rest.isric.org/soilgrids/v2.0/properties/query?lon=-45.43&lat=-21.55&property=phh2o&depth=0-5cm&value=mean'
    ),
    probe('stac-sentinel2', 'https://earth-search.aws.element84.com/v1'),
    probe('titiler', 'https://titiler.xyz/healthz', { okWhen: anyResponse }),
    probe(
      'yahoo-cotações',
      'https://query1.finance.yahoo.com/v8/finance/chart/BRL=X?range=1d&interval=1d',
      { headers: { 'User-Agent': 'Mozilla/5.0' } } // same UA the prices tool sends
    ),
    probe('landing', `${PUBLIC_BASE}/`),
    probe('painel', `${PUBLIC_BASE}/painel`),
    // Any non-5xx proves the function deploys and answers (GET without a
    // signature legitimately 403s).
    probe('webhook', `${PUBLIC_BASE}/api/webhook`, { okWhen: anyResponse }),
  ];
}

/**
 * The number's Meta quality rating — the actual ban precursor. Blocks/reports
 * never show up as opt-outs or delivery failures (a blocker doesn't reply
 * SAIR), so the thermometer can read healthy while Meta's score dies. This is
 * the earliest alarm available. Env-gated like the template checks.
 */
async function numberQualityCheck(): Promise<CanaryCheck[]> {
  const token = process.env.WHATSAPP_CLOUD_TOKEN;
  const phoneId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;
  if (!token || !phoneId) return [];
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}?fields=quality_rating,messaging_limit_tier,name_status`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) }
    );
    const data = (await res.json()) as {
      quality_rating?: string;
      messaging_limit_tier?: string;
      name_status?: string;
      error?: { message?: string };
    };
    if (data.error) {
      return [{ check: 'qualidade do número (Meta)', ok: false, detail: (data.error.message ?? 'erro').slice(0, 80) }];
    }
    const rating = (data.quality_rating ?? 'UNKNOWN').toUpperCase();
    // GREEN is healthy; UNKNOWN means Meta hasn't scored yet (fresh number) —
    // not an alarm. YELLOW/RED/FLAGGED/RESTRICTED are exactly the alarm.
    const ok = rating === 'GREEN' || rating === 'UNKNOWN';
    const bits = [rating];
    if (data.messaging_limit_tier) bits.push(`tier ${data.messaging_limit_tier}`);
    return [{ check: 'qualidade do número (Meta)', ok, detail: ok ? bits.join(' · ') : bits.join(' · ') }];
  } catch (e) {
    return [{ check: 'qualidade do número (Meta)', ok: false, detail: (e as Error).message.slice(0, 60) }];
  }
}

async function templateChecks(): Promise<CanaryCheck[]> {
  // Env-gated: without the Cloud token the check can never pass — omit rather
  // than alarm forever in a sandbox-only environment.
  if (!process.env.WHATSAPP_CLOUD_TOKEN) return [];
  const names = [
    process.env.PROSPECT_TEMPLATE_NAME || 'stevi_parceria_v1',
    process.env.PROSPECT_BUMP_TEMPLATE_NAME || 'stevi_parceria_bump',
    'stevi_lead_v1',
  ];
  const { getTemplateStatus } = await import('./prospect/template');
  return Promise.all(
    names.map(async (name): Promise<CanaryCheck> => {
      try {
        const st = await getTemplateStatus(name);
        return {
          check: `template ${name}`,
          ok: st?.status === 'APPROVED',
          detail: st?.status === 'APPROVED' ? null : (st?.status ?? 'inexistente'),
        };
      } catch (e) {
        return { check: `template ${name}`, ok: false, detail: (e as Error).message.slice(0, 60) };
      }
    })
  );
}

function modelChecks(): Array<Promise<CanaryCheck>> {
  if (!process.env.OPENROUTER_API_KEY) return [];
  const tiers: Array<[string, string]> = [
    ['modelo router', MODELS.router()],
    ['modelo reasoning', MODELS.reasoning()],
    ['modelo transcribe', MODELS.transcribe()],
  ];
  return tiers.map(async ([label, slug]): Promise<CanaryCheck> => {
    try {
      // chat() has no deadline of its own — race it so one hung provider
      // can't stall the whole canary inside the cron budget.
      const reply = await Promise.race([
        chat({ model: slug, maxTokens: 8, system: 'Responda apenas: ok', user: 'ping' }),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error('ping timeout')), LLM_PING_TIMEOUT_MS)
        ),
      ]);
      return { check: `${label} (${slug})`, ok: reply.trim().length > 0, detail: null };
    } catch (e) {
      return { check: `${label} (${slug})`, ok: false, detail: (e as Error).message.slice(0, 60) };
    }
  });
}

async function fallbackRateCheck(): Promise<CanaryCheck> {
  try {
    const db = getDb();
    const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
    const prefix = FALLBACK_REPLY.slice(0, 30);
    const [total, fallbacks] = await Promise.all([
      db
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('direction', 'out')
        .gte('created_at', since),
      db
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('direction', 'out')
        .gte('created_at', since)
        .ilike('raw', `${prefix}%`),
    ]);
    if (total.error || fallbacks.error) {
      return { check: 'taxa de fallback (24h)', ok: false, detail: 'consulta indisponível' };
    }
    return fallbackVerdict(fallbacks.count ?? 0, total.count ?? 0);
  } catch (e) {
    return { check: 'taxa de fallback (24h)', ok: false, detail: (e as Error).message.slice(0, 60) };
  }
}

// ── Orchestration ────────────────────────────────────────────────────────────

export interface CanaryRun {
  results: CanaryCheck[];
  broke: CanaryCheck[];
  recovered: CanaryCheck[];
  failing: number;
}

/** Run every check in parallel, diff against the previous run, persist, and
 * alert founders on transitions only. Never throws — the monitor stage wraps
 * it anyway, but a canary must not take the cron down. */
/**
 * Registry-snapshot freshness. A stale (or unstamped) agrofit.json makes the
 * compliance gate blind to newly-registered actives and shows farmers an
 * out-of-date "registrado" — a slow, silent drift no other check catches.
 * Synchronous (the date is bundled); exported for tests.
 */
export function agrofitFreshnessCheck(now: Date = new Date()): CanaryCheck {
  const age = agrofitAgeDays(now);
  if (age == null) {
    return { check: 'agrofit snapshot', ok: false, detail: 'sem data — rode scripts/agrofit-extract' };
  }
  const ok = age <= AGROFIT_MAX_AGE_DAYS;
  return {
    check: 'agrofit snapshot',
    ok,
    detail: ok ? `${age}d (${AGROFIT_GENERATED_AT})` : `${age}d — rode scripts/agrofit-extract`,
  };
}

export async function runCanary(): Promise<CanaryRun> {
  const results = (
    await Promise.all([
      Promise.all(externalProbes()),
      templateChecks(),
      numberQualityCheck(),
      Promise.all(modelChecks()),
      fallbackRateCheck().then((c) => [c]),
      Promise.resolve([agrofitFreshnessCheck()]),
    ])
  ).flat();

  let prev: CanaryCheck[] | null = null;
  try {
    const db = getDb();
    const { data } = await db
      .from('canary_runs')
      .select('results')
      .order('ran_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    prev = ((data as { results?: CanaryCheck[] } | null)?.results ?? null) as CanaryCheck[] | null;
  } catch (e) {
    log.error('previous canary load failed (diffing against nothing):', (e as Error).message);
  }

  const diff = diffCanary(prev, results);

  try {
    const db = getDb();
    const { error } = await db.from('canary_runs').insert({ results });
    if (error) log.error('canary persist failed:', error.message);
  } catch (e) {
    log.error('canary persist failed:', (e as Error).message);
  }

  const alertText = formatCanaryAlert(diff);
  if (alertText) {
    try {
      await alertFounders(alertText);
    } catch (e) {
      log.error('canary alert failed:', (e as Error).message);
    }
  }

  const failing = results.filter((c) => !c.ok).length;
  log.info(
    `canary: ${results.length - failing}/${results.length} ok` +
      (diff.broke.length ? ` — broke: ${diff.broke.map((c) => c.check).join(', ')}` : '')
  );
  return { results, broke: diff.broke, recovered: diff.recovered, failing };
}
