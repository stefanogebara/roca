/**
 * Founder notification for new agronomist referral requests — the concierge
 * half of the warm-handoff. A farmer opting in must reach a human quickly (a
 * cold lead is a dead lead), so each opt-in emails the founders with the
 * context needed to act: UF, crops, topic, masked phone, and the /painel link.
 *
 * LGPD: the farmer's full number and thread stay inside the ops console; the
 * email carries the masked number only. Sharing anything with a partner
 * agronomist still requires asking the farmer first (REFERRAL_REPLY's promise).
 *
 * Transport: Gmail SMTP (GMAIL_USER + GMAIL_APP_PASSWORD app password).
 * Optional — without the env vars this logs loudly and the referral still
 * lands in the DB/painel; email is an accelerant, not the system of record.
 */

import nodemailer from 'nodemailer';
import { createLogger } from './logger';
import { alertFounders } from './alert';
import { withRetry } from './retry';

const log = createLogger('notify');

const PAINEL_URL = `${process.env.PUBLIC_BASE_URL || 'https://roca-black.vercel.app'}/painel`;

export interface ReferralNotice {
  maskedPhone: string;
  uf: string | null;
  crops: string[] | null;
  topic: string;
}

/** Subject + plain-text body for the referral email. Pure — unit-tested. */
export function formatReferralEmail(n: ReferralNotice): { subject: string; body: string } {
  const uf = n.uf ?? 'UF não informada';
  const crops = n.crops?.length ? n.crops.join(', ') : 'culturas não informadas';
  return {
    subject: `🌱 Stevi: novo pedido de agrônomo (${uf} · ${crops})`,
    body: [
      'Um produtor pediu pra falar com um agrônomo.',
      '',
      `Produtor: ${n.maskedPhone}`,
      `Estado: ${uf}`,
      `Culturas: ${crops}`,
      `Pedido: "${n.topic}"`,
      '',
      `Responda rápido — lead frio é lead morto. Thread completa no painel: ${PAINEL_URL}`,
      '',
      'Lembrete LGPD: perguntar ao produtor antes de passar qualquer dado a um agrônomo parceiro.',
    ].join('\n'),
  };
}

/**
 * WhatsApp ping to the founders' own numbers (FOUNDER_WA_NUMBERS, comma-
 * separated E.164) via the same transport that serves farmers. Fail-soft:
 * founders' numbers must be reachable by the current transport (sandbox-joined
 * during beta), and a miss here is logged, not fatal — the email and the
 * painel row are the durable notifications.
 */
export async function pingFoundersWhatsApp(
  send: (to: string, text: string) => Promise<void>,
  n: ReferralNotice
): Promise<void> {
  const numbers = (process.env.FOUNDER_WA_NUMBERS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (numbers.length === 0) return;
  const text =
    `🌱 Novo pedido de agrônomo!\n\n` +
    `Produtor: ${n.maskedPhone}\n` +
    `Estado: ${n.uf ?? '—'} · Culturas: ${n.crops?.length ? n.crops.join(', ') : '—'}\n` +
    `Pedido: "${n.topic}"\n\n` +
    `Thread no painel: ${PAINEL_URL}`;
  for (const to of numbers) {
    try {
      await withRetry(() => send(to, text), { attempts: 2 });
    } catch (e) {
      log.error(`founder WhatsApp ping to ${to.slice(0, 6)}… failed:`, (e as Error).message);
    }
  }
}

/**
 * Send the referral notice to the founders. Fail-soft: a mail failure never
 * blocks the farmer's reply, but it is logged and alerted — never silent.
 */
export async function sendReferralNotification(n: ReferralNotice): Promise<void> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const to = process.env.REFERRAL_NOTIFY_TO || user;
  if (!user || !pass) {
    log.error('GMAIL_USER/GMAIL_APP_PASSWORD not set — referral email skipped (referral IS in the DB/painel)');
    return;
  }
  const { subject, body } = formatReferralEmail(n);
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
    });
    await withRetry(() => transporter.sendMail({ from: `Stevi <${user}>`, to, subject, text: body }), {
      attempts: 2,
    });
    log.info('referral notification emailed');
  } catch (e) {
    log.error('referral email failed:', (e as Error).message);
    await alertFounders(`⚠️ Stevi: email de referral falhou — ${(e as Error).message.slice(0, 200)}`);
  }
}
