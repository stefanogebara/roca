/**
 * Validate an Anthropic API key from an env file against the live API.
 * Usage: node scripts/check-key.mjs <env-file> [VAR_NAME]
 */
import { readFileSync } from 'node:fs';

const file = process.argv[2] ?? '.env';
const varName = process.argv[3] ?? 'ANTHROPIC_API_KEY';

const txt = readFileSync(file, 'utf8');
const re = new RegExp(`^${varName}="?([^"\\r\\n]+)"?`, 'm');
const m = txt.match(re);
const key = m?.[1]?.trim();

if (!key) {
  console.log(`no ${varName} in ${file}`);
  process.exit(1);
}
console.log(`len=${key.length} prefix=${key.slice(0, 14)}...`);

const r = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8,
    messages: [{ role: 'user', content: 'oi' }],
  }),
});
const j = await r.json();
console.log(`status=${r.status}`, j.error ? JSON.stringify(j.error).slice(0, 160) : 'VALID');
