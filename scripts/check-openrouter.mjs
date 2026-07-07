/**
 * Validate an OpenRouter key and list current Anthropic model slugs.
 * Usage: node scripts/check-openrouter.mjs <env-file>
 */
import { readFileSync } from 'node:fs';

const file = process.argv[2] ?? '.env';
const txt = readFileSync(file, 'utf8');
const m = txt.match(/^OPENROUTER_API_KEY="?([^"\r\n]+)"?/m);
const key = m?.[1]?.trim();
if (!key) {
  console.log(`no OPENROUTER_API_KEY in ${file}`);
  process.exit(1);
}

const auth = { Authorization: `Bearer ${key}` };

// Key validity + credit state
const me = await fetch('https://openrouter.ai/api/v1/auth/key', { headers: auth });
const meJson = await me.json();
console.log(`key check: status=${me.status}`, JSON.stringify(meJson.data ?? meJson.error ?? {}).slice(0, 200));

// A tiny live completion to prove end-to-end
const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: { ...auth, 'content-type': 'application/json' },
  body: JSON.stringify({
    model: 'anthropic/claude-haiku-4.5',
    max_tokens: 8,
    messages: [{ role: 'user', content: 'oi' }],
  }),
});
const j = await r.json();
console.log(
  `haiku completion: status=${r.status}`,
  j.error ? JSON.stringify(j.error).slice(0, 200) : `OK (${j.model})`
);

// Current anthropic slugs
const models = await fetch('https://openrouter.ai/api/v1/models', { headers: auth });
const mj = await models.json();
const anthropic = (mj.data ?? [])
  .map((x) => x.id)
  .filter((id) => id.startsWith('anthropic/'))
  .sort();
console.log('anthropic slugs:', anthropic.join(', '));
