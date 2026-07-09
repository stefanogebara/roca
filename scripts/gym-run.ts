/**
 * Gym CLI runner (Phase B). Runs an A/B voice training round and stores it.
 *
 *   npm run gym -- <champion> <challenger> [personaKey,persona2,...]
 *   npm run gym -- 1 2                 # champion v1 vs challenger v2, all personas
 *   npm run gym -- 1 0 perigoso-dose   # v1 vs base prompt, one persona
 *
 * Loads .env manually (no dotenv dep). Long-running by design — this is why the
 * gym is CLI-triggered, not a web request. Results land in the `gym_runs` table
 * and show up in the /painel Treino tab.
 */

import { readFileSync } from 'node:fs';
import { runGym } from '../api/_lib/gym/runner';

// Load .env into process.env (the app reads env lazily).
try {
  for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0 && !line.trimStart().startsWith('#')) {
      const k = line.slice(0, i).trim();
      if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
    }
  }
} catch {
  /* no .env — rely on ambient env */
}

async function main(): Promise<void> {
  const [championArg, challengerArg, personasArg] = process.argv.slice(2);
  if (championArg == null || challengerArg == null) {
    console.error('usage: npm run gym -- <champion> <challenger> [personaKey,...]');
    process.exit(1);
  }
  const champion = Number(championArg);
  const challenger = Number(challengerArg);
  const personaKeys = personasArg ? personasArg.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

  console.log(`\n🥊 Gym: champion v${champion} vs challenger v${challenger}${personaKeys ? ' · ' + personaKeys.join(', ') : ' · all personas'}\n`);
  const t0 = Date.now();
  const r = await runGym(champion, challenger, { personaKeys });
  const secs = Math.round((Date.now() - t0) / 1000);

  for (const v of r.personaVerdicts) {
    const flag = v.safety.B ? ' ⚠️ challenger safety violation' : v.safety.A ? ' ⚠️ champion safety violation' : '';
    console.log(`  ${v.winner === 'A' ? 'champion' : v.winner === 'B' ? 'CHALLENGER' : 'tie'}  ${v.persona}${flag}`);
  }
  console.log(`\n  tally — champion ${r.tally.A} · challenger ${r.tally.B} · tie ${r.tally.tie}`);
  console.log(`  → recommended: v${r.recommended} (${r.recommendedReason})`);
  console.log(`\n  done in ${secs}s · stored in gym_runs · view in /painel → Treino\n`);
}

main().catch((e) => {
  console.error('gym run failed:', e);
  process.exit(1);
});
