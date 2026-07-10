import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireOps } from '../_lib/opsAuth';
import { createLogger } from '../_lib/logger';
import { parseProspectLines, type ProspectStatus } from '../_lib/prospect/core';
import {
  listProspects,
  importProspects,
  setProspectStatus,
  getProspectThread,
  setProspectAgentEnabled,
} from '../_lib/prospect/db';
import { runDispatch } from '../_lib/prospect/dispatch';

const log = createLogger('ops');
const STATUSES = new Set(['discovered', 'ready', 'contacted', 'replied', 'discarded']);

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!requireOps(req, res)) return;
  try {
    if (req.method !== 'POST') {
      res.status(200).json({ success: true, data: await listProspects() });
      return;
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {};
    const action = String((body as { action?: unknown }).action ?? '');

    if (action === 'import') {
      const text = String((body as { text?: unknown }).text ?? '');
      const parsed = parseProspectLines(text);
      const invalid = parsed.filter((p) => p.wa_status === 'invalid').length;
      const inserted = await importProspects(
        parsed.map((p) => ({ ...p, source: 'manual' as const }))
      );
      res.status(200).json({ success: true, data: { parsed: parsed.length, inserted, invalid } });
      return;
    }

    if (action === 'status') {
      const id = String((body as { id?: unknown }).id ?? '');
      const status = String((body as { status?: unknown }).status ?? '');
      if (!id || !STATUSES.has(status)) {
        res.status(400).json({ success: false, error: 'id and a valid status are required' });
        return;
      }
      const ok = await setProspectStatus(id, status as ProspectStatus);
      res.status(ok ? 200 : 500).json(ok ? { success: true } : { success: false, error: 'update failed' });
      return;
    }

    if (action === 'source') {
      const { runSourcing } = await import('../_lib/prospect/source');
      res.status(200).json({ success: true, data: await runSourcing() });
      return;
    }

    if (action === 'thread') {
      const id = String((body as { id?: unknown }).id ?? '');
      if (!id) {
        res.status(400).json({ success: false, error: 'id required' });
        return;
      }
      res.status(200).json({ success: true, data: await getProspectThread(id, 100) });
      return;
    }

    if (action === 'agent') {
      const id = String((body as { id?: unknown }).id ?? '');
      const enabled = (body as { enabled?: unknown }).enabled === true;
      if (!id) {
        res.status(400).json({ success: false, error: 'id required' });
        return;
      }
      await setProspectAgentEnabled(id, enabled);
      res.status(200).json({ success: true });
      return;
    }

    if (action === 'template') {
      // Submit a registry template (idempotent) and report its approval
      // status — avoids the WhatsApp Manager UI round-trip. Defaults to the
      // v2 intro; pass name for others (e.g. the D+3 bump).
      const { submitTemplate, V2_NAME } = await import('../_lib/prospect/template');
      const name = String((body as { name?: unknown }).name ?? V2_NAME);
      res.status(200).json({ success: true, data: await submitTemplate(name) });
      return;
    }

    if (action === 'dispatch') {
      const dryRun = (body as { dryRun?: unknown }).dryRun !== false; // default to a safe dry-run
      const report = await runDispatch({ dryRun });
      res.status(200).json({ success: true, data: report });
      return;
    }

    res.status(400).json({ success: false, error: 'unknown action' });
  } catch (e) {
    log.error('prospects failed:', (e as Error).message);
    res.status(500).json({ success: false, error: 'erro interno' });
  }
}
