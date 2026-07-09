/**
 * Gym orchestrator (Phase B). For a champion vs challenger style-pack pair:
 * run every persona against BOTH packs (real brain, zero side effects), judge
 * each pair (3-lens + safety veto), resolve a recommendation, and persist the
 * run to `gym_runs` so the ops console can show history + champion lineage.
 *
 * Runs make many LLM calls, so this is CLI-triggered (scripts/gym-run.ts), not
 * a web request — same shape as Seatable's gym runners.
 */

import { getDb } from '../db';
import { PERSONAS } from './personas';
import { simulate } from './sim';
import { judgePair, resolveRun } from './judge';
import type { GymRunResult, PairedVerdict, SimTranscript, Persona } from './types';
import { createLogger } from '../logger';

const log = createLogger('gym-runner');

/** Pack body for a version: 0 → null (base prompt only); else from style_packs. */
export async function loadPackBody(version: number): Promise<string | null> {
  if (!version) return null;
  const db = getDb();
  const { data, error } = await db
    .from('style_packs')
    .select('body')
    .eq('version', version)
    .maybeSingle();
  if (error || !data) throw new Error(`style pack v${version} not found`);
  return (data as { body: string }).body;
}

/** Run tasks with bounded concurrency (gentle on the LLM API). */
async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export interface GymRunOutput extends GymRunResult {
  transcripts: SimTranscript[];
}

/**
 * Execute an A/B gym run. `personaKeys` optionally restricts which personas run
 * (default: all). Concurrency kept modest so a run doesn't storm OpenRouter.
 */
export async function runGym(
  champion: number,
  challenger: number,
  opts: { personaKeys?: string[]; concurrency?: number; maxTurns?: number; persist?: boolean } = {}
): Promise<GymRunOutput> {
  const personas: Persona[] = opts.personaKeys?.length
    ? PERSONAS.filter((p) => opts.personaKeys!.includes(p.key))
    : PERSONAS;
  if (!personas.length) throw new Error('no personas selected');

  const [champBody, challBody] = await Promise.all([loadPackBody(champion), loadPackBody(challenger)]);

  const transcripts: SimTranscript[] = [];
  const verdicts = await mapLimit(personas, opts.concurrency ?? 3, async (persona) => {
    const [a, b] = await Promise.all([
      simulate(persona, champion, champBody, { maxTurns: opts.maxTurns }),
      simulate(persona, challenger, challBody, { maxTurns: opts.maxTurns }),
    ]);
    transcripts.push(a, b);
    const v = await judgePair(a, b, persona);
    log.info(`judged ${persona.key}: winner ${v.winner}${v.safety.B ? ' (challenger safety violation!)' : ''}`);
    return v;
  });

  const result = resolveRun(champion, challenger, verdicts as PairedVerdict[]);
  const output: GymRunOutput = { ...result, transcripts };

  if (opts.persist !== false) {
    try {
      const db = getDb();
      const { error } = await db.from('gym_runs').insert({
        champion,
        challenger,
        tally: result.tally,
        recommended: result.recommended,
        reason: result.recommendedReason,
        verdicts: result.personaVerdicts,
        transcripts,
      });
      if (error) log.error('gym_runs insert failed:', error.message);
    } catch (e) {
      log.error('gym persistence failed:', (e as Error).message);
    }
  }

  return output;
}
