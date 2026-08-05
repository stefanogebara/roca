/**
 * Script importado por teste não pode usar `import.meta`.
 *
 * O `tsconfig` só inclui `api/**` e `tests/**` — `scripts/**` fica de fora. Mas
 * quando um teste importa de um script, o TypeScript arrasta o arquivo INTEIRO
 * para dentro do typecheck, e aí o `package.json` (`"type": "commonjs"`) e o
 * `module: CommonJS` do tsconfig valem para ele. `import.meta` não existe em
 * CommonJS: TS1343, e o `tsc --noEmit` do repo inteiro passa a falhar.
 *
 * Foi o que aconteceu em 05/ago com `scripts/el-clone.ts`. Os SEIS scripts do
 * repo usam `import.meta` (o `tsx` engole), mas só ele quebrou o typecheck —
 * porque só ele tinha teste. O sintoma aparece longe da causa: quem escreve o
 * teste não mexeu em nada do script, e mesmo assim o build fica vermelho.
 *
 * A régua deste teste é a condição REAL do defeito, não "nenhum script pode
 * usar import.meta". Os outros cinco seguem como estão, e no dia em que alguém
 * escrever um teste para um deles, é este arquivo que explica o que fazer —
 * em vez de um TS1343 solto num script que a pessoa nem abriu.
 *
 * Conserto: `join(process.cwd(), 'arquivo')`, que é como o `goldeneval.ts` já
 * resolve o goldenset. Scripts rodam por `npm run`, sempre a partir da raiz.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');

/** Scripts que algum teste importa — os únicos que entram no typecheck. */
function scriptsAlcancadosPorTeste(): string[] {
  const alcancados = new Set<string>();
  for (const arquivo of readdirSync(join(RAIZ, 'tests')).filter((f) => f.endsWith('.ts'))) {
    const fonte = readFileSync(join(RAIZ, 'tests', arquivo), 'utf8');
    for (const m of fonte.matchAll(/from\s+'\.\.\/(scripts\/[\w.-]+)'/g)) {
      const alvo = m[1].endsWith('.ts') ? m[1] : `${m[1]}.ts`;
      if (existsSync(join(RAIZ, alvo))) alcancados.add(alvo);
    }
  }
  return [...alcancados].sort();
}

describe('scripts dentro do typecheck', () => {
  it('o varredor enxerga o caso que originou a regra', () => {
    // Sem esta âncora, um regex quebrado passaria como "nenhum script alcançado"
    // e o arquivo inteiro viraria teatro.
    expect(scriptsAlcancadosPorTeste()).toContain('scripts/el-clone.ts');
  });

  it('nenhum deles usa import.meta — em CommonJS isso é TS1343', () => {
    for (const script of scriptsAlcancadosPorTeste()) {
      const fonte = readFileSync(join(RAIZ, script), 'utf8')
        // Comentários podem CITAR `import.meta` ao explicar por que ele saiu.
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      expect(fonte, `${script} usa import.meta e vai quebrar o tsc --noEmit`).not.toMatch(
        /import\s*\.\s*meta/
      );
    }
  });
});
