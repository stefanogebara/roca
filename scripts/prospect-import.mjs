/**
 * Prospect sourcing importer — feeds curated JSONL into the prospects table.
 *
 *   npx tsx scripts/prospect-import.mjs <file.jsonl> [--source=batch-name]
 *
 * Input: one JSON object per line: {name, phone, kind, city, uf, source}.
 * Every phone is validated through the P1 core's normalizePhoneBR — invalid or
 * missing numbers import with wa_status 'invalid'/'pending' (visible in the
 * painel for a human to fix), NEVER fabricated. Import lands as status
 * 'discovered': nothing is sent until ops reviews → 'ready' → dispatch, so
 * this script is read-safe for the sender number.
 */
import { readFileSync } from 'node:fs';

for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const i = line.indexOf('=');
  if (i > 0 && !line.trimStart().startsWith('#')) {
    const k = line.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
  }
}

const file = process.argv[2];
if (!file) {
  console.error('usage: npx tsx scripts/prospect-import.mjs <file.jsonl> [--source=name]');
  process.exit(1);
}
const sourceTag = (process.argv[3] ?? '').replace(/^--source=/, '') || null;

const { normalizePhoneBR } = await import('../api/_lib/prospect/core.ts');
const { importProspects } = await import('../api/_lib/prospect/db.ts');

const rows = [];
let skipped = 0;
for (const line of readFileSync(file, 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || !t.startsWith('{')) continue;
  let obj;
  try {
    obj = JSON.parse(t);
  } catch {
    skipped++;
    continue;
  }
  if (!obj.name || !obj.source) {
    skipped++;
    continue;
  }
  const phone = normalizePhoneBR(obj.phone);
  rows.push({
    name: String(obj.name).slice(0, 120),
    phone,
    wa_status: phone ? 'pending' : 'invalid',
    kind: String(obj.kind ?? 'outro').slice(0, 40),
    city: obj.city ? String(obj.city).slice(0, 80) : null,
    uf: obj.uf ? String(obj.uf).slice(0, 2).toUpperCase() : null,
    source: sourceTag ? `${sourceTag}: ${obj.source}`.slice(0, 300) : String(obj.source).slice(0, 300),
  });
}

const withPhone = rows.filter((r) => r.phone).length;
console.log(`parsed ${rows.length} rows (${withPhone} with valid BR phone, ${rows.length - withPhone} needing manual contact) · ${skipped} skipped`);
const inserted = await importProspects(rows);
console.log(`imported ${inserted} new prospects (dedup skipped ${rows.length - inserted})`);
