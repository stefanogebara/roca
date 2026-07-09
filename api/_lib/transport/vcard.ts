/**
 * Minimal vCard parsing — enough to turn a shared contact card into text the
 * agents can use ("indico o João, agrônomo em Machado: +55..."). Handles the
 * shapes WhatsApp actually sends (FN + TEL lines, possibly multiple cards);
 * anything else is ignored rather than guessed.
 */

export interface ContactCard {
  name: string;
  phones: string[];
}

export function parseVcards(payload: string): ContactCard[] {
  if (!payload || !/BEGIN:VCARD/i.test(payload)) return [];
  const cards: ContactCard[] = [];
  for (const block of payload.split(/BEGIN:VCARD/i).slice(1)) {
    const name = block.match(/^FN[^:]*:(.+)$/im)?.[1]?.trim();
    const phones = [...block.matchAll(/^TEL[^:]*:(.+)$/gim)]
      .map((m) => m[1].trim())
      .filter(Boolean);
    if (name || phones.length) cards.push({ name: name ?? '(sem nome)', phones });
  }
  return cards;
}

/** One-line PT-BR summary of shared contact cards, for message text. */
export function describeContactCards(cards: ContactCard[]): string {
  if (cards.length === 0) return '[cartão de contato ilegível]';
  return cards
    .map((c) => `[contato compartilhado] ${c.name}${c.phones.length ? ` — ${c.phones.join(', ')}` : ''}`)
    .join('\n');
}
