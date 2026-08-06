import { test, expect } from '@playwright/test';

/**
 * Smoke do /painel em produção: login com a senha dos fundadores, visão geral
 * carrega, aba Prospecção lê /api/ops/prospects com sucesso.
 *
 * READ-ONLY: nenhum clique em "buscar", disparo ou backfill — ações do painel
 * escrevem na base e gastam quota/reputação. Este spec só prova que a porta
 * abre e os dados chegam.
 *
 * Atenção ao throttle do login (5 falhas por IP / 15 min): senha errada no env
 * não deve ser re-tentada em loop — por isso o teste falha alto na primeira
 * resposta != success em vez de repetir.
 */
const senha = process.env.OPS_PASSWORD;

test.describe('painel ao vivo — smoke', () => {
  test.skip(!senha, 'OPS_PASSWORD não está no ambiente — carregue o .env');

  test('login abre o app e a visão geral carrega', async ({ page }) => {
    await page.goto('/painel');
    await expect(page.locator('#pw')).toBeVisible();

    await page.fill('#pw', senha as string);
    const loginResp = page.waitForResponse((r) => r.url().includes('/api/ops/login'));
    await page.getByRole('button', { name: 'Entrar' }).click();
    const resp = await loginResp;
    expect(resp.status(), 'login deve aceitar a senha do .env').toBe(200);

    await expect(page.locator('#app')).toBeVisible();
    // A visão geral sai do "Carregando…" — o painel realmente leu dados.
    await expect(page.locator('#p-overview')).not.toContainText('Carregando…', { timeout: 20_000 });
    await page.screenshot({ path: 'test-screenshots/painel-overview.png', fullPage: true });
  });

  test('aba Prospecção lê a fila sem erro', async ({ page }) => {
    await page.goto('/painel');
    await page.fill('#pw', senha as string);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.locator('#app')).toBeVisible();

    const prospectsResp = page.waitForResponse((r) => r.url().includes('/api/ops/prospects'));
    await page.getByRole('button', { name: 'Prospecção' }).click();
    expect((await prospectsResp).status()).toBe(200);

    const painel = page.locator('#p-prospeccao');
    await expect(painel).not.toContainText('Carregando…', { timeout: 20_000 });
    await page.screenshot({ path: 'test-screenshots/painel-prospeccao.png', fullPage: true });
  });
});
