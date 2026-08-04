/**
 * Receptor do webhook pós-chamada do ElevenLabs (agente Vitória-voz).
 *
 * Fluxo: EL termina uma chamada → POST aqui com transcrição/análise assinadas →
 * verificamos HMAC → gravamos em voice_calls → ligamos ao prospect pelo
 * telefone quando houver. Deliberadamente public-facing SEM auth de sessão: a
 * autenticação É a assinatura HMAC (mesmo modelo do webhook da Meta).
 *
 * Idempotente por el_conversation_id (unique + upsert): a EL faz retry de
 * webhook, e retry não pode virar linha duplicada.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyElSignature, parseElEvent } from './_lib/voice/elWebhook';
import { getDb } from './_lib/db';
import { createLogger } from './_lib/logger';

const log = createLogger('el-webhook');

async function rawBody(req: VercelRequest): Promise<string> {
  // A verificação de HMAC exige o corpo CRU — o parse do Vercel reordenaria
  // chaves e mataria a assinatura.
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks).toString('utf8');
}

export const config = { api: { bodyParser: false } };

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'method not allowed' });
    return;
  }
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret) {
    // Sem secret configurado o endpoint não aceita NADA — fail closed. Um
    // webhook que aceita sem verificar é porta aberta pra injetar conversa
    // falsa na base.
    log.error('ELEVENLABS_WEBHOOK_SECRET não configurado — webhook rejeitado');
    res.status(503).json({ success: false, error: 'not configured' });
    return;
  }
  try {
    const body = await rawBody(req);
    const sig = req.headers['elevenlabs-signature'];
    const ok = verifyElSignature(body, typeof sig === 'string' ? sig : undefined, secret, Math.floor(Date.now() / 1000));
    if (!ok) {
      res.status(401).json({ success: false, error: 'invalid signature' });
      return;
    }

    const ev = parseElEvent(body);
    if (!ev) {
      // Tipo novo/desconhecido: 200 para a EL não re-tentar eternamente.
      res.status(200).json({ success: true, ignored: true });
      return;
    }

    const db = getDb();
    // Prospect pelo telefone (quando chamada telefônica): liga a conversa de
    // voz ao mesmo cadastro que a Vitória-texto usa.
    let prospectId: string | null = null;
    if (ev.phone) {
      const { data } = await db.from('prospects').select('id').eq('phone', ev.phone).maybeSingle();
      prospectId = (data as { id: string } | null)?.id ?? null;
    }

    const { error } = await db.from('voice_calls').upsert(
      {
        el_agent_id: ev.elAgentId,
        el_conversation_id: ev.elConversationId,
        status: ev.status,
        phone: ev.phone,
        prospect_id: prospectId,
        duration_secs: ev.durationSecs,
        cost_credits: ev.costCredits,
        summary: ev.summary,
        transcript: ev.transcript,
        analysis: ev.analysis,
        failure_reason: ev.failureReason,
      },
      { onConflict: 'el_conversation_id' }
    );
    if (error) {
      log.error('voice_calls upsert falhou:', error.message);
      // 500 de propósito: a EL re-tenta, e queremos o retry quando o banco
      // engasgar — o upsert torna o retry seguro.
      res.status(500).json({ success: false, error: 'store failed' });
      return;
    }
    log.info(`chamada ${ev.elConversationId} gravada (${ev.tipo}${ev.phone ? `, ${ev.phone.slice(0, 8)}…` : ''})`);
    res.status(200).json({ success: true });
  } catch (e) {
    log.error('el-webhook falhou:', (e as Error).message);
    res.status(500).json({ success: false, error: 'erro interno' });
  }
}
