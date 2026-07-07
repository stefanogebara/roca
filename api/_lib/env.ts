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

export function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const MODELS = {
  router: () => process.env.ROCA_ROUTER_MODEL || 'claude-haiku-4-5-20251001',
  reasoning: () => process.env.ROCA_REASONING_MODEL || 'claude-sonnet-5',
};
