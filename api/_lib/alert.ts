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

export type CanalDeAlerta = 'webhook' | 'email' | 'whatsapp';

/**
 * Ordem de tentativa dos canais, dado o que esta configurado. Pura.
 *
 * INCIDENTE 03/ago: so existiam webhook (nunca configurado) e WhatsApp/Twilio.
 * Consulta a API do Twilio mostrou TODA mensagem pros founders falhando com
 * 63015 — "o sandbox so entrega a quem entrou nele" — e a sessao do sandbox
 * EXPIRA EM 3 DIAS. Alerta de incidente, canario, LLM caindo e lead quente
 * apontavam pra um cano morto havia semanas, em silencio: o Twilio devolve
 * HTTP 201 "queued" e so falha depois, de forma assincrona.
 *
 * E-mail entra entre os dois porque e o unico canal com entrega COMPROVADA
 * (o aviso de lead quente usa e chega), nao depende de janela da Meta nem de
 * sandbox que caduca. Twilio fica por ultimo — legado, mas melhor que nada.
 */
export function escolhaDeCanal(temos: { webhook: boolean; email: boolean }): CanalDeAlerta[] {
  const ordem: CanalDeAlerta[] = [];
  if (temos.webhook) ordem.push('webhook');
  if (temos.email) ordem.push('email');
  ordem.push('whatsapp');
  return ordem;
}

async function tentarWebhook(text: string): Promise<boolean> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return false;
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
    if (res.ok) return true;
    log.error(`alert webhook ${res.status}:`, text);
    return false;
  } catch (e) {
    log.error('alert webhook failed:', (e as Error).message);
    return false;
  }
}

async function tentarEmail(text: string): Promise<boolean> {
  try {
    // Import tardio: alert.ts entra no caminho de resposta ao produtor, e
    // nodemailer nao precisa desse bundle quando nao ha alerta nenhum.
    const { sendFounderAlertEmail } = await import('./notify');
    return await sendFounderAlertEmail(text);
  } catch (e) {
    log.error('alert email failed:', (e as Error).message);
    return false;
  }
}

/**
 * Alerta os founders pelo primeiro canal que ENTREGAR de fato — nao pelo
 * primeiro que aceitar. Cada degrau devolve booleano de entrega; um 201 que
 * falha depois (Twilio) conta como nao-entregue no degrau dele.
 */
export async function alertFounders(text: string): Promise<void> {
  const canais = escolhaDeCanal({
    webhook: !!process.env.ALERT_WEBHOOK_URL,
    email: !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
  });
  for (const canal of canais) {
    const ok =
      canal === 'webhook'
        ? await tentarWebhook(text)
        : canal === 'email'
          ? await tentarEmail(text)
          : await whatsappFallback(text).catch(() => false);
    if (ok) {
      log.info(`alerta entregue por ${canal}`);
      return;
    }
  }
  log.error('ALERT (nenhum canal entregou):', text);
}
