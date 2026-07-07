/**
 * Central env access. Required vars fail fast with a clear message;
 * optional vars return undefined so callers can degrade gracefully.
 */

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// OpenRouter slugs. Reason by tier: cheap classifier vs. flagship reasoning;
// transcription needs an audio-capable multimodal model.
export const MODELS = {
  router: () => process.env.ROCA_ROUTER_MODEL || 'anthropic/claude-haiku-4.5',
  reasoning: () => process.env.ROCA_REASONING_MODEL || 'anthropic/claude-sonnet-5',
  transcribe: () => process.env.ROCA_TRANSCRIBE_MODEL || 'google/gemini-2.5-flash',
};
