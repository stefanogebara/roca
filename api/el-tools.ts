/**
 * Ferramentas server-side do agente de voz (function calling do ElevenLabs).
 *
 * Durante a ligação, o agente chama estes endpoints para (a) puxar o contexto
 * do prospect antes de falar e (b) registrar o resultado combinado na chamada.
 * Auth por shared secret no header `x-el-tools-secret` — o agente EL manda o
 * header configurado no tool; sem ele, nada responde. Fail closed sem env.
 *
 * O registro entra na MESMA thread do prospect que a Vitória-texto usa
 * (prospect_messages, kind 'voice-note'): founders leem tudo num lugar só no
 * painel, voz e texto entrelaçados na ordem real.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/db';
import { createLogger } from './_lib/logger';

const log = createLogger('el-tools');

function autorizado(req: VercelRequest): boolean {
  const secret = process.env.EL_TOOLS_SECRET;
  if (!secret) return false; // fail closed
  return req.headers['x-el-tools-secret'] === secret;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!autorizado(req)) {
    res.status(401).json({ success: false, error: 'unauthorized' });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'method not allowed' });
    return;
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {});
    const action = String((body as { action?: unknown }).action ?? '');
    const phone = String((body as { phone?: unknown }).phone ?? '').trim();
    const db = getDb();

    if (action === 'contexto') {
      // O agente liga sabendo com quem fala: nome, tipo, cidade e o que já
      // foi conversado no WhatsApp (últimas mensagens da thread).
      if (!phone) {
        res.status(400).json({ success: false, error: 'phone required' });
        return;
      }
      const { data: p } = await db
        .from('prospects')
        .select('id, name, kind, city, uf, status, qualification')
        .eq('phone', phone)
        .maybeSingle();
      if (!p) {
        res.status(200).json({ success: true, data: { conhecido: false } });
        return;
      }
      const { data: msgs } = await db
        .from('prospect_messages')
        .select('direction, text, created_at')
        .eq('prospect_id', (p as { id: string }).id)
        .order('created_at', { ascending: false })
        .limit(6);
      res.status(200).json({
        success: true,
        data: { conhecido: true, prospect: p, ultimasMensagens: (msgs ?? []).reverse() },
      });
      return;
    }

    if (action === 'registrar') {
      // O que ficou combinado na ligação, na voz do agente — vira nota na
      // thread do prospect, visível no painel junto do WhatsApp.
      const nota = String((body as { nota?: unknown }).nota ?? '').trim();
      if (!phone || !nota) {
        res.status(400).json({ success: false, error: 'phone and nota required' });
        return;
      }
      const { data: p } = await db.from('prospects').select('id').eq('phone', phone).maybeSingle();
      if (!p) {
        res.status(404).json({ success: false, error: 'prospect não encontrado' });
        return;
      }
      const { error } = await db.from('prospect_messages').insert({
        prospect_id: (p as { id: string }).id,
        direction: 'out',
        kind: 'voice-note',
        text: `📞 [ligação] ${nota.slice(0, 500)}`,
      });
      if (error) {
        log.error('registrar falhou:', error.message);
        res.status(500).json({ success: false, error: 'store failed' });
        return;
      }
      res.status(200).json({ success: true });
      return;
    }

    res.status(400).json({ success: false, error: 'unknown action' });
  } catch (e) {
    log.error('el-tools falhou:', (e as Error).message);
    res.status(500).json({ success: false, error: 'erro interno' });
  }
}
