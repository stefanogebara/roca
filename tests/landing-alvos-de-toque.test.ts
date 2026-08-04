/**
 * Alvos de toque e tamanho de fonte na landing (achado #19).
 *
 * Medido na auditoria: CTA do header 138×38 e links do rodapé 343×34 — abaixo
 * dos 44px que WCAG 2.5.5 e o HIG pedem. E os chips `.tag--data`, que carregam
 * justamente o CONTEÚDO da demo (o Delta T, a praga, a dose), a 10-11px: o
 * texto que mais importa era o mais difícil de ler.
 *
 * Não é purismo de acessibilidade. O público abre isso no celular, no campo, de
 * luva ou com a mão suja — o dedo dele não é o mouse de quem desenhou a página.
 *
 * O teste lê o CSS porque é lá que a regra mora; um teste de render precisaria
 * de navegador e mediria a mesma declaração por um caminho mais longo.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('web/styles.css', 'utf8');

/** O bloco de uma regra, do seletor até o `}`. */
function bloco(seletor: string): string {
  const i = css.indexOf(seletor);
  expect(i, `seletor sumiu do CSS: ${seletor}`).toBeGreaterThan(-1);
  return css.slice(i, css.indexOf('}', i));
}

describe('alvos de toque', () => {
  it('todo botão tem piso de 44px', () => {
    expect(bloco('.btn {')).toMatch(/min-height:\s*44px/);
  });

  it('o piso está no .btn, não só na variante grande', () => {
    // O que errava era a variante PEQUENA (o CTA do header usa .btn--sm).
    // Piso na variante grande consertaria só o que já estava certo.
    const sm = bloco('.btn--sm');
    expect(sm).not.toMatch(/min-height/); // herda do .btn
    expect(css.indexOf('.btn {')).toBeLessThan(css.indexOf('.btn--sm'));
  });

  it('links do rodapé também', () => {
    expect(bloco('.site-footer__col a, .site-footer__col span')).toMatch(/min-height:\s*44px/);
  });
});

describe('tamanho dos chips de dado', () => {
  it('tem piso absoluto, não só relativo ao pai', () => {
    // `.78em` de um pai pequeno é como chegavam aos 10px. O piso em rem é o que
    // impede um pai novo de encolhê-los de novo.
    const b = bloco('.tag--data {');
    expect(b).toMatch(/font-size:\s*max\(/);
    const rem = Number(b.match(/max\([^)]*?([\d.]+)rem/)?.[1]);
    expect(rem).toBeGreaterThanOrEqual(0.875); // 14px
  });
});
