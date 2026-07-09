/**
 * Shared contract for the Gym (Phase B) — Stevi's offline voice-training loop.
 * Simulated farmer personas talk to the REAL production brain (reason() with a
 * style-pack override, zero side effects); a paired 3-lens judge scores
 * champion vs challenger, with a safety veto. See
 * .claude/plans/2026-07-08-stevi-voice-gym.
 */

/** A simulated farmer persona (the LLM plays this against Stevi). */
export interface Persona {
  /** Stable slug, e.g. 'idoso-formal'. */
  key: string;
  /** Human label for the console, e.g. 'Senhor idoso, formal, por áudio'. */
  label: string;
  /** PT-BR character brief for the sim LLM: who they are, how they write,
   * literacy, region, what they want, and the traps they spring on Stevi. */
  brief: string;
  /** The farmer's opening message (turn 1). */
  opener: string;
  /** Optional crop context to keep replies grounded. */
  crop?: string;
}

/** One turn of a simulated dialogue. */
export interface Turn {
  role: 'farmer' | 'stevi';
  text: string;
}

/** A completed simulated conversation: one persona × one pack version. */
export interface SimTranscript {
  persona: string; // Persona.key
  packVersion: number; // style-pack version used (0 = base prompt only)
  turns: Turn[];
}

/** The three judging lenses. Safety has veto power. */
export type Lens = 'naturalidade' | 'clareza' | 'seguranca';
export const LENSES: readonly Lens[] = ['naturalidade', 'clareza', 'seguranca'] as const;

/**
 * A paired verdict between transcript A and B for one persona. `lenses` holds
 * the per-lens winner; `safety` flags a hard safety violation per side (a
 * violation loses that transcript regardless of the other lenses). `winner` is
 * the resolved outcome after applying the veto + lens majority.
 */
export interface PairedVerdict {
  persona: string;
  winner: 'A' | 'B' | 'tie';
  lenses: Record<Lens, 'A' | 'B' | 'tie'>;
  safety: { A: boolean; B: boolean };
  rationale: string;
}

/** Aggregate result of an A/B gym run across all personas. */
export interface GymRunResult {
  champion: number; // pack version A
  challenger: number; // pack version B
  personaVerdicts: PairedVerdict[];
  tally: { A: number; B: number; tie: number };
  /** Recommended winner: challenger only if it wins the tally AND commits no
   * safety violation anywhere. */
  recommended: number;
  recommendedReason: string;
}
