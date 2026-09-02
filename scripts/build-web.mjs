/**
 * "Build" the landing site: copy the deployable static assets from web/ (the
 * design source, which also holds DESIGN.md and screenshots) into public/, which
 * Vercel serves at the domain root alongside the /api functions. Relative asset
 * paths (styles.css, app.js, favicon.svg, og-image.png) resolve correctly at /.
 *
 * Run after any change under web/:  node scripts/build-web.mjs
 */
import { mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SRC = 'web';
const OUT = 'public';
const ASSETS = ['index.html', 'styles.css', 'app.js', 'favicon.svg', 'og-image.png', 'painel.html'];
/** Pastas copiadas inteiras (vídeos e fotos do hero e das seções). */
const DIRS = ['media'];

/**
 * Número embutido no HTML de origem. Tem que ser o mesmo
 * DEFAULT_PUBLIC_WA_NUMBER de api/_lib/waNumber.ts — tests/wa-number.test.ts
 * falha se divergirem, porque metade do kit apontando pra um número e metade pro
 * outro é o pior resultado possível de uma migração.
 */
const DEFAULT_WA = '19705509125';

/**
 * O site é estático: sem esta substituição, trocar PUBLIC_WA_NUMBER na Vercel
 * move QR, .vcf, rodapé de card e links de compartilhamento, e deixa a LANDING
 * apontando pro número morto — o lugar mais público possível pra falhar.
 * Exportada pura pra ser testável.
 */
export function injectWaNumber(html, numero) {
  return html.split(DEFAULT_WA).join(numero);
}

function build() {
  const envNumero = (process.env.PUBLIC_WA_NUMBER ?? '').replace(/\D/g, '');
  const numero = envNumero || DEFAULT_WA;
  if (!envNumero) {
    // Grita no log do build: um deploy que sirva o número errado tem que ser
    // visível aqui, não descoberto por um produtor que mandou mensagem pro vazio.
    console.warn(`  (aviso) PUBLIC_WA_NUMBER não configurado — o site vai sair com ${DEFAULT_WA}`);
  }

  mkdirSync(OUT, { recursive: true });
  let copied = 0;
  for (const f of ASSETS) {
    const from = join(SRC, f);
    if (!existsSync(from)) {
      console.warn(`  (skip) ${from} not found`);
      continue;
    }
    const to = join(OUT, f);
    if (f.endsWith('.html')) {
      const original = readFileSync(from, 'utf8');
      writeFileSync(to, injectWaNumber(original, numero));
      const trocas = original.split(DEFAULT_WA).length - 1;
      console.log(`  ${from} -> ${to}${trocas ? ` (${trocas}× número → ${numero})` : ''}`);
    } else {
      copyFileSync(from, to);
      console.log(`  ${from} -> ${to}`);
    }
    copied++;
  }
  let midia = 0;
  for (const d of DIRS) {
    const from = join(SRC, d);
    if (!existsSync(from)) continue;
    midia += copyDir(from, join(OUT, d));
  }
  console.log(`build-web: copied ${copied}/${ASSETS.length} assets + ${midia} media files to ${OUT}/`);
}

/** Cópia recursiva simples; devolve quantos arquivos copiou. */
function copyDir(from, to) {
  mkdirSync(to, { recursive: true });
  let n = 0;
  for (const name of readdirSync(from)) {
    const src = join(from, name);
    const dst = join(to, name);
    if (statSync(src).isDirectory()) n += copyDir(src, dst);
    else { copyFileSync(src, dst); n++; }
  }
  return n;
}

// Só constrói quando EXECUTADO. Importar (o teste importa injectWaNumber) não
// pode escrever em public/ — efeito colateral no import é como um teste passa a
// mexer no repositório.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) build();
