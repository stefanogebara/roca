/** Profile the Agrofit CSV: row count, column consistency, SITUACAO values,
 * and how many rows match our focus crops. Streaming (file is ~370 MB). */
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const FILE = 'knowledge/agrofit/produtos_formulados.csv';
const rl = createInterface({ input: createReadStream(FILE, 'utf8'), crlfDelay: Infinity });

let header = null;
let rows = 0;
let badCols = 0;
const situacao = new Map();
const cropHits = { soja: 0, milho: 0, pasto: 0, todas: 0 };
const cropRe = { soja: /soja/i, milho: /milho/i, pasto: /pastagem|pasto|capim|forrage/i, todas: /todas as culturas/i };

for await (const line of rl) {
  if (!header) {
    header = line.split(';');
    continue;
  }
  if (!line.trim()) continue;
  rows++;
  const cols = line.split(';');
  if (cols.length !== header.length) badCols++;
  const situ = (cols[14] ?? '').trim();
  situacao.set(situ, (situacao.get(situ) ?? 0) + 1);
  const cultura = cols[7] ?? '';
  for (const [k, re] of Object.entries(cropRe)) if (re.test(cultura)) cropHits[k]++;
}

console.log('columns:', header.length, '->', header.join(' | '));
console.log('rows:', rows, 'badColCount:', badCols);
console.log('SITUACAO:', [...situacao.entries()].map(([k, v]) => `${k}=${v}`).join(', '));
console.log('crop hits:', JSON.stringify(cropHits));
