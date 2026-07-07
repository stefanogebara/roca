/** One-off: extract text from a PDF (pdf-parse v2 API, fallback to v1). */
import { readFileSync, writeFileSync } from 'node:fs';
import * as mod from 'pdf-parse';

const src = process.argv[2];
const out = process.argv[3] ?? 'extracted.txt';
const buf = readFileSync(src);

let text;
if (mod.PDFParse) {
  const parser = new mod.PDFParse({ data: new Uint8Array(buf) });
  const result = await parser.getText();
  text = result.text;
} else {
  const fn = mod.default ?? mod;
  const result = await fn(buf);
  text = result.text;
}
writeFileSync(out, text);
console.log(`extracted ${text.length} chars -> ${out}`);
