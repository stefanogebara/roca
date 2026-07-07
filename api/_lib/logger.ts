/**
 * Minimal structured logger that masks phone numbers (LGPD: wa_id is
 * personal data — never log it in full).
 */

function maskPhones(text: string): string {
  return text.replace(/\+?\d{10,15}/g, (m) => `${m.slice(0, 5)}***${m.slice(-2)}`);
}

function serialize(arg: unknown): string {
  if (typeof arg === 'string') return maskPhones(arg);
  if (arg instanceof Error) return maskPhones(`${arg.name}: ${arg.message}`);
  try {
    return maskPhones(JSON.stringify(arg));
  } catch {
    return '[unserializable]';
  }
}

export function createLogger(scope: string) {
  const prefix = `[${scope}]`;
  return {
    info: (...args: unknown[]) => process.stdout.write(`${prefix} ${args.map(serialize).join(' ')}\n`),
    error: (...args: unknown[]) => process.stderr.write(`${prefix} ERROR ${args.map(serialize).join(' ')}\n`),
  };
}
