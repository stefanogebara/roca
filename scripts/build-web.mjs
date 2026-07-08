/**
 * "Build" the landing site: copy the deployable static assets from web/ (the
 * design source, which also holds DESIGN.md and screenshots) into public/, which
 * Vercel serves at the domain root alongside the /api functions. Relative asset
 * paths (styles.css, app.js, favicon.svg, og-image.png) resolve correctly at /.
 *
 * Run after any change under web/:  node scripts/build-web.mjs
 */
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'web';
const OUT = 'public';
const ASSETS = ['index.html', 'styles.css', 'app.js', 'favicon.svg', 'og-image.png'];

mkdirSync(OUT, { recursive: true });
let copied = 0;
for (const f of ASSETS) {
  const from = join(SRC, f);
  if (existsSync(from)) {
    copyFileSync(from, join(OUT, f));
    copied++;
    console.log(`  ${from} -> ${join(OUT, f)}`);
  } else {
    console.warn(`  (skip) ${from} not found`);
  }
}
console.log(`build-web: copied ${copied}/${ASSETS.length} assets to ${OUT}/`);
