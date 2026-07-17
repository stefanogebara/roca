/**
 * Intent-taxonomy guard (refactor M3). The `Intent` union is DERIVED from the
 * producer registries in router.ts (LLM / structural / fast-path / fallback), so
 * the type can't drift from the runtime allow-lists. This test locks the one
 * relationship types alone can't enforce: that the fast-path routes' declared
 * intents stay exactly in sync with router.ts's FASTPATH_INTENTS. Adding a route
 * with a new intent fails here until the registry is updated — and removing the
 * last route for an intent fails until it's dropped from the registry.
 */
import { describe, it, expect } from 'vitest';
import { ROUTES } from '../api/_lib/pipeline';
import {
  LLM_INTENTS,
  STRUCTURAL_INTENTS,
  FASTPATH_INTENTS,
  FALLBACK_INTENTS,
  type Intent,
} from '../api/_lib/router';

describe('intent taxonomy', () => {
  it('every route declares an intent that is registered as a fast-path intent', () => {
    for (const r of ROUTES) {
      expect(FASTPATH_INTENTS as readonly Intent[]).toContain(r.intent);
    }
  });

  it('FASTPATH_INTENTS covers exactly the intents the routes emit (no drift either way)', () => {
    const declaredByRoutes = [...new Set(ROUTES.map((r) => r.intent))].sort();
    const registered = [...new Set<Intent>(FASTPATH_INTENTS)].sort();
    expect(registered).toEqual(declaredByRoutes);
  });

  it('the producer registries are populated (guards an accidental empty/renamed set)', () => {
    // Exhaustiveness of the Intent union is structural — it is derived from these
    // arrays — so this only guards against a registry being emptied or renamed.
    expect(LLM_INTENTS.length).toBeGreaterThan(0);
    expect(STRUCTURAL_INTENTS.length).toBeGreaterThan(0);
    expect(FALLBACK_INTENTS).toContain('field_health');
  });
});
