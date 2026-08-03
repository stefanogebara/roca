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
 * A prospect's first reply — the hottest lead the outbound funnel produces.
 * The founders take over the conversation directly (painel → Assumir), so the
 * email carries everything needed to act, with the phone masked (full number
 * stays in the ops console — same LGPD posture as the referral notice).
 */
export interface ProspectReplyNotice {
  name: string | null;
  kind: string;
  city: string | null;
  uf: string | null;
  maskedPhone: string;
  replyText: string;
}

/** Subject + plain-text body for the prospect-reply email. Pure — unit-tested. */
export function formatProspectReplyEmail(n: ProspectReplyNotice): { subject: string; body: string } {
  const name = n.name?.trim() || 'Prospect sem nome';
  const region = [n.city, n.uf].filter(Boolean).join(' · ') || 'região não informada';
  const excerpt = n.replyText.length > 240 ? `${n.replyText.slice(0, 240)}…` : n.replyText;
  return {
    subject: `🔥 Stevi: prospect respondeu — ${name} (${n.kind})`,
    body: [
      'Um prospect respondeu ao primeiro toque — lead quente, a hora de assumir é AGORA.',
      '',
      `Quem: ${name} (${n.kind})`,
      `Região: ${region}`,
      `Contato: ${n.maskedPhone}`,
      '',
      `Resposta: "${excerpt}"`,
      '',
      `Assuma a conversa no painel (botão Assumir): ${PAINEL_URL}`,
      'A Vitória segura a conversa até lá — mas resposta humana em minutos fecha, em horas esfria.',
    ].join('\n'),
  };
}

/** Comma-separated founder inbox list; nodemailer accepts the string as-is. */
function founderRecipients(fallback: string): string {
  return process.env.FOUNDER_NOTIFY_TO || process.env.REFERRAL_NOTIFY_TO || fallback;
}

/** Shared Gmail-SMTP send for founder notifications. Throws on failure. */
async function sendFounderEmail(subject: string, body: string): Promise<boolean> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    log.error('GMAIL_USER/GMAIL_APP_PASSWORD not set — founder email skipped (the event IS in the DB/painel)');
    return false;
  }
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  await withRetry(
    () =>
      transporter.sendMail({
        from: `Stevi <${user}>`,
        to: founderRecipients(user),
        subject,
        text: body,
      }),
    { attempts: 2 }
  );
  return true;
}

/**
 * Alerta operacional por e-mail — o degrau confiavel do alertFounders desde o
 * incidente de 03/ago (Twilio sandbox morto com 63015). Reusa o mesmo SMTP que
 * ja entrega o aviso de lead quente. Devolve se ENTREGOU, nao se tentou.
 */
export async function sendFounderAlertEmail(text: string): Promise<boolean> {
  const primeiraLinha = text.replace(/\s+/g, ' ').slice(0, 80);
  try {
    return await sendFounderEmail(`Stevi | ${primeiraLinha}`, text);
  } catch (e) {
    log.error('founder alert email failed:', (e as Error).message);
    return false;
  }
}

/**
 * Send the referral notice to the founders. Fail-soft: a mail failure never
 * blocks the farmer's reply, but it is logged and alerted — never silent.
 */
export async function sendReferralNotification(n: ReferralNotice): Promise<void> {
  const { subject, body } = formatReferralEmail(n);
  try {
    if (await sendFounderEmail(subject, body)) log.info('referral notification emailed');
  } catch (e) {
    log.error('referral email failed:', (e as Error).message);
    await alertFounders(`⚠️ Stevi: email de referral falhou — ${(e as Error).message.slice(0, 200)}`);
  }
}

/**
 * Email both founders that a prospect replied (first reply only — the caller
 * gates on the status transition). Fail-soft with a loud log: the reply flow
 * must never break because SMTP hiccuped.
 */
export async function sendProspectReplyNotification(n: ProspectReplyNotice): Promise<void> {
  const { subject, body } = formatProspectReplyEmail(n);
  try {
    if (await sendFounderEmail(subject, body)) log.info('prospect-reply notification emailed');
  } catch (e) {
    log.error('prospect-reply email failed:', (e as Error).message);
    await alertFounders(`⚠️ Stevi: email de lead quente falhou — ${(e as Error).message.slice(0, 200)}`);
  }
}

// ── Resumo do lote de disparo (a "automação diária" de 02/ago) ──────────────

/** O que resumoDoLote precisa saber do DispatchReport (evita import circular
 * com dispatch.ts, que já importa daqui no futuro — e o tipo estrutural basta). */
export interface LoteParaResumo {
  dryRun: boolean;
  skippedOutsideHours: boolean;
  aborted: boolean;
  error?: string;
  eligible: number;
  sent: number;
  failed: number;
}

/**
 * Resumo do lote em linguagem de founder, ou null quando não há o que dizer.
 *
 * Desenho deliberado (pedido do Stefano em 02/ago, "automação diária"): NÃO é
 * cron novo nem rotina em nuvem — o próprio disparo é o evento (regra da casa:
 * evento > cron; e a rotina em nuvem não tem como ler o banco sem espalhar
 * segredo). O texto segue a regra do painel: frase de gente, zero jargão.
 *
 * Null nos casos silenciosos de propósito: 13h/16h com cap esgotado não podem
 * virar três pings iguais por dia — push que se repete vira push ignorado.
 */
export function resumoDoLote(
  lote: LoteParaResumo,
  bumps: { sent: number; failed: number } | null
): string | null {
  if (lote.dryRun) return null;
  if (lote.aborted) {
    return (
      `⛔ Lote da Vitória: nenhum convite saiu — o motor parou por segurança` +
      (lote.error ? ` (${lote.error})` : '') +
      `. Dá uma olhada no painel: ${PAINEL_URL}`
    );
  }
  const bumpSent = bumps?.sent ?? 0;
  if (lote.sent === 0 && lote.failed === 0 && bumpSent === 0) return null;

  const partes: string[] = [];
  if (lote.sent > 0) partes.push(`${lote.sent} convites enviados`);
  if (bumpSent > 0) partes.push(`${bumpSent} lembretes pra quem não respondeu`);
  if (lote.failed > 0) partes.push(`${lote.failed} não tinham WhatsApp (ficam fora das próximas filas)`);
  const fila = Math.max(0, lote.eligible - lote.sent);
  return (
    `🌱 Lote da Vitória: ${partes.join(' · ')}.` +
    ` Ainda ${fila} na fila pros próximos lotes.` +
    ` Respostas aparecem no painel: ${PAINEL_URL}`
  );
}
