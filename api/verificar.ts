/**
 * Public verification page — served at /verificar (rewrite → /api/verificar).
 * Identity fields come from env so the founder fills the real values (agrônomo's
 * CREA, responsável, LGPD e-mail) once, no code deploy; unset fields simply don't
 * render (never a fabricated registration). Unauthenticated by necessity — this
 * is the "prove we're real" page, no secrets, no PII.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifierHtml } from './_lib/verifierPage';

export default function handler(_req: VercelRequest, res: VercelResponse): void {
  const html = verifierHtml({
    waNumber: process.env.PUBLIC_WA_NUMBER || '19705509125',
    responsible: process.env.VERIFIER_RESPONSIBLE || null,
    agronomo: process.env.VERIFIER_AGRONOMO || null,
    crea: process.env.VERIFIER_CREA || null,
    lgpdEmail: process.env.VERIFIER_LGPD_EMAIL || null,
  });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=600');
  res.status(200).send(html);
}
