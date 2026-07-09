/**
 * Founder alerting for failures a farmer would otherwise suffer in silence
 * (e.g. an outbound send that exhausted its retries). Posts to a generic
 * webhook (ALERT_WEBHOOK_URL — Discord and Slack payload shapes both covered).
 * Optional: without the env var it only logs. Fire-and-forget with a short
 * timeout; an alerting failure must never take down the reply path, but it is
 * still logged — never silent.
 */

import { createLogger } from './logger';

const log = createLogger('alert');

export async function alertFounders(text: string): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) {
    log.error('ALERT (no webhook configured):', text);
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
