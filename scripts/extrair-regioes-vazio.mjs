/**
 * Extrai as regiões do vazio sanitário da Portaria SDA/MAPA 1.579/2026.
 *
 * A portaria subdivide 7 UFs por região, e cada região é definida por uma LISTA
 * DE MUNICÍPIOS numa nota de rodapé. Sem esse mapa, o alerta proativo só sabe
 * dizer o envelope ("varia por região, confirme"). Com ele, sabe a data exata.
 *
 * Roda uma vez por safra, contra o texto do DOU já commitado em knowledge/.
 * A saída é commitada: o runtime lê JSON, nunca faz parsing de OCR.
 *
 *   node scripts/extrair-regioes-vazio.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FONTE = 'knowledge/portaria-sda-mapa-1579-2026.txt';
const SAIDA = 'knowledge/vazio-regioes-2026.json';

/** UF → região → { nota, start, end }. Datas lidas da tabela da portaria. */
const REGIOES = {
  BA: {
    'I':   { nota: 1, start: '2026-06-26', end: '2026-10-07' },
    'II':  { nota: 2, start: '2026-06-14', end: '2026-09-14' },
    'III': { nota: 3, start: '2026-12-14', end: '2027-03-14' },
    'IV':  { nota: 4, start: '2026-08-01', end: '2026-10-31' },
  },
  MA: {
    'I':   { nota: 5, start: '2026-07-03', end: '2026-09-30' },
    'II':  { nota: 6, start: '2026-08-03', end: '2026-10-31' },
    'III': { nota: 7, start: '2026-09-02', end: '2026-11-30' },
  },
  PA: {
    'I':   { nota: 8,  start: '2026-06-15', end: '2026-09-15' },
    'II':  { nota: 9,  start: '2026-08-01', end: '2026-10-31' },
    'III': { nota: 10, start: '2026-08-15', end: '2026-11-15' },
  },
  PR: {
    'I':   { nota: 11, start: '2026-06-21', end: '2026-09-19' },
    'II':  { nota: 12, start: '2026-06-02', end: '2026-08-31' },
    'III': { nota: 13, start: '2026-06-12', end: '2026-09-10' },
  },
  PI: {
    'I':   { nota: 14, start: '2026-09-01', end: '2026-11-30' },
    'II':  { nota: 15, start: '2026-08-01', end: '2026-10-31' },
    'III': { nota: 16, start: '2026-07-01', end: '2026-09-29' },
  },
  SC: {
    'I':  { nota: 17, start: '2026-07-04', end: '2026-10-12' },
    'II': { nota: 18, start: '2026-06-13', end: '2026-09-21' },
  },
  SP: {
    'I':   { nota: 19, start: '2026-06-01', end: '2026-08-31' },
    'II':  { nota: 20, start: '2026-06-12', end: '2026-09-12' },
    'III': { nota: 21, start: '2026-06-15', end: '2026-09-15' },
  },
};

/**
 * Perdas de OCR conhecidas, corrigidas contra o texto do DOU lido à mão.
 * Cada entrada é uma quebra de coluna do PDF que comeu caractere. Manter
 * pequeno e auditável: se crescer, o problema é a extração do PDF, não isto.
 */
const CORRECOES_OCR = [
  // BA, nota 1: "Iramaia, Iraquara,\ntaetê" — o "I" de Itaetê morreu na coluna.
  [/(^|\n)taetê,/g, '$1Itaetê,'],
];

let bruto = readFileSync(FONTE, 'utf8');
for (const [de, para] of CORRECOES_OCR) bruto = bruto.replace(de, para);

/** Tira o ruído de paginação do DOU, que corta listas ao meio. */
const limpo = bruto
  .split('\n')
  .filter((l) => !/^\d{2}\/\d{2}\/\d{4},|^https:\/\/www\.in\.gov\.br|^-- \d+ of \d+ --$|^\s*\d+\/\d+\s*$/.test(l))
  .join('\n');

/**
 * Corpo da nota `n`: começa em `^n` seguido de maiúscula e vai até a próxima
 * nota ou o fim. As notas são numeradas 1..21 em ordem no documento.
 */
function corpoDaNota(n) {
  const re = new RegExp(`(^|\\n)${n}([A-ZÁÂÃÉÊÍÓÔÕÚÇ][\\s\\S]*?)(?=\\n${n + 1}[A-ZÁÂÃÉÊÍÓÔÕÚÇ]|$)`);
  const m = limpo.match(re);
  return m ? m[2] : null;
}

/** Normaliza para casamento: sem acento, minúsculo, espaço colapsado. */
export function normalizarMunicipio(s) {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, "'")
    .replace(/\s*'\s*/g, "'")
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function municipiosDaNota(n) {
  const corpo = corpoDaNota(n);
  if (!corpo) throw new Error(`nota ${n} não encontrada`);
  return corpo
    .replace(/\n/g, ' ')
    .replace(/\.\s*$/, '')
    // "além dos distritos de X e Y, pertencentes ao município de Z" → fica o Z
    .replace(/,?\s*além dos distritos de .*?pertencentes ao munic[ií]pio de\s+/i, ', ')
    .split(/,| e (?=[A-ZÁÂÃÉÊÍÓÔÕÚÇ])/)
    .map((s) => s.trim().replace(/\.$/, ''))
    .filter((s) => s.length > 2 && /[a-zA-ZÁ-ú]/.test(s));
}

/** Igual a municipiosDaNota, mas com guarda contra fragmento de OCR. */
function municiposDaNotaSeguro(n) {
  const lista = municipiosDaNota(n);
  // Fragmento de OCR começa em minúscula (a coluna comeu a inicial). Nome
  // curto e capitalizado é município real: Itú, Poá, Jaú, Uru.
  const suspeitos = lista.filter((m) => !/^[A-ZÁÂÃÉÊÍÓÔÕÚÇ]/.test(m));
  if (suspeitos.length) console.warn(`  ⚠ nota ${n}: fragmentos suspeitos → ${suspeitos.join(' | ')}`);
  return lista;
}

const saida = { fonte: 'Portaria SDA/MAPA nº 1.579/2026', safra: '2026/27', ufs: {} };
let total = 0;
for (const [uf, regioes] of Object.entries(REGIOES)) {
  saida.ufs[uf] = {};
  for (const [regiao, meta] of Object.entries(regioes)) {
    const corpo = corpoDaNota(meta.nota);
    // A portaria pode definir uma região como "o resto do estado" (SC II).
    // Isso é semântica, não lista: quem não casa com nenhuma lista cai aqui.
    const coringa = /^\s*Demais munic[ií]pios do estado/i.test(corpo ?? '');
    const municipios = coringa ? [] : municiposDaNotaSeguro(meta.nota);
    saida.ufs[uf][regiao] = {
      start: meta.start,
      end: meta.end,
      resto_do_estado: coringa,
      municipios: municipios.map(normalizarMunicipio).sort(),
    };
    total += municipios.length;
    console.log(
      `${uf} região ${regiao} (nota ${meta.nota}): ` +
        (coringa ? 'RESTO DO ESTADO' : `${municipios.length} municípios`)
    );
  }
}
// Validação: nenhum município pode estar em duas regiões da MESMA UF.
for (const [uf, regioes] of Object.entries(saida.ufs)) {
  const visto = new Map();
  for (const [r, v] of Object.entries(regioes)) {
    for (const m of v.municipios) {
      if (visto.has(m)) console.warn(`  ⚠ ${uf}: "${m}" em ${visto.get(m)} E ${r}`);
      visto.set(m, r);
    }
  }
}

writeFileSync(SAIDA, JSON.stringify(saida, null, 2) + '\n');
console.log(`\n${total} municípios em ${Object.keys(saida.ufs).length} UFs → ${SAIDA}`);
