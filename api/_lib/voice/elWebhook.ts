/**
 * Webhook pós-chamada do ElevenLabs (agente Vitória-voz) — verificação e
 * parsing. Integração decidida pelo Stefano em 04/ago; arquitetura no plano
 * 2026-08-04-agente-voz (Opção A: EL hospeda o loop de voz, nós recebemos os
 * resultados).
 *
 * Assinatura: header `ElevenLabs-Signature`, formato `t=<unix>,v0=<hex>`,
 * HMAC-SHA256 sobre `${t}.${rawBody}` com o webhook secret (padrão Stripe).
 * Timestamp com tolerância curta contra replay. Sem assinatura válida, nada
 * entra no banco — canal sem verificação é suposição (lição de 03/ago).
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/** Janela de aceitação do timestamp (segundos). EL reenvia em minutos; 30 min
 * cobre retries sem deixar replay confortável. */
export const TOLERANCIA_SEGS = 30 * 60;

/** Verifica a assinatura do webhook. Pura (recebe `nowEpoch`); nunca lança. */
export function verifyElSignature(
  rawBody: string,
  header: string | undefined,
  secret: string,
  nowEpoch: number
): boolean {
  if (!header || !secret) return false;
  let t = NaN;
  let v0 = '';
  for (const parte of header.split(',')) {
    const [k, v] = parte.split('=', 2);
    if (k?.trim() === 't') t = Number(v);
    if (k?.trim() === 'v0') v0 = (v ?? '').trim();
  }
  if (!Number.isFinite(t) || !v0) return false;
  if (Math.abs(nowEpoch - t) > TOLERANCIA_SEGS) return false;
  const esperado = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  try {
    const a = Buffer.from(esperado, 'hex');
    const b = Buffer.from(v0, 'hex');
    return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export interface ElCallEvent {
  tipo: 'transcription' | 'failure';
  elAgentId: string | null;
  elConversationId: string;
  status: string | null;
  /** E.164 do interlocutor em chamada telefônica; null em widget/web. */
  phone: string | null;
  durationSecs: number | null;
  costCredits: number | null;
  summary: string | null;
  transcript: unknown;
  analysis: unknown;
  failureReason: string | null;
}

/**
 * Converte o corpo cru do webhook num evento nosso. Null para tipo
 * desconhecido ou JSON inválido — o endpoint responde 200 e ignora, porque
 * tipo novo da EL não pode virar retry infinito contra a gente.
 */
export function parseElEvent(rawBody: string): ElCallEvent | null {
  let json: {
    type?: string;
    data?: {
      agent_id?: string;
      conversation_id?: string;
      status?: string;
      transcript?: unknown;
      metadata?: {
        call_duration_secs?: number;
        cost?: number;
        phone_call?: { external_number?: string };
      };
      analysis?: { transcript_summary?: string };
      failure_reason?: string;
    };
  };
  try {
    json = JSON.parse(rawBody) as typeof json;
  } catch {
    return null;
  }
  const d = json.data;
  if (!d?.conversation_id) return null;

  if (json.type === 'post_call_transcription') {
    return {
      tipo: 'transcription',
      elAgentId: d.agent_id ?? null,
      elConversationId: d.conversation_id,
      status: d.status ?? null,
      phone: d.metadata?.phone_call?.external_number ?? null,
      durationSecs: d.metadata?.call_duration_secs ?? null,
      costCredits: d.metadata?.cost ?? null,
      summary: d.analysis?.transcript_summary ?? null,
      transcript: d.transcript ?? null,
      analysis: d.analysis ?? null,
      failureReason: null,
    };
  }
  if (json.type === 'post_call_failure') {
    return {
      tipo: 'failure',
      elAgentId: d.agent_id ?? null,
      elConversationId: d.conversation_id,
      status: 'failed',
      phone: d.metadata?.phone_call?.external_number ?? null,
      durationSecs: null,
      costCredits: null,
      summary: null,
      transcript: null,
      analysis: null,
      failureReason: d.failure_reason ?? 'desconhecido',
    };
  }
  return null;
}
