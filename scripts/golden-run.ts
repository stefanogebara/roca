/**
 * Golden-set eval CLI — accuracy as a number, on demand.
 *
 *   npm run golden                 # full set against the base prompt
 *   npm run golden -- --pack 3     # evaluate style pack v3 BEFORE activating it
 *   npm run golden -- --limit 10   # quick partial run
 *
 * Costs real LLM calls (~2 per reply case) — deliberately CLI/OS-triggered,
 * never a cron. Results land in golden_runs and show in /painel → Treino.
 */

import { readFileSync } from 'node:fs';
import { runGoldenEval } from '../api/_lib/gym/goldeneval';

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
  const args = process.argv.slice(2);
  const packArg = args.includes('--pack') ? Number(args[args.indexOf('--pack') + 1]) : null;
  const limitArg = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : undefined;
  if (limitArg !== undefined && (!Number.isFinite(limitArg) || limitArg <= 0)) {
    console.error('--limit precisa de um número > 0');
    process.exit(1);
  }

  let packOverride: string | null = null;
  if (packArg != null && Number.isFinite(packArg) && packArg > 0) {
    const { getDb } = await import('../api/_lib/db');
    const { data } = await getDb()
      .from('style_packs')
      .select('body')
      .eq('version', packArg)
      .maybeSingle();
    if (!data) {
      console.error(`style pack v${packArg} não encontrado`);
      process.exit(1);
    }
    packOverride = (data as { body: string }).body;
  }

  console.log(`\n🎯 Golden set${packArg ? ` · pack v${packArg}` : ' · prompt base'}${limitArg ? ` · ${limitArg} casos` : ''}\n`);
  const t0 = Date.now();
  const run = await runGoldenEval({ packVersion: packArg, packOverride, limit: limitArg });
  const secs = Math.round((Date.now() - t0) / 1000);

  console.log(`  resultado: ${run.passed}/${run.total} (${(run.rate * 100).toFixed(0)}%)`);
  console.log(`  reply: ${run.byMode.reply.passed}/${run.byMode.reply.total} · route: ${run.byMode.route.passed}/${run.byMode.route.total}`);
  if (run.errored > 0) {
    console.log(`  ⚠️ ${run.errored} caso(s) com ERRO de infra (contam como reprovados, mas não são regressão do modelo)`);
  }
  console.log(`  verificados por agrônomo: ${run.verifiedCases}/${run.total}${run.verifiedCases === 0 ? ' ⚠️ (peça pro Michel assinar os casos)' : ''}`);
  if (run.failures.length) {
    console.log('\n  reprovados:');
    for (const f of run.failures) console.log(`  ✗ ${f.id}: ${f.missed.join('; ').slice(0, 140)}`);
  }
  console.log(`\n  done in ${secs}s · gravado em golden_runs · veja em /painel → Treino\n`);
}

main().catch((e) => {
  console.error('golden run failed:', e);
  process.exit(1);
});
