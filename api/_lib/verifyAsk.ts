/**
 * "Isso é golpe?" — detector da pergunta de identidade.
 *
 * O momento de maior desconfiança é o produtor perguntando se a Stevi é robô,
 * golpe, gente, de verdade — ou quem está do outro lado. A resposta em texto é
 * honesta (regra da casa: nunca se passa por pessoa), mas texto não viaja; o
 * card "quem responde" (type=verify) viaja, e é o que a pipeline anexa quando
 * esta função diz sim. Puro, sem LLM: a pergunta é curta e formulaica, e um
 * falso negativo custa só o card (a resposta em texto sai igual).
 *
 * Conservador de propósito: "esse produto é confiável?" NÃO deve disparar —
 * por isso "confiável/seguro/real" só contam apontados para a Stevi ("isso",
 * "você", "esse número"), nunca soltos.
 *
 * Fronteiras de palavra: `\b` do JS não conhece acento ("robô?" não tem
 * fronteira depois do ô), então as bordas são lookarounds por \p{L}.
 */

const B0 = '(?<!\\p{L})'; // início de palavra (unicode)
const B1 = '(?!\\p{L})'; // fim de palavra (unicode)
const w = (alt: string) => new RegExp(`${B0}(?:${alt})${B1}`, 'iu');

const PADROES: RegExp[] = [
  // robô / IA / gente
  w('rob[ôo]s?|bot|chatbot|gravação|gravacao|m[aá]quina'),
  w('(?:[ée]|eh|é uma|e uma|s[oó]|so|uma)\\s+(?:ia|intelig[êe]ncia artificial)'),
  w('(?:é|eh|voc[êe] é|vc é|vc eh|tem)\\s+(?:gente|pessoa|humano|humana|alguém|alguem)'),
  // golpe
  w('golpe|spam|fraude|enganação|enganacao|pegadinha'),
  // de verdade / confiável — só apontado para a Stevi
  new RegExp(
    `${B0}(?:isso|isso a[ií]|voc[êe]|vc|vcs|voces|vocês|a stevi|essa stevi|esse n[uú]mero|esse contato)${B1}[^.?!]{0,30}${B0}(?:de verdade|confi[aá]vel|seguro|real|existe|s[eé]rio|serio)${B1}`,
    'iu'
  ),
  new RegExp(`${B0}(?:de verdade|confi[aá]vel|s[eé]rio)${B1}[^.?!]{0,20}${B0}(?:isso|voc[êe]|vc|stevi)${B1}`, 'iu'),
  // quem está do outro lado
  w('quem\\s+(?:é|eh|t[aá]|est[aá])\\s+(?:voc[êe]|vc|falando|a[ií]|do outro lado|respondendo|por tr[aá]s)'),
  w('quem\\s+(?:responde|manda|t[aá] mandando|est[aá] mandando|fala comigo)'),
  w('(?:quem|o que|oq|q)\\s+(?:é|eh)\\s+(?:a\\s+)?stevi'),
  w('posso confiar'),
];

/** Se a mensagem pergunta pela identidade/legitimidade da Stevi. */
export function isIdentityQuestion(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.trim();
  if (t.length > 240) return false; // parágrafo longo não é a pergunta curta de checagem
  return PADROES.some((re) => re.test(t));
}
