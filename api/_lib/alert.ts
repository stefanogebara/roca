/**
 * Founder alerting for failures a farmer would otherwise suffer in silence
 * (e.g. an outbound send that exhausted its retries). Prefers a generic
 * webhook (ALERT_WEBHOOK_URL — Discord and Slack payload shapes both covered);
 * without one it falls back to a WhatsApp ping to FOUNDER_WA_NUMBERS, so
 * alerts reach a human with zero extra setup. Fire-and-forget with short
 * timeouts; an alerting failure must never take down the reply path, but it
 * is still logged — never silent. (Caveat on the fallback: if the alert is
 * about the WhatsApp transport itself being down, the ping shares its fate —
 * the webhook is the independent channel; configure it when possible.)
 */

import { createLogger } from './logger';

const log = createLogger('alert');

async function whatsappFallback(text: string): Promise<boolean> {
  const numbers = (process.env.FOUNDER_WA_NUMBERS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (numbers.length === 0) return false;
  // Lazy import avoids widening alert.ts's dependency surface for every caller.
  const { TwilioAdapter } = await import('./transport/twilio');
  const adapter = new TwilioAdapter();
  let delivered = false;
  for (const to of numbers) {
    try {
      await adapter.send({ to, text });
      delivered = true;
    } catch (e) {
      log.error(`alert WhatsApp fallback to ${to.slice(0, 6)}… failed:`, (e as Error).message);
    }
  }
  return delivered;
}

export async function alertFounders(text: string): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) {
    const delivered = await whatsappFallback(text).catch(() => false);
    if (!delivered) log.error('ALERT (no channel delivered):', text);
    return;
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Discord reads `content`, Slack reads `text` — send both.
      body: JSON.stringify({ content: text, text }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) log.error(`alert webhook ${res.status}:`, text);
  } catch (e) {
    log.error('alert webhook failed:', (e as Error).message, '| alert was:', text);
  }
}
