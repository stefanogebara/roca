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
import { listApplications, getFarmProfile } from './_lib/db';
import { buildApplicationsReport } from './_lib/cards/applications';
import { buildApplicationsPdf } from './_lib/report/pdf';
import { createLogger } from './_lib/logger';

const log = createLogger('report');

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const u = String(req.query.u ?? '');
    const exp = String(req.query.exp ?? '');
    const sig = String(req.query.sig ?? '');
    if (!u || !verifyReportToken(u, exp, sig)) {
      res.status(403).send('forbidden');
      return;
    }

    const [rows, profile] = await Promise.all([
      listApplications(u, { limit: 200 }),
      getFarmProfile(u),
    ]);
    const report = buildApplicationsReport(profile, rows, { maxLines: 200 });
    const pdf = await buildApplicationsPdf(report);

    res.setHeader('Content-Type', 'application/pdf');
    // Private data — never CDN-cached; inline so WhatsApp/browser can preview.
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', 'inline; filename="caderno-de-aplicacoes.pdf"');
    res.status(200).send(Buffer.from(pdf));
  } catch (e) {
    log.error('report pdf failed:', (e as Error).message);
    res.status(500).send('report render failed');
  }
}
