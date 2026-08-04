/**
 * Filtro de ICP — descarta pet shop, casa de ração e clínica veterinária antes
 * que entrem na fila de disparo.
 *
 * Nasceu de um "não" bem específico. Em 29/jul o Felipe Augusto, da Agro.com de
 * Boa Esperança, respondeu ao template de café:
 *
 *     "nós trabalhamos somente com produtos pecuários"
 *     "agrícola não trabalhamos"
 *
 * Não era objeção de posicionamento — era erro de mira. O termo de busca
 * `agropecuária produtos agrícolas` traz, no Brasil, exatamente o que
 * "agropecuária" significa na fachada: ração, pet e veterinário. O Places
 * devolve pet shop e o pet shop entra como revenda agrícola.
 *
 * O custo de errar a mira não é só a mensagem perdida: queima reputação do
 * número, consome cap diário e arrisca denúncia de quem recebeu oferta
 * irrelevante — e denúncia derruba o número do negócio inteiro.
 *
 * REGRA DE DESEMPATE: quem vende insumo agrícola E ração continua DENTRO. O que
 * desqualifica não é ter linha pet — é NÃO ter linha agrícola. Uma agropecuária
 * de cidade pequena costuma vender os dois, e ela é cliente.
 */

/** Sinais de que o negócio é pet/ração/veterinária. */
const SINAIS_PECUARIA: Array<{ re: RegExp; rotulo: string }> = [
  { re: /\bpet\s*shop\b|\bpetshop\b/i, rotulo: 'pet shop' },
  { re: /\bpet\b/i, rotulo: 'pet' },
  { re: /\bra[çc][õo]es\b/i, rotulo: 'rações' },
  { re: /\bc[ãa]es\b|\bgatos\b|\bcalopsita|\bpassarinho/i, rotulo: 'animais de estimação' },
  { re: /\bbanho\s+e\s+tosa\b/i, rotulo: 'banho e tosa' },
  // Trocadilho canino no nome — "Cãopeão", "Cãopanheiro", "Mundo Cão". Achado
  // em 04/ago: o Cãopeão Agropecuária recebeu bump E leu. Eu presumi que fosse
  // falha da varredura por estágio; a medição mostrou outra coisa — o filtro
  // simplesmente não via o nome. Quem pegou foi olho humano, que não escala e
  // falha em silêncio. O `ã` obrigatório evita casar "cana", "canoa", "canavial",
  // que são palavras de agro de verdade.
  { re: /\bc[ãa]o\b|\bcão[a-zà-ÿ]*/i, rotulo: 'trocadilho com cão (pet)' },
  { re: /\bcl[íi]nica\s+veterin[áa]ria\b|\bmedicina\s+pet\b/i, rotulo: 'clínica veterinária' },
  { re: /\bsomente\s+produtos?\s+pecu[áa]ri/i, rotulo: 'declara só pecuária' },
  { re: /\bapenas\s+pecu[áa]ri/i, rotulo: 'declara só pecuária' },
  // 31/jul, primeira varredura com rotação: o Places devolveu "Jocape" para
  // "revenda agrícola em Boa Esperança" — e o site é jocapeautopecas.com.br,
  // loja de autopeças. Mesma família do caso pecuária: o nome não denuncia, a
  // FONTE sim. Sem \b entre "autope" e "cas" porque o sinal aparece grudado em
  // domínio (jocapeautopecas).
  { re: /auto\s*pe[çc]as|autope[çc]as/i, rotulo: 'autopeças' },
];

/**
 * Sinais de linha AGRÍCOLA de verdade. Presente qualquer um deles, o negócio
 * atende lavoura e fica na base mesmo que também venda ração.
 */
const SINAIS_AGRICOLA =
  /\bdefensivo|\bagrot[óo]xico|\bsemente|\bfertilizante|\badubo|\bcalc[áa]rio|\bherbicida|\bfungicida|\binseticida|\breceitu[áa]rio|\binsumos?\s+agr[íi]col|\bagr[íi]cola\b|\bcafeicultor|\blavoura|\bagron[oô]m/i;

/**
 * Qual sinal de pecuária disparou, ou null quando o prospect está no ICP.
 * Exportado separado de foraDoICP para o descarte ficar auditável — um filtro
 * que rejeita sem dizer por quê é impossível de corrigir depois.
 */
export function motivoForaDoICP(nome: string, contexto?: string | null): string | null {
  const texto = `${nome ?? ''} ${contexto ?? ''}`.trim();
  if (!texto) return null;
  // Linha agrícola presente vence qualquer sinal de pet: ela é o que nos
  // interessa, e vender ração junto é a norma no interior.
  if (SINAIS_AGRICOLA.test(texto)) return null;
  const hit = SINAIS_PECUARIA.find((s) => s.re.test(texto));
  return hit ? hit.rotulo : null;
}

/** Se este prospect deve ser descartado antes de entrar na fila. */
export function foraDoICP(nome: string, contexto?: string | null): boolean {
  return motivoForaDoICP(nome, contexto) !== null;
}

/** O mínimo que a varredura precisa ver de uma linha. */
export interface LinhaVarredura {
  id: string;
  name: string;
  source?: string | null;
  status: string;
}

/**
 * Estágios em que descartar é seguro: ninguém conversou com a gente ainda.
 * `replied` e `partner` ficam de fora de propósito — ver alvosDaVarreduraICP.
 */
const ESTAGIOS_SEGUROS = new Set(['discovered', 'ready', 'contacted', 'stale']);

export interface AlvosVarredura<T> {
  /** Fora do ICP e sem conversa iniciada — pode descartar automaticamente. */
  descartar: T[];
  /** Fora do ICP MAS já respondeu — decisão do founder, nunca do regex. */
  revisar: T[];
}

/**
 * Quem a limpeza retroativa deve tocar quando um sinal novo de ICP nasce.
 *
 * O caso que criou isto (04/ago): um pet shop recebeu bump DEPOIS de o filtro
 * de pet existir, porque a limpeza varria só `discovered` — quem já estava em
 * `contacted` seguia na esteira de follow-up, consumindo cap e reputação.
 * Segunda vez com o mesmo negócio.
 *
 * A linha entre descartar e revisar é ter havido CONVERSA. Um regex pode dizer
 * "isto parece pet shop"; ele não pode apagar um relacionamento que já existe.
 * Quem respondeu vai pra revisão humana; parceiro não se toca de jeito nenhum.
 */
export function alvosDaVarreduraICP<T extends LinhaVarredura>(rows: T[]): AlvosVarredura<T> {
  const descartar: T[] = [];
  const revisar: T[] = [];
  for (const r of rows) {
    if (!foraDoICP(r.name, r.source ?? null)) continue;
    if (ESTAGIOS_SEGUROS.has(r.status)) descartar.push(r);
    else if (r.status === 'replied') revisar.push(r);
    // 'partner' e 'discarded' não entram em nenhuma lista.
  }
  return { descartar, revisar };
}
