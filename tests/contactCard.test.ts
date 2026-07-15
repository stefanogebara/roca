import { describe, it, expect } from 'vitest';
import { steviVCard } from '../api/_lib/contactCard';

describe('steviVCard', () => {
  it('is a well-formed vCard 3.0 with the number, brand, and CRLF lines', () => {
    const v = steviVCard('19705509125');
    expect(v.startsWith('BEGIN:VCARD\r\n')).toBe(true);
    expect(v.trimEnd().endsWith('END:VCARD')).toBe(true);
    expect(v).toContain('VERSION:3.0');
    expect(v).toContain('FN:Stevi — Assistente do Cafeicultor');
    expect(v).toContain('TEL;TYPE=CELL,VOICE:+19705509125');
    expect(v).toContain('URL:https://wa.me/19705509125');
    expect(v).toContain('\r\n'); // CRLF per spec
  });

  it('normalizes a punctuated/prefixed number to E.164 digits', () => {
    const v = steviVCard('+1 (970) 550-9125');
    expect(v).toContain('TEL;TYPE=CELL,VOICE:+19705509125');
    expect(v).toContain('wa.me/19705509125');
  });

  it('escapes commas in the NOTE so the card stays valid', () => {
    const v = steviVCard('19705509125');
    expect(v).toMatch(/NOTE:.*\\,/); // commas must be backslash-escaped
  });

  it('never claims a product/dose (compliance framing intact)', () => {
    const v = steviVCard('19705509125');
    expect(v).toMatch(/quem receita.*é o agrônomo/i);
    expect(v).not.toMatch(/aplique|dose/i);
  });
});
