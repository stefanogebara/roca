/**
 * Prospect dispatch cron — runs the outbound engine on a schedule so disparos
 * happen without a founder pressing the button. All safety rails live in
 * runDispatch itself (business hours BRT, 20/day cap, opt-outs, dedup,
 * ready-status only, jittered pacing); this wrapper only adds cron auth and
 * an audit response. Scheduled 3× on weekday business hours; each run sends
 * at most one batch (8), so the daily cap is reached gradually, not in bursts.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runDispatch } from '../_lib/prospect/dispatch';
import { createLogger } from '../_lib/logger';
import { alertFounders } from '../_lib/alert';

const log = createLogger('dispatch-cron');

function authorized(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers['authorization'] === `Bearer ${secret}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!authorized(req)) {
    res.status(401).json({ success: false, error: 'unauthorized' });
    return;
  }
  try {
    // Varredura ANTES do lote: alerta que nao confirmou entrega no WhatsApp vai
    // por e-mail. Roda primeiro de proposito — o alerta que este mesmo cron
    // gerar daqui a pouco ainda esta dentro da janela e nao seria escalado.
    try {
      const { varrerAlertasNaoEntregues } = await import('../_lib/alertDelivery');
      const v = await varrerAlertasNaoEntregues();
      if (v.pendentes) log.info(`alertas nao entregues: ${v.pendentes} (${v.escalados} escalados)`);
    } catch (e) {
      log.error('varredura de alertas falhou:', (e as Error).message);
    }

    // ?dryRun=1 plans without sending. It did NOT exist on 27/jul: the param
    // was silently ignored and a "preview" call shipped 8 real templates. A
    // flag that looks like it works and doesn't is worse than no flag.
    const dryRun = ['1', 'true', 'yes'].includes(String(req.query?.dryRun ?? '').toLowerCase());
    const report = await runDispatch({ dryRun });
    if (dryRun) {
      // Bumps are skipped entirely in a dry run — nothing should leave.
      res.status(200).json({ success: true, data: { ...report, bumps: null, note: 'dry run — nada foi enviado' } });
      return;
    }
    log.info(
      `dispatch cron: sent=${report.sent} failed=${report.failed} eligible=${report.eligible}` +
        (report.skippedOutsideHours ? ' (outside hours)' : '') +
        (report.aborted ? ' (ABORTED)' : '')
    );
    // O bump D+3 rodava aqui. Morto em 05/ago: 23 envios, zero humanos — ver o
    // epitáfio em prospect/dispatch.ts. `bumps` fica null para o resumo, que já
    // tratava a ausência (o dry-run sempre mandou null).
    const bumps = null;
    // A "automação diária" (02/ago): o resumo do lote vai pros founders por
    // WhatsApp no fim de cada lote REAL — o disparo é o evento, sem cron novo.
    // Fail-soft: um ping que falha jamais derruba um lote que já saiu.
    try {
      const { resumoDoLote } = await import('../_lib/notify');
      const texto = resumoDoLote(report, bumps);
      // alertFounders, NÃO um send de texto livre pelo Cloud API: mensagem
      // iniciada pelo negócio fora da janela de 24h da Meta só passa como
      // TEMPLATE (o próprio registry documenta isso em ALERT_NAME). Às 10h05 de
      // segunda nenhum founder tem janela aberta com o número da Stevi, então o
      // texto livre morreria com 131047 — e o catch aqui engoliria em silêncio.
      // alertFounders é o caminho da casa: webhook independente primeiro,
      // WhatsApp como fallback. Mesmo canal do alerta de lead e de incidente.
      if (texto) await alertFounders(texto);
    } catch (e) {
      log.error('resumo do lote pros founders falhou:', (e as Error).message);
    }
    res.status(200).json({ success: true, data: { ...report, bumps } });
  } catch (e) {
    log.error('dispatch cron failed:', (e as Error).message);
    res.status(500).json({ success: false, error: 'erro interno' });
  }
}
