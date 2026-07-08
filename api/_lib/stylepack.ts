/**
 * Style pack: the hot-swappable voice layer (Layer 2 of the persona design,
 * .claude/plans/2026-07-08-stevi-voice-gym). The active pack's PT-BR voice
 * rules are appended to the base system prompt at runtime, cached in-memory
 * for a few minutes so a webhook burst costs one DB read, not N.
 *
 * Fail-soft by design: no pack / DB hiccup → base prompt only. The legal spine
 * (triage, anti-invention, LGPD) lives in the base prompt and compliance gate,
 * so a missing voice layer degrades style, never safety.
 */

import { getDb } from './db';
import { SYSTEM_PROMPT } from './prompts/system';
import { createLogger } from './logger';

const log = createLogger('stylepack');

const TTL_MS = 3 * 60_000;

let cache: { body: string | null; at: number } | null = null;

/** Compose base prompt + optional voice pack. Pure. */
export function composeSystem(base: string, pack: string | null): string {
  if (!pack || !pack.trim()) return base;
  return `${base}\n\n## Voz da Stevi (style pack — como falar, nunca o que afirmar)\n${pack.trim()}`;
}

type PackFetcher = () => Promise<string | null>;

async function fetchActivePack(): Promise<string | null> {
  const db = getDb();
  const { data, error } = await db
    .from('style_packs')
    .select('body')
    .eq('active', true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { body: string } | null)?.body ?? null;
}

/**
 * Active pack body, cached ~3 min. A failure caches null for the TTL too —
 * one bad window must not hammer the DB or delay farmer replies.
 * `fetcher`/`now` are injectable for tests.
 */
export async function getActiveStylePack(
  fetcher: PackFetcher = fetchActivePack,
  now: () => number = Date.now
): Promise<string | null> {
  if (cache && now() - cache.at < TTL_MS) return cache.body;
  try {
    cache = { body: await fetcher(), at: now() };
  } catch (e) {
    log.error('style pack load failed (voice degrades to base prompt):', (e as Error).message);
    cache = { body: null, at: now() };
  }
  return cache.body;
}

/** The full system prompt for farmer-facing generation: base + active voice. */
export async function steviSystemPrompt(): Promise<string> {
  return composeSystem(SYSTEM_PROMPT, await getActiveStylePack());
}

/** Test hook: clear the module cache between cases. */
export function resetStylePackCache(): void {
  cache = null;
}
