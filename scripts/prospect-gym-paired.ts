/**
 * Juiz PAREADO do gym da Vitória — compara duas rodadas.
 *
 *   npm run gym:vitoria:paired                # as duas últimas rodadas
 *   npm run gym:vitoria:paired -- <idA> <idB> # rodadas específicas
 *
 * A é a mais ANTIGA, B a mais NOVA: "B venceu" significa que a mudança
 * melhorou. Rode o gym antes de mexer no prompt, mexa, rode de novo, e então
 * rode isto — é o único jeito de saber se a mudança ajudou ou só mudou.
 *
 * Por que não olhar as médias: a nota absoluta 1-5 varia ±1,4 no mesmo cenário
 * (medição do time da Olímpia). Uma diferença de 0,3 entre duas rodadas é ruído
 * com cara de sinal.
 */

import { readFileSync } from 'node:fs';

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

interface StoredRun {
  id: string;
  ran_at: string;
  verdicts: Array<{ persona: string; label: string; transcript: unknown[] }>;
  /** Onde vive o carimbo `invalida` — ver rodadaInvalida em gymPaired.ts. */
  medias?: { invalida?: string } | null;
}

async function carregar(ids: string[]): Promise<StoredRun[]> {
  const { getDb } = await import('../api/_lib/db');
  const { escolherPar } = await import('../api/_lib/prospect/gymPaired');
  const db = getDb();
  // `medias` entra no select porque é onde vive o carimbo de inválida — sem ele
  // o filtro não teria o que ler.
  const q = db.from('prospect_gym_runs').select('id, ran_at, verdicts, medias');
  // Sem ids, busca 10 e não 2: a inválida de 29/jul era uma das duas mais
  // recentes, e filtrar DEPOIS de um limit(2) deixaria uma só.
  const { data, error } = ids.length
    ? await q.in('id', ids)
    : await q.order('ran_at', { ascending: false }).limit(10);
  if (error) throw new Error(`não consegui ler prospect_gym_runs: ${error.message}`);
  return escolherPar((data ?? []) as StoredRun[]);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  // --personas=a,b recorta a comparação. Existe porque 13 cenários inertes
  // diluem uma mudança dirigida em ruído: em 29/jul o placar 5×9 "reverta a
  // mudança" saiu de um par de rodadas comportamentalmente idênticas, com o
  // veredito inteiro apoiado em cenários que a mudança nem tocava.
  const escopo = argv
    .filter((a) => a.startsWith('--personas='))
    .flatMap((a) => a.slice('--personas='.length).split(','))
    .map((x) => x.trim())
    .filter(Boolean);
  const ids = argv.filter((a) => !a.startsWith('--')).flatMap((a) => a.split(',')).map((s) => s.trim()).filter(Boolean);
  const [runA, runB] = await carregar(ids);
  const { runPairedGym, MARGEM_MINIMA } = await import('../api/_lib/prospect/gymPaired');
  const { PROSPECT_PERSONAS } = await import('../api/_lib/prospect/gym');

  console.log(`\n⚖️  Juiz pareado da Vitória`);
  console.log(`   A (antes):  ${runA.id}  ${runA.ran_at}`);
  console.log(`   B (depois): ${runB.id}  ${runB.ran_at}\n`);

  const t0 = Date.now();
  const noEscopo = (p: string) => escopo.length === 0 || escopo.includes(p);
  if (escopo.length) console.log(`   recorte: ${escopo.join(', ')}
`);
  const r = await runPairedGym(
    runA.verdicts.filter((v) => noEscopo(v.persona)).map((v) => ({ persona: v.persona, transcript: v.transcript as never })),
    runB.verdicts.filter((v) => noEscopo(v.persona)).map((v) => ({ persona: v.persona, transcript: v.transcript as never })),
    PROSPECT_PERSONAS
  );
  const secs = Math.round((Date.now() - t0) / 1000);

  for (const res of r.resultados) {
    const icone = res.vencedor === 'B' ? '🟢 B' : res.vencedor === 'A' ? '🔴 A' : '⚪ empate';
    console.log(`  ${res.persona}: ${icone}`);
    for (const v of res.votos) {
      console.log(`      ${v.lente.padEnd(13)} ${v.vencedor.padEnd(7)} ${v.motivo}`);
    }
  }

  const p = r.placar;
  console.log(`\n  PLACAR: B ${p.b} × ${p.a} A · ${p.empates} empate(s) em ${p.total} cenários`);
  if (r.ignoradas.length) {
    // Nunca deixar o truncamento silencioso: 4×2 em 6 personas é uma coisa,
    // 4×2 em 14 com 8 fora é outra bem diferente.
    console.log(`  ⚠️  fora do placar (só existiam numa rodada): ${r.ignoradas.join(', ')}`);
  }
  // Diferenciar "deu igual" de "a diferença cabe dentro do ruído": um controle
  // com código idêntico dos dois lados deu 6×5 em 30/jul. Quem lê um 6×5 sem
  // essa frase conclui que uma versão é melhor.
  const margem = Math.abs(p.a - p.b);
  const veredito =
    p.vencedor === 'B'
      ? '✅ a rodada NOVA é melhor — mudança vale a pena'
      : p.vencedor === 'A'
        ? '❌ a rodada ANTIGA era melhor — reverta a mudança'
        : margem > 0
          ? `⚪ inconclusivo — margem ${margem} está dentro do ruído (piso: ${MARGEM_MINIMA})`
          : '⚪ empate — sem sinal pra promover nada';
  console.log(`  ${veredito}`);

  // Persistir SÓ comparações completas: um recorte --personas gravado como
  // rodada normal viraria um placar de 3 cenários com cara de 14 no painel.
  if (escopo.length === 0) {
    const { savePairedRun } = await import('../api/_lib/prospect/gymPaired');
    const { getDb } = await import('../api/_lib/db');
    const ok = await savePairedRun(getDb(), runA.id, runB.id, r);
    console.log(ok ? '  stored in prospect_gym_paired_runs · view in /painel → Treino' : '  ⚠️  não gravou no banco — placar só neste terminal');
  } else {
    console.log('  (recorte --personas: não gravado no banco de propósito)');
  }
  console.log(`  done in ${secs}s\n`);
}

main().catch((e) => {
  console.error('paired gym failed:', e);
  process.exit(1);
});
