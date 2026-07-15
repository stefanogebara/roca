/**
 * Stevi's own contact card (vCard) — the técnico kit's "cartão .vcf". A técnico
 * shares this saved contact instead of the raw number, so the farmer adds
 * "Stevi — Assistente do Cafeicultor" and messages a name, not a cold +1 (flight
 * plan rule: nunca o número cru). Outbound only — inbound vCards a farmer shares
 * are parsed in transport/vcard.ts.
 *
 * The number is env-driven (PUBLIC_WA_NUMBER), same source as the QR poster and
 * the wa.me links, so the whole kit follows the BR-number migration in one flip.
 */

/** vCard 3.0 value escape: backslash, newline, comma, semicolon (RFC 6350 §3.4). */
function esc(v: string): string {
  return v
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

const NOTE =
  'Sua ajudante de lavoura no WhatsApp. Manda foto de praga, pergunta se dá pra ' +
  'pulverizar hoje, tira dúvida de café, soja, milho e pasto. Quem receita produto ' +
  'é o agrônomo — a Stevi ajuda você a entender e a saber o que perguntar.';

/**
 * Build Stevi's vCard. `waNumber` is any format; it's normalized to digits for
 * the E.164 TEL and the wa.me URL. CRLF line endings per spec. Pure.
 */
export function steviVCard(waNumber: string): string {
  const digits = waNumber.replace(/\D/g, '');
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:;Stevi;;;',
    'FN:Stevi — Assistente do Cafeicultor',
    'ORG:Stevi',
    'TITLE:Assistente de lavoura no WhatsApp',
    `TEL;TYPE=CELL,VOICE:+${digits}`,
    `NOTE:${esc(NOTE)}`,
    `URL:https://wa.me/${digits}`,
    'END:VCARD',
    '',
  ].join('\r\n');
}
