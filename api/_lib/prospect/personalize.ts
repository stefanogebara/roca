/**
 * First-touch personalization — the "as human as possible" layer for template
 * disparos. Meta requires business-initiated messages to be approved templates;
 * humanity lives in the variables: a natural short name (no "LTDA"), a
 * kind-specific hook clause, and the city. Param count is env-driven so the
 * code works with the currently-approved template (1 param) and upgrades to
 * the personalized v2 the moment it's approved — no deploy needed.
 *
 * v2 template to submit in WhatsApp Manager (category MARKETING, pt_BR),
 * name suggestion `stevi_parceria_v2`:
 *
 *   Oi! Aqui é a Vitória, da Stevi 🌱 Falo com a {{1}}? Vi que vocês {{2}}
 *   na região de {{3}}. A Stevi é uma assistente gratuita de WhatsApp que faz
 *   triagem agronômica pra produtores de café — e quando o produtor precisa
 *   de receituário, a gente indica um agrônomo parceiro da região. Faz
 *   sentido trocar uma ideia rápida sobre parceria?
 *   (footer) Pra não receber mais mensagens, responda SAIR.
 */

import type { ProspectRow } from './db';

/** Name of the reply-first distribution template. Kept as a local literal (not
 * imported from template.ts) so this module stays free of that import cycle;
 * the registry there is the single source of the BODY text. */
const COOP_V2 = 'stevi_parceria_coop_v2';

/** Natural short name: strips corporate suffixes and parentheticals. */
export function shortName(name: string): string {
  return (
    name
      .replace(/\(.*?\)/g, ' ')
      .replace(/\b(ltda\.?|s\/?a\.?|eireli|me|epp|comercial|com[ée]rcio e representa[çc][õo]es?)\b/gi, ' ')
      .replace(/[—–-]\s*$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
      // Branch/unit suffixes come dash-separated ("Cooxupé - Matriz Guaxupé");
      // a bare hyphen only counts when space-padded, so hyphenated names survive.
      .split(/\s*[—–]\s*|\s+-\s+/)[0]
      .trim() || name.trim()
  ).slice(0, 40);
}

/** Kind-specific hook clause for {{2}} — what "vocês fazem" in their world. */
export function kindHook(kind: string | null): string {
  switch ((kind ?? '').toLowerCase()) {
    case 'consultoria':
    case 'agronomo':
      return 'trabalham com consultoria agronômica';
    case 'revenda':
      return 'atendem produtores no dia a dia';
    case 'cooperativa':
    case 'coop':
      return 'dão assistência aos cooperados';
    case 'fazenda':
      return 'produzem café';
    default:
      return 'trabalham com o produtor rural';
  }
}

/**
 * Ordered body params for the configured template. paramCount 1 = the current
 * approved template ({{1}}=name); 3 = the personalized v2 (name, hook, city).
 */
export function buildTemplateParams(
  p: Pick<ProspectRow, 'name' | 'kind' | 'city'>,
  paramCount: number
): string[] {
  const name = shortName(p.name);
  const city = (p.city ?? 'Sul de Minas').slice(0, 40);
  // v2 (3): nome + gancho do kind + cidade. v3 (2): nome + cidade — a copy
  // reply-first cortou o gancho e faz UMA pergunta sobre a região. Sem este
  // ramo, arity 2 caía no de 1 e o shape guard abortava o dispatch (a proteção
  // que nasceu do outage #132000 faria seu trabalho, mas nada sairia).
  if (paramCount >= 3) return [name, kindHook(p.kind), city];
  if (paramCount === 2) return [name, city];
  return [name.slice(0, 60)];
}

/** {{2}} of the distribution (coop/revenda) template — "Pra {{2}}, ela funciona
 * como um filtro…". Pure. */
export function kindPhrase(kind: string | null): string {
  switch ((kind ?? '').toLowerCase()) {
    case 'cooperativa':
    case 'coop':
      return 'a cooperativa';
    case 'revenda':
      return 'a revenda';
    default:
      return 'o time de vocês';
  }
}

/** Params for the distribution template (coops/revendas): {{1}}=name, {{2}}=kind phrase. */
export function buildCoopParams(
  p: Pick<ProspectRow, 'name' | 'kind'>,
  templateName?: string
): string[] {
  const name = shortName(p.name);
  // coop_v2 ("…pro time da {{2}}") takes the ORGANIZATION's name in slot 2;
  // sending kindPhrase there would render "pro time da a cooperativa".
  if (templateName === COOP_V2) return [name, name];
  return [name, kindPhrase(p.kind)];
}

/** Painel-thread rendering of the distribution template — sync with template.ts. */
export function renderCoopText(params: string[], templateName?: string): string {
  if (templateName === COOP_V2) {
    return (
      `Oi, ${params[0]}! Sou a Vitória, assistente digital da Stevi 🌱 A gente atende cafeicultores no ` +
      `WhatsApp e devolve o caso técnico organizado pro time da ${params[1]} — não substitui ninguém. ` +
      `Posso te mandar um exemplo real de caso pra você avaliar?`
    );
  }
  return (
    `Oi! Aqui é a Vitória, da Stevi 🌱 Falo com a ${params[0]}? A Stevi é uma assistente gratuita de WhatsApp ` +
    `que faz triagem agronômica pra cafeicultores — foto de praga, janela de pulverização, alerta de geada. ` +
    `Pra ${params[1]}, ela funciona como um filtro: atende o produtor na hora e encaminha os casos técnicos ` +
    `pros SEUS agrônomos e técnicos — não substitui ninguém, devolve o produtor pra vocês com o caso já ` +
    `organizado. Faz sentido uma conversa rápida?`
  );
}

/** Params for the D+3 bump template: {{1}}=name, {{2}}=city. */
export function buildBumpParams(p: Pick<ProspectRow, 'name' | 'city'>): string[] {
  return [shortName(p.name), (p.city ?? 'Sul de Minas').slice(0, 40)];
}

/** Painel-thread rendering of the bump — keep in sync with template.ts. */
export function renderBumpText(params: string[]): string {
  return (
    `Oi, ${params[0]}! Vitória da Stevi aqui de novo 🌱 Sei que a rotina é corrida, então só um lembrete rápido: ` +
    `a gente indica produtores da região de ${params[1]} que precisam de receituário agronômico — de graça nessa ` +
    `fase de validação. Se fizer sentido, me dá um alô por aqui. Se não for o momento, tudo bem também!`
  );
}

/**
 * Human-readable rendering of the template that actually went out, for the
 * painel thread view (Meta doesn't echo template bodies back). Mirrors the
 * approved template texts — keep in sync when a new template version ships.
 */
export function renderTemplateText(params: string[]): string {
  // v3 (2 params): reply-first — declares the AI and asks one question.
  if (params.length === 2) {
    return (
      `Oi, ${params[0]}! Sou a Vitória, assistente digital da equipe da Stevi 🌱 Pergunta rápida: quando um ` +
      `cafeicultor da região de ${params[1]} precisa de receituário e não tem agrônomo por perto, ele chega ` +
      `até vocês como? Pergunto porque a gente recebe esses pedidos no WhatsApp e queria saber se faz ` +
      `sentido indicar vocês.`
    );
  }
  if (params.length >= 3) {
    return (
      `Oi! Aqui é a Vitória, da Stevi 🌱 Falo com a ${params[0]}? Vi que vocês ${params[1]} na região de ${params[2]}. ` +
      `A Stevi é uma assistente gratuita de WhatsApp que faz triagem agronômica pra produtores de café — ` +
      `e quando o produtor precisa de receituário, a gente indica um agrônomo parceiro da região. ` +
      `Faz sentido trocar uma ideia rápida sobre parceria?`
    );
  }
  return `Oi, ${params[0]}! Aqui é a Vitória, da Stevi 🌱 (template de parceria v1)`;
}
