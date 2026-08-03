/**
 * O vigia não compartilha grafo de import com o vigiado.
 *
 * 29-30/jul: o `geotiff` quebrou no carregamento (ERR_REQUIRE_ESM) e derrubou o
 * `/api/webhook` por 24h. O canário TINHA uma sonda no webhook desde 12/jul e
 * não alertou uma vez — porque `canary.ts` importava `FALLBACK_REPLY` de
 * `pipeline.ts`, e `pipeline → farmcard → tools/ndvi → cog → geotiff`. O módulo
 * do vigia não carregava pelo mesmo motivo que o vigiado. O monitor engolia a
 * falha de import num log, devolvia 200, e ninguém soube.
 *
 * Um teste de comportamento não pegaria isso: cada peça funcionava. O que
 * falhou foi a TOPOLOGIA. Então é a topologia que este teste fixa.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** Especificadores relativos de um módulo TS (import estático e dinâmico). */
function importsDe(arquivo: string): string[] {
  const src = readFileSync(arquivo, 'utf8');
  const achados: string[] = [];
  // import ... from './x' | export ... from './x' | import('./x')
  const re = /(?:import|export)[\s\S]{0,200}?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const m of src.matchAll(re)) achados.push(m[1] ?? m[2]);
  return achados;
}

function resolveTs(base: string, spec: string): string | null {
  const p = resolve(dirname(base), spec);
  for (const cand of [`${p}.ts`, join(p, 'index.ts')]) {
    if (existsSync(cand)) return cand;
  }
  return null;
}

/** Fecho transitivo dos imports relativos, e os pacotes externos alcançados. */
function alcance(entrada: string): { arquivos: Set<string>; pacotes: Set<string> } {
  const arquivos = new Set<string>();
  const pacotes = new Set<string>();
  const fila = [resolve(entrada)];
  while (fila.length) {
    const atual = fila.pop()!;
    if (arquivos.has(atual)) continue;
    arquivos.add(atual);
    for (const spec of importsDe(atual)) {
      if (!spec.startsWith('.')) {
        pacotes.add(spec);
        continue;
      }
      const alvo = resolveTs(atual, spec);
      if (alvo) fila.push(alvo);
    }
  }
  return { arquivos, pacotes };
}

describe('isolamento do canário', () => {
  const { arquivos, pacotes } = alcance('api/_lib/canary.ts');
  const rel = (f: string) => f.replace(resolve('.') + '\\', '').replace(resolve('.') + '/', '').replace(/\\/g, '/');
  const alcancados = [...arquivos].map(rel);

  it('não alcança o pipeline — o vigiado inteiro sairia junto', () => {
    expect(alcancados).not.toContain('api/_lib/pipeline.ts');
  });

  it('não alcança o geotiff, que foi exatamente o que derrubou os dois', () => {
    expect([...pacotes]).not.toContain('geotiff');
  });

  it('não alcança o COG nem o NDVI (a cadeia que leva ao geotiff)', () => {
    expect(alcancados).not.toContain('api/_lib/tools/cog.ts');
    expect(alcancados).not.toContain('api/_lib/tools/ndvi.ts');
  });

  it('a resposta de fallback continua vindo de um módulo-folha', () => {
    // Se um dia isto voltar pro pipeline, os testes acima caem junto — mas esta
    // asserção diz POR QUE o arquivo existe, pra ninguém "simplificar" ele.
    expect(alcancados).toContain('api/_lib/fallbackReply.ts');
    const folha = importsDe('api/_lib/fallbackReply.ts');
    expect(folha).toEqual([]); // folha de verdade: não importa nada
  });

  it('o sanity check do próprio harness: o pipeline ALCANÇA o geotiff', () => {
    // Se este teste ficar verde por engano (um resolvedor quebrado que não
    // acha import nenhum), esta asserção cai e denuncia.
    expect([...alcance('api/_lib/pipeline.ts').pacotes]).toContain('geotiff');
  });
});
