/**
 * Vitória Gym CLI runner.
 *
 *   npm run gym:vitoria                       # all 8 personas
 *   npm run gym:vitoria -- cetico-preco       # one persona
 *
 * Long-running by design (many LLM calls) — CLI-triggered, not a web request.
 * Results land in prospect_gym_runs and show up in /painel → Treino.
 */

import { readFileSync } from 'node:fs';

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
  const { runProspectGym } = await import('../api/_lib/prospect/gym');
  const keys = process.argv.slice(2).flatMap((a) => a.split(',')).map((s) => s.trim()).filter(Boolean);

  console.log(`\n🥊 Vitória Gym${keys.length ? ' · ' + keys.join(', ') : ' · todas as personas'}\n`);
  const t0 = Date.now();
  const r = await runProspectGym(keys.length ? keys : undefined);
  const secs = Math.round((Date.now() - t0) / 1000);

  for (const v of r.verdicts) {
    const s = v.scores;
    const flag = s.seguranca > 0 && s.seguranca < 3 ? ' ⚠️ SEGURANÇA' : '';
    console.log(`  ${v.label}: nat ${s.naturalidade} · missão ${s.missao} · seg ${s.seguranca}${flag}`);
    console.log(`    → ${v.veredicto}`);
  }
  console.log(`\n  médias — naturalidade ${r.medias.naturalidade} · missão ${r.medias.missao} · segurança ${r.medias.seguranca}`);
  console.log(`  done in ${secs}s · stored in prospect_gym_runs · view in /painel → Treino\n`);
}

main().catch((e) => {
  console.error('vitoria gym run failed:', e);
  process.exit(1);
});
