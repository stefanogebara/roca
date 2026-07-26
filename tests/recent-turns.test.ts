/**
 * Conversation-history window.
 *
 * Regression for a real production reply (26/07): the founder sent a bare "oi"
 * to the new BR number and Stevi answered "E aí, sabe me dizer se essa área do
 * NDVI baixo é o café, o milho ou o eucalipto?" — picking up a thread from 11
 * days earlier as if it were mid-conversation. History was fetched by count
 * only, never by age, so a stale session leaked into the prompt and the farmer
 * got a question they had no way to place.
 */
import { describe, it, expect } from 'vitest';
import { selectRecentTurns, type TurnRow } from '../api/_lib/db';

const NOW = new Date('2026-07-26T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

const row = (over: Partial<TurnRow>): TurnRow => ({
  direction: 'in',
  raw: 'texto',
  transcript: null,
  provider_message_id: null,
  created_at: hoursAgo(1),
  ...over,
});

describe('selectRecentTurns', () => {
  it('keeps a live session (same day) in order, oldest first', () => {
    const turns = selectRecentTurns(
      [
        row({ direction: 'out', raw: 'veredito: pode pulverizar', created_at: hoursAgo(2) }),
        row({ direction: 'in', raw: 'posso pulverizar?', created_at: hoursAgo(3) }),
      ],
      { now: NOW }
    );
    expect(turns).toEqual([
      { role: 'produtor', text: 'posso pulverizar?' },
      { role: 'stevi', text: 'veredito: pode pulverizar' },
    ]);
  });

  it('DROPS a session older than the window — the actual bug', () => {
    const turns = selectRecentTurns(
      [
        row({ direction: 'out', raw: 'essa área do NDVI baixo é café?', created_at: hoursAgo(11 * 24) }),
        row({ direction: 'in', raw: 'como está minha lavoura?', created_at: hoursAgo(11 * 24 + 1) }),
      ],
      { now: NOW }
    );
    expect(turns).toEqual([]); // a bare "oi" must not inherit an 11-day-old thread
  });

  it('keeps yesterday (inside 48h) — "voltei no dia seguinte" is the same conversation', () => {
    const turns = selectRecentTurns([row({ raw: 'e a ferrugem?', created_at: hoursAgo(30) })], { now: NOW });
    expect(turns).toHaveLength(1);
  });

  it('cuts a mixed history at the window boundary, keeping only the fresh part', () => {
    const turns = selectRecentTurns(
      [
        row({ direction: 'in', raw: 'oi', created_at: hoursAgo(1) }),
        row({ direction: 'out', raw: 'resposta velha', created_at: hoursAgo(200) }),
        row({ direction: 'in', raw: 'pergunta velha', created_at: hoursAgo(201) }),
      ],
      { now: NOW }
    );
    expect(turns).toEqual([{ role: 'produtor', text: 'oi' }]);
  });

  it('excludes the message being handled right now', () => {
    const turns = selectRecentTurns(
      [
        row({ raw: 'mensagem atual', provider_message_id: 'wamid.CURRENT' }),
        row({ raw: 'anterior', provider_message_id: 'wamid.OLD' }),
      ],
      { now: NOW, currentMessageId: 'wamid.CURRENT' }
    );
    expect(turns).toEqual([{ role: 'produtor', text: 'anterior' }]);
  });

  it('prefers the transcript over raw (voice notes) and drops empties', () => {
    const turns = selectRecentTurns(
      [
        row({ raw: null, transcript: 'áudio transcrito' }),
        row({ raw: '   ', transcript: null }),
      ],
      { now: NOW }
    );
    expect(turns).toEqual([{ role: 'produtor', text: 'áudio transcrito' }]);
  });

  it('respects the limit, keeping the most recent turns', () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      row({ raw: `msg ${i}`, created_at: hoursAgo(i + 1) })
    );
    const turns = selectRecentTurns(rows, { now: NOW, limit: 3 });
    expect(turns.map((t) => t.text)).toEqual(['msg 2', 'msg 1', 'msg 0']);
  });

  it('a row without created_at is not trusted into the window', () => {
    const turns = selectRecentTurns([row({ created_at: null, raw: 'sem data' })], { now: NOW });
    expect(turns).toEqual([]);
  });
});
