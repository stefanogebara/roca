/**
 * Município → região do vazio sanitário → data exata.
 *
 * A Portaria SDA/MAPA 1.579/2026 subdivide 7 UFs por região, e cada região é
 * definida por uma LISTA DE MUNICÍPIOS em nota de rodapé. Sem esse mapa, o
 * alerta proativo só sabe dizer o envelope ("varia por região, confirme"). Com
 * ele, sabe a data do produtor.
 *
 * O JSON é gerado por `scripts/extrair-regioes-vazio.mjs` contra o texto do DOU
 * commitado em `knowledge/`, e commitado junto. O runtime NUNCA faz parsing de
 * OCR — lê dado já validado.
 *
 * Regra de ouro: município que não resolve devolve `null`, e quem chama volta
 * ao hedge. Falhar em silêncio para o hedge é seguro; falhar para uma data
 * errada não é.
 */
import regioes from '../../../knowledge/vazio-regioes-2026.json';

interface RegiaoVazio {
  start: string;
  end: string;
  resto_do_estado: boolean;
  municipios: string[];
}
type Tabela = { fonte: string; safra: string; ufs: Record<string, Record<string, RegiaoVazio>> };

const TABELA = regioes as Tabela;

/** Mesma normalização do extrator: sem acento, minúsculo, espaço colapsado. */
export function normalizarMunicipio(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, "'")
    .replace(/\s*'\s*/g, "'")
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface RegiaoResolvida {
  regiao: string;
  start: string;
  end: string;
  /** True quando caiu na região "demais municípios do estado". */
  porExclusao: boolean;
}

/** True quando a portaria subdivide esta UF por região. */
export function ufTemRegioes(uf: string | null | undefined): boolean {
  return !!uf && uf.toUpperCase() in TABELA.ufs;
}

/**
 * Região do município dentro da UF, com a janela exata daquela região.
 * `null` quando a UF não é subdividida, quando o município é desconhecido, ou
 * quando falta o município — os três casos em que o chamador deve hedgear.
 */
export function resolverRegiao(
  uf: string | null | undefined,
  municipio: string | null | undefined
): RegiaoResolvida | null {
  if (!uf || !municipio) return null;
  const regioesDaUf = TABELA.ufs[uf.toUpperCase()];
  if (!regioesDaUf) return null;

  const alvo = normalizarMunicipio(municipio);
  if (!alvo) return null;

  let coringa: [string, RegiaoVazio] | null = null;
  for (const [regiao, r] of Object.entries(regioesDaUf)) {
    if (r.resto_do_estado) {
      coringa = [regiao, r];
      continue;
    }
    if (r.municipios.includes(alvo)) {
      return { regiao, start: r.start, end: r.end, porExclusao: false };
    }
  }
  // "Demais municípios do estado" só vale depois de nenhuma lista casar — e só
  // se a UF de fato tiver essa região (hoje, SC).
  if (coringa) {
    const [regiao, r] = coringa;
    return { regiao, start: r.start, end: r.end, porExclusao: true };
  }
  return null;
}

/** Safra que a tabela descreve, para conferência cruzada com o calendário. */
export const SAFRA_TABELA_REGIOES = TABELA.safra;

/** Janelas por região de uma UF subdividida. `{}` quando a UF não é. */
export function janelasPorRegiao(uf: string): Record<string, { start: string; end: string }> {
  const r = TABELA.ufs[uf.toUpperCase()];
  if (!r) return {};
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { start: v.start, end: v.end }]));
}
