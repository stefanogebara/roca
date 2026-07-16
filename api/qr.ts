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

const log = createLogger('qr');

// Env-driven so the printed posters don't brick when the BR number goes live —
// flip PUBLIC_WA_NUMBER in Vercel and every new QR points at it. Same fallback
// as growth.ts's wa.me links (one number, one env var).
const WA_NUMBER = process.env.PUBLIC_WA_NUMBER || '19705509125';
const DEFAULT_TEXT = 'Oi, Stevi! Quero testar.';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const text = typeof req.query.text === 'string' && req.query.text.trim() ? req.query.text : DEFAULT_TEXT;
    const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
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
