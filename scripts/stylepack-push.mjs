/**
 * Push a style pack from git to the DB (and optionally activate it).
 *
 *   node scripts/stylepack-push.mjs prompts/style-packs/v1 --activate
 *
 * Each pack lives at prompts/style-packs/vN/README.md (git = durable source of
 * truth; the DB row is the runtime copy). Everything above the first `---` line
 * is a git-facing header and is stripped; the rest is the body sent to the
 * model. --activate deactivates every other pack first (partial unique index
 * allows one active). Production picks changes up within ~3 min (cache TTL).
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const arg = process.argv[2];
const activate = process.argv.includes('--activate');
const notes = (process.argv.find((a) => a.startsWith('--notes=')) ?? '').slice(8) || null;

if (!arg) {
  console.error('usage: node scripts/stylepack-push.mjs prompts/style-packs/vN [--activate] [--notes="..."]');
  process.exit(1);
}

const dir = arg.replace(/[\\/]README\.md$/i, '');
const m = basename(dir).match(/^v(\d+)$/);
if (!m) {
  console.error(`pack path must end in vN or vN/README.md (got ${arg})`);
  process.exit(1);
}
const version = Number(m[1]);
const file = join(dir, 'README.md');
if (!existsSync(file)) {
  console.error(`missing ${file}`);
  process.exit(1);
}

const raw = readFileSync(file, 'utf8');
const sep = raw.indexOf('\n---');
const body = (sep >= 0 ? raw.slice(raw.indexOf('\n', sep + 2) + 1) : raw).trim();
if (body.length < 100) {
  console.error(`pack body suspiciously short (${body.length} chars) — check the --- separator`);
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
);
const URL_ = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

async function rest(method, path, body_, extra = {}) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    method,
    headers: { ...headers, ...extra },
    body: body_ ? JSON.stringify(body_) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

// Upsert the pack body (inactive first — activation is a separate, deliberate step).
await rest('POST', 'style_packs?on_conflict=version', [{ version, body, notes }], {
  Prefer: 'resolution=merge-duplicates',
});
console.log(`pushed v${version} (${body.length} chars)`);

if (activate) {
  await rest('PATCH', 'style_packs?active=eq.true', { active: false });
  await rest('PATCH', `style_packs?version=eq.${version}`, { active: true });
  console.log(`activated v${version} — production picks it up within ~3 min`);
} else {
  console.log('not activated (pass --activate to make it live)');
}
