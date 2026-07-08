import { describe, it, expect } from 'vitest';
import {
  buttonsForIntent,
  isFieldHealthRequest,
  isReferralRequest,
} from '../api/_lib/pipeline';
import type { Intent } from '../api/_lib/router';

const ALL_INTENTS: Intent[] = [
  'pest_triage',
  'spray_window',
  'field_profile',
  'field_health',
  'general',
  'onboarding',
  'smalltalk',
  'referral',
];

describe('buttonsForIntent', () => {
  it('respects WhatsApp constraints everywhere: ≤3 buttons, ≤20 chars each', () => {
    for (const intent of ALL_INTENTS) {
      const b = buttonsForIntent(intent);
      if (!b) continue;
      expect(b.length, intent).toBeLessThanOrEqual(3);
      for (const title of b) {
        expect(title.length, `"${title}" (${intent})`).toBeLessThanOrEqual(20);
        expect(title.trim(), intent).toBe(title);
      }
    }
  });

  it('button titles are unique within a message (WhatsApp requirement)', () => {
    for (const intent of ALL_INTENTS) {
      const b = buttonsForIntent(intent);
      if (!b) continue;
      expect(new Set(b).size).toBe(b.length);
    }
  });

  it('offers next steps after the main flows, none after terminal ones', () => {
    expect(buttonsForIntent('smalltalk')).toBeDefined();
    expect(buttonsForIntent('spray_window')).toBeDefined();
    expect(buttonsForIntent('field_health')).toBeDefined();
    expect(buttonsForIntent('pest_triage')).toBeDefined();
    // Referral reply is terminal; onboarding asks a question buttons would fight.
    expect(buttonsForIntent('referral')).toBeUndefined();
    expect(buttonsForIntent('onboarding')).toBeUndefined();
  });

  it('every button title round-trips: a tap routes to the flow it promises', () => {
    // Titles ARE queries — the whole design. If these regexes stop matching the
    // titles, taps silently fall through to the generic router. Pin it.
    expect(isFieldHealthRequest('Ver satélite')).toBe(true);
    expect(isReferralRequest('Quero um agrônomo')).toBe(true);
    // 'Posso pulverizar?' goes through the LLM router (spray_window) — regex
    // guards don't apply, but it must not false-positive the other two.
    expect(isFieldHealthRequest('Posso pulverizar?')).toBe(false);
    expect(isReferralRequest('Posso pulverizar?')).toBe(false);
  });
});
