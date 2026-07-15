/**
 * Stevi's contact card as a downloadable .vcf — the técnico kit's shareable
 * contact. A técnico opens /api/vcard, gets the file, and forwards it in
 * WhatsApp; the farmer taps "adicionar contato" and messages "Stevi", never a
 * cold number. Number is env-driven (PUBLIC_WA_NUMBER) so the whole kit follows
 * the BR-number migration. Unauthenticated by necessity — no secrets, no PII.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { steviVCard } from './_lib/contactCard';

export default function handler(_req: VercelRequest, res: VercelResponse): void {
  const number = process.env.PUBLIC_WA_NUMBER || '19705509125';
  const vcf = steviVCard(number);
  res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="stevi.vcf"');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  res.status(200).send(vcf);
}
