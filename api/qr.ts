/**
 * Public QR code for the farmer opt-in link — the physical funnel. Print it on a
 * poster at a cooperativa/feira, a farmer scans it, WhatsApp opens with a
 * prefilled "oi" to the real Stevi number, and they're onboarded. Brand colours,
 * no query params needed (defaults to the opt-in link); `?text=` can override the
 * prefilled message for campaign variants.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import QRCode from 'qrcode';
import { createLogger } from './_lib/logger';
import { enforcePublicRateLimit } from './_lib/httpRateLimit';
import { publicWaNumber } from './_lib/waNumber';

const log = createLogger('qr');

const DEFAULT_TEXT = 'Oi, Stevi! Quero testar.';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!enforcePublicRateLimit('qr', req.headers, res)) return;
  try {
    const text = typeof req.query.text === 'string' && req.query.text.trim() ? req.query.text : DEFAULT_TEXT;
    // Lido por requisição (não no import): pôster impresso segue a env sem
    // depender de instância nova do Fluid Compute pra pegar o valor novo.
    const url = `https://wa.me/${publicWaNumber()}?text=${encodeURIComponent(text)}`;
    const png = await QRCode.toBuffer(url, {
      type: 'png',
      width: 720,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#303b0c', light: '#f7fbeb' }, // Campo Editorial: olive-dark on wash
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    res.status(200).send(png);
  } catch (e) {
    log.error('qr render failed:', (e as Error).message);
    res.status(500).send('qr render failed');
  }
}
