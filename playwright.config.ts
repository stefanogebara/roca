import { defineConfig } from '@playwright/test';

/**
 * E2E do painel de operação AO VIVO (produção). Read-only por contrato: os
 * specs logam e leem — nunca clicam em disparo, sourcing ou backfill (custa
 * quota, escreve na base e mexe com reputação do número).
 *
 * Env: OPS_PASSWORD (obrigatória — o spec pula sem ela) e PAINEL_BASE_URL
 * (default: o deploy público). Rode com o .env carregado no ambiente.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-screenshots/artifacts',
  use: {
    baseURL: process.env.PAINEL_BASE_URL || 'https://roca-black.vercel.app',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 900 },
  },
});
