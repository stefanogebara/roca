/**
 * Guard de eco no lado do produtor: reconhecer um robô que espelha a Stevi.
 *
 * Em 03/ago um atendimento automático trocou despedida com a Stevi por 25+
 * turnos, ~13s cada. 880 das 926 mensagens `out` do dia foram `smalltalk`. Cada
 * turno custou uma invocação e uma chamada de LLM, e inflou caderno, digest e
 * WAU — as métricas de tração daquele dia contam esse ruído.
 *
 * Módulo folha de propósito: sem import de db, llm ou transporte. O guard roda
 * ANTES da chamada de LLM (é ela que custa), e o pipeline já ensina que o que
 * precisa rodar cedo não pode arrastar o grafo do app junto.
 */

/** Caixa e espaço só. Pontuação e emoji ficam: são parte da assinatura do
 * espelho — o robô copia o "🌱" também. */
const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Quantos turnos nossos olhar para trás. A janela do `getRecentTurns` é 6, o
 * que cobre ~3 idas e voltas — fundo suficiente para o espelho aparecer sem
 * guardar frase nossa de uma conversa de ontem. */
const JANELA = 6;

/**
 * Se a mensagem recebida é cópia literal de algo que a STEVI mandou nos últimos
 * turnos. Uma pessoa não cola de volta a frase exata do bot, emoji incluso; um
 * robô-espelho é feito disso.
 *
 * Três decisões que parecem folga e são o contrário:
 *
 * 1. SEM PISO DE TAMANHO, ao contrário do `ecoDeMaquina` da Vitória. Lá o piso
 *    (40 chars / 5 palavras) existe porque o sinal é a contraparte repetindo A
 *    SI MESMA, e gente repete "ok" o dia inteiro. Aqui o sinal é a contraparte
 *    repetindo A NÓS — e o caso real é "Até mais! 🌱", 3 palavras. Um piso
 *    mataria justamente o que este guard existe para pegar.
 *
 * 2. COMPARAÇÃO ESTRITA, e é ela que torna seguro não ter piso. Nada de
 *    prefixo, distância ou similaridade: igualdade exata depois de caixa e
 *    espaço. Um robô que parafraseia escapa — e escapar é o erro barato. O erro
 *    caro é calar um produtor.
 *
 * 3. SÓ OS TURNOS `stevi`. Produtor que repete a própria mensagem ("alguém
 *    aí?", "alguém aí?") está insistindo, não ecoando: é humano, é urgente, e é
 *    exatamente quem não pode levar silêncio.
 */
export function ecoDoNossoTexto(
  turns: Array<{ role: 'produtor' | 'stevi'; text: string }>,
  inboundText: string | null | undefined
): boolean {
  const alvo = norm(inboundText ?? '');
  if (!alvo) return false;
  return turns
    .slice(-JANELA)
    .some((t) => t.role === 'stevi' && norm(t.text ?? '') === alvo);
}
