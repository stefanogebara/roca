/**
 * A landing não pode depender do `app.js` para ser LEGÍVEL (achado #10).
 *
 * O cabeçalho do `app.js` diz "The page is fully readable without JS" e não era
 * verdade — mais um caso da família registrada em lessons.md. A mecânica:
 *
 *   index.html  <script>documentElement.classList.add('js')</script>  (síncrono)
 *   styles.css  .js .reveal { opacity: 0 }
 *   index.html  <script src="app.js" defer>                          (assíncrono)
 *
 * O `.js` entra sempre; quem devolve a opacidade é o `app.js`. Se a conexão
 * derrubar só o JS — CDN fora, aba trocada no meio do carregamento, 2G rural —
 * `.js` fica setado, `app.js` nunca roda, e 11.492px de conteúdo ficam
 * invisíveis PARA SEMPRE. O CTA continua clicável, invisível, no lugar certo.
 *
 * É exatamente o modo de falha do público-alvo. E não é hipótese de laboratório:
 * é o cenário normal de quem abre um link no meio da lavoura.
 *
 * Os três estados que precisam funcionar:
 *   1. sem JS nenhum  → o inline não roda, `.js` nunca entra, página inteira
 *   2. JS ligado, app.js NÃO chega → o desarme devolve a página
 *   3. tudo certo → reveal normal, sem flash
 *
 * O estado 3 é por que NÃO se conserta isto movendo o `add('js')` para dentro do
 * `app.js`: com `defer` o conteúdo já renderizou visível, e o `.js` chegando
 * depois sumiria com tudo antes do reveal — um piscar em toda visita boa para
 * consertar a visita ruim.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync('web/index.html', 'utf8');
const css = readFileSync('web/styles.css', 'utf8');
const app = readFileSync('web/app.js', 'utf8');

/** O trecho inline que marca o documento como "JS ligado". */
const inline = html.match(/<script>([\s\S]*?classList\.add\('js'\)[\s\S]*?)<\/script>/)?.[1] ?? '';

describe('landing sobrevive ao app.js não chegar', () => {
  it('a premissa do achado segue de pé: é o `.js` que esconde conteúdo', () => {
    // Se algum dia o CSS parar de esconder por `.js`, este arquivo inteiro vira
    // teatro — e é melhor o teste avisar do que seguir dando falsa segurança.
    expect(css).toMatch(/\.js\s+\.reveal\s*\{[^}]*opacity:\s*0/);
    expect(html).toMatch(/src="app\.js"[^>]*defer/);
  });

  it('o inline que seta `.js` também sabe desarmar sozinho', () => {
    expect(inline).toMatch(/classList\.add\('js'\)/);
    expect(inline, 'sem desarme, JS que não chega = página em branco').toMatch(
      /classList\.remove\('js'\)/
    );
    expect(inline, 'o desarme precisa de relógio — nada mais vai acordá-lo').toMatch(/setTimeout/);
  });

  it('o desarme espera pouco — 2G rural, não fibra', () => {
    const ms = Number(inline.match(/setTimeout\([\s\S]*?,\s*(\d+)\s*\)/)?.[1]);
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(5000);
  });

  it('o app.js avisa que chegou, senão o desarme apaga a animação de todo mundo', () => {
    const bandeira = inline.match(/window\.(__\w+)/)?.[1];
    expect(bandeira, 'o inline precisa checar alguma bandeira').toBeTruthy();
    expect(app, `app.js nunca seta window.${bandeira}`).toContain(`window.${bandeira}`);
  });
});
