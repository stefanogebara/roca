/**
 * Caderno de campo (passivo) — "meu histórico". The retention moat, v1.
 *
 * Every triage, spray verdict, satellite read and referral already lands in
 * the message log; this turns that log into the farmer's season record with
 * ZERO extra effort from them (the documented agtech death pattern is asking
 * farmers to do data entry). v1 reads the outbound-intent log; later versions
 * can enrich with structured events (diagnosed pest, treatments mentioned).
 */

import type { FarmProfile } from './db';

export interface ActivityRow {
  intent: string | null;
  created_at: string;
}

/** Which logged intents count as season events (everything else is noise). */
const EVENT_LABELS: Record<string, { label: string; plural: string }> = {
  pest_triage: { label: '📷 triagem de praga/doença', plural: 'triagens de praga/doença' },
  spray_window: { label: '💨 janela de pulverização', plural: 'consultas de janela de pulverização' },
  field_health: { label: '🛰️ leitura de satélite', plural: 'leituras de satélite' },
  referral: { label: '🤝 pedido de agrônomo', plural: 'pedidos de agrônomo' },
  brief: { label: '📋 resumo pro agrônomo', plural: 'resumos pro agrônomo' },
};

function dm(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}

/** Compose the "meu histórico" reply. Pure — unit-tested. */
export function buildHistoryReply(profile: FarmProfile, rows: ActivityRow[]): string {
  const events = rows
    .filter((r) => r.intent && EVENT_LABELS[r.intent])
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const header: string[] = [];
  const quem: string[] = [];
  if (profile.crop?.length) quem.push(profile.crop.join(', '));
  if (profile.uf) quem.push(profile.uf);
  header.push(`🌱 *Seu histórico com a Stevi*${quem.length ? ` — ${quem.join(' · ')}` : ''}`);

  if (events.length === 0) {
    return (
      header[0] +
      '\n\nAinda não temos histórico registrado por aqui. Manda uma foto de praga, pergunta ' +
      '"posso pulverizar hoje?" ou larga o pin da sua terra — eu vou guardando tudo pra você, ' +
      'sem você precisar anotar nada. 📒'
    );
  }

  const lines = [...header, ''];
  lines.push(`Desde ${dm(events[0].created_at)}:`);

  const counts = new Map<string, number>();
  for (const e of events) {
    counts.set(e.intent as string, (counts.get(e.intent as string) ?? 0) + 1);
  }
  for (const [intent, n] of counts) {
    const meta = EVENT_LABELS[intent];
    lines.push(`• ${n === 1 ? meta.label : `${n} ${meta.plural}`}`);
  }

  lines.push('');
  lines.push('Últimos registros:');
  for (const e of events.slice(-5)) {
    lines.push(`• ${dm(e.created_at)} — ${EVENT_LABELS[e.intent as string].label}`);
  }

  lines.push('');
  lines.push(
    '_Tudo isso fica guardado sozinho, como um caderno de campo — e você pode pedir "apaga meus dados" quando quiser._'
  );
  return lines.join('\n');
}
