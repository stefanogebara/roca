/**
 * Signed PDF endpoint for the caderno de aplicações — the forwardable/printable
 * record. Same access model as the applications card (api/card.ts, type=
 * applications): the URL carries only an opaque user id + expiry + HMAC; the
 * records are fetched server-side and never CDN-cached. WhatsApp fetches the PDF
 * within the token's TTL and sends it as a document.
 *
 *   /api/report?u=<userId>&exp=<ms>&sig=<hmac>
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyReportToken } from './_lib/reportToken';
import { listApplications, getFarmProfile, getUserName, getActivityLog } from './_lib/db';
import { buildApplicationsReport } from './_lib/cards/applications';
import { buildApplicationsPdf, buildFinancingPdf } from './_lib/report/pdf';
import { buildFinancingReport } from './_lib/report/financing';
import { createLogger } from './_lib/logger';
import { enforcePublicRateLimit } from './_lib/httpRateLimit';

const log = createLogger('report');

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Cap before the token check too: a valid token still triggers DB reads + a
  // PDF render, and an unauthenticated flood of 403s is itself cheap to abuse.
  if (!enforcePublicRateLimit('report', req.headers, res)) return;
  try {
    const u = String(req.query.u ?? '');
    const exp = String(req.query.exp ?? '');
    const sig = String(req.query.sig ?? '');
    if (!u || !verifyReportToken(u, exp, sig)) {
      res.status(403).send('forbidden');
      return;
    }

    const kind = String(req.query.kind ?? '');
    let pdf: Uint8Array;
    let filename: string;
    if (kind === 'pronaf') {
      // Histórico de Manejo — the crédito-rural SUPPORT report (not the
      // application; see plan 2026-07-16-pronaf-report). Same access model.
      const [rows, profile, name, activity] = await Promise.all([
        listApplications(u, { limit: 200 }),
        getFarmProfile(u),
        getUserName(u),
        getActivityLog(u),
      ]);
      pdf = await buildFinancingPdf(buildFinancingReport(name, profile, rows, activity));
      filename = 'historico-manejo-pronaf.pdf';
    } else {
      const [rows, profile] = await Promise.all([
        listApplications(u, { limit: 200 }),
        getFarmProfile(u),
      ]);
      pdf = await buildApplicationsPdf(buildApplicationsReport(profile, rows, { maxLines: 200 }));
      filename = 'caderno-de-aplicacoes.pdf';
    }

    res.setHeader('Content-Type', 'application/pdf');
    // Private data — never CDN-cached; inline so WhatsApp/browser can preview.
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.status(200).send(Buffer.from(pdf));
  } catch (e) {
    log.error('report pdf failed:', (e as Error).message);
    res.status(500).send('report render failed');
  }
}
