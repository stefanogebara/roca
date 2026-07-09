/**
 * Prospect template sender — the ONE place a business-initiated WhatsApp message
 * leaves for a prospect. Business-initiated ⇒ must be a Meta-approved template.
 * Thin wrapper over the Cloud API (reuses the same token/number as Stevi).
 * Returns the provider message id (wamid) on success; throws on failure so the
 * dispatch engine can record `failed` and alert.
 */

import { createLogger } from '../logger';

const log = createLogger('prospect-send');
const GRAPH = 'https://graph.facebook.com/v21.0';

export interface TemplateSendResult {
  wamid: string;
}

/**
 * Send an approved template to one E.164 number, substituting ordered body
 * params ({{1}}, {{2}}, …). No pacing/eligibility here — the caller MUST have
 * already cleared it through the P1 core (eligibleToSend + planBatch).
 */
export async function sendProspectTemplate(
  to: string,
  templateName: string,
  language: string,
  bodyParams: string[]
): Promise<TemplateSendResult> {
  const token = process.env.WHATSAPP_CLOUD_TOKEN;
  const phoneId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    throw new Error('WHATSAPP_CLOUD_TOKEN / WHATSAPP_CLOUD_PHONE_NUMBER_ID not configured');
  }

  const components = bodyParams.length
    ? [{ type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text })) }]
    : [];

  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        ...(components.length ? { components } : {}),
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    log.error(`template send failed ${res.status}: ${body.slice(0, 200)}`);
    throw new Error(`template send failed ${res.status}: ${body.slice(0, 160)}`);
  }
  const data = (await res.json()) as { messages?: Array<{ id?: string }> };
  const wamid = data.messages?.[0]?.id;
  if (!wamid) throw new Error('template send returned no message id');
  return { wamid };
}
