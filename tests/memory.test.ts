import { describe, it, expect } from 'vitest';
import { formatTurnsBlock, type Turn } from '../api/_lib/memory';

describe('formatTurnsBlock', () => {
  const turns: Turn[] = [
    { role: 'produtor', text: 'que praga é essa na soja?' },
    { role: 'stevi', text: 'Pelas fotos parece ferrugem asiática. O importante é monitorar.' },
    { role: 'produtor', text: 'e o que eu faço?' },
  ];

  it('renders chronological labeled turns', () => {
    const b = formatTurnsBlock(turns);
    expect(b).toContain('Produtor: que praga é essa na soja?');
    expect(b).toContain('Stevi: Pelas fotos parece ferrugem');
    expect(b.indexOf('que praga')).toBeLessThan(b.indexOf('e o que eu faço'));
  });

  it('instructs the model to use, not repeat, the context', () => {
    expect(formatTurnsBlock(turns)).toMatch(/contexto/i);
  });

  it('returns null for no history', () => {
    expect(formatTurnsBlock([])).toBeNull();
  });

  it('truncates very long turns', () => {
    const b = formatTurnsBlock([{ role: 'produtor', text: 'x'.repeat(1000) }]);
    expect(b!.length).toBeLessThan(400);
  });
});
