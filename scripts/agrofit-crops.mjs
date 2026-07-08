/** List distinct CULTURA values matching coffee/citrus, with row counts, to
 * determine the exact strings for the extract. Streaming (file ~370 MB). */
import { createReadStream } from 'node:fs';
import { parse } from 'csv-parse';

const FILE = 'knowledge/agrofit/produtos_formulados.csv';
const re = /caf[eé]|citr|laranja|lim[aã]o|tangerin|pomar/i;
const counts = new Map();

const parser = createReadStream(FILE, 'utf8').pipe(
  parse({ delimiter: ';', columns: true, relax_quotes: true, skip_records_with_error: true })
);
for await (const row of parser) {
  const c = (row.CULTURA ?? '').trim();
  if (re.test(c)) counts.set(c, (counts.get(c) ?? 0) + 1);
}
const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
for (const [c, n] of sorted) console.log(`${n}\t${c}`);
