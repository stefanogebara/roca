/**
 * Token de automação para /api/ops/* (05/ago).
 *
 * O painel autentica por cookie assinado, emitido por senha. Isso protege bem
 * o humano e trava a automação: rodar o sourcing daqui exigiria eu manipular a
 * senha do painel, que é a credencial que abre TUDO e é a mesma que o Stefano
 * digita. Credencial de gente não deve virar credencial de robô — some a
 * capacidade de revogar um sem derrubar o outro.
 *
 * `OPS_TOKEN` é o análogo do `CRON_SECRET` que os crons já usam: um segredo
 * dedicado, revogável sozinho, que não abre o painel no navegador.
 *
 * As travas que este teste fixa, todas por causa do que o endpoint faz
 * (importar prospect, disparar, promover parceiro):
 *
 * 1. Sem OPS_TOKEN configurado, o caminho NÃO EXISTE. Env ausente nunca pode
 *    virar "qualquer um entra" — é o fusível de vidro do achado #18, e o mesmo
 *    erro não se comete duas vezes na mesma semana.
 * 2. Token curto é RECUSADO mesmo se bater. `OPS_TOKEN=1` é adivinhável por
 *    força bruta, e um segredo fraco configurado por pressa é indistinguível
 *    de um forte para o código — a não ser que ele meça.
 * 3. Comparação em tempo constante, como a da senha.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireOps, OPS_TOKEN_MIN_LEN } from '../api/_lib/opsAuth';

const FORTE = 'z'.repeat(OPS_TOKEN_MIN_LEN);

function req(headers: Record<string, string> = {}): VercelRequest {
  return { headers } as unknown as VercelRequest;
}
function res(): VercelResponse & { code?: number } {
  const r: Record<string, unknown> = {};
  r.status = (c: number) => {
    r.code = c;
    return r;
  };
  r.json = () => r;
  return r as unknown as VercelResponse & { code?: number };
}

beforeEach(() => {
  delete process.env.OPS_TOKEN;
  process.env.CRON_SECRET = 'chave-de-assinatura-de-teste';
});
afterEach(() => delete process.env.OPS_TOKEN);

describe('OPS_TOKEN', () => {
  it('sem env configurada, nem um Bearer válido entra', () => {
    const r = res();
    expect(requireOps(req({ authorization: `Bearer ${FORTE}` }), r)).toBe(false);
    expect(r.code).toBe(401);
  });

  it('com env configurada, o token certo entra', () => {
    process.env.OPS_TOKEN = FORTE;
    expect(requireOps(req({ authorization: `Bearer ${FORTE}` }), res())).toBe(true);
  });

  it('token errado do mesmo tamanho não entra', () => {
    process.env.OPS_TOKEN = FORTE;
    expect(requireOps(req({ authorization: `Bearer ${'y'.repeat(OPS_TOKEN_MIN_LEN)}` }), res())).toBe(false);
  });

  it('token CURTO é recusado mesmo batendo — segredo fraco não vira porta', () => {
    process.env.OPS_TOKEN = 'curto';
    expect(requireOps(req({ authorization: 'Bearer curto' }), res())).toBe(false);
  });

  it('sem header nenhum segue 401, como antes', () => {
    process.env.OPS_TOKEN = FORTE;
    expect(requireOps(req(), res())).toBe(false);
  });

  it('header malformado não derruba nem passa', () => {
    process.env.OPS_TOKEN = FORTE;
    for (const h of ['Bearer', 'Bearer ', FORTE, `Basic ${FORTE}`]) {
      expect(requireOps(req({ authorization: h }), res()), h).toBe(false);
    }
  });
});
