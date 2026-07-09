/**
 * Conversation memory — the last few turns, formatted as grounding context
 * for the reasoning model. Before this, every message was reasoned in
 * isolation: "e o que eu faço?" had no idea what "isso" was. Kept small
 * (few turns, truncated) — this is working memory, not the caderno.
 */

export interface Turn {
  role: 'produtor' | 'stevi';
  text: string;
}

const MAX_TURN_CHARS = 220;

/** Format recent turns as a prompt block, oldest first. Null when empty. */
export function formatTurnsBlock(turns: Turn[]): string | null {
  if (turns.length === 0) return null;
  const lines = turns.map(
    (t) =>
      `${t.role === 'produtor' ? 'Produtor' : 'Stevi'}: ${t.text.replace(/\s+/g, ' ').slice(0, MAX_TURN_CHARS)}`
  );
  return `[Conversa recente — use como contexto do que "isso/essa/aí" se refere; não repita]\n${lines.join('\n')}`;
}
