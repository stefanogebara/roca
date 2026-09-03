/**
 * Onboarding: os primeiros cinco minutos de quem chega pelo QR da feira ou
 * por indicação. O que se mediu nas conversas reais (03/set): quem chegou ao
 * pin recebeu o cartão da lavoura em 5 mensagens; quem não chegou parou na
 * saudação. O pin é o momento de retorno (solo, janela, alerta) — e o caminho
 * até ele era um parágrafo explicando "clipe 📎 → Localização" mais um botão
 * "Ver satélite" que respondia... pedindo o pin de novo.
 *
 * Dois mecanismos, ambos puros:
 *  - `asksForPin(text)`: toda resposta nossa que pede a localização carrega a
 *    marca literal "clipe 📎 → Localização" (handleSpray, handleFieldHealth,
 *    a saudação, o prompt do modelo). Quando ela aparece, a pipeline manda a
 *    mensagem com o botão NATIVO de localização do WhatsApp em vez de botões
 *    de texto — um toque abre o mapa.
 *  - `CROP_BUTTONS`: depois do pin, a pergunta "o que você planta?" vira três
 *    toques (café primeiro: é o beachhead). Cada título é uma resposta que o
 *    `parseCrops` já entende, então o toque cai na rota cropsOnly sem código
 *    novo.
 */

/** A frase que toda resposta que pede o pin carrega — é o gatilho do botão nativo. */
export const PIN_ASK_MARK = 'clipe 📎 → Localização';

/** Se a resposta pede a localização (e portanto merece o botão nativo). */
export function asksForPin(text: string | null | undefined): boolean {
  return !!text && text.includes(PIN_ASK_MARK);
}

/** Botões da pergunta de cultura, pós-pin. Títulos são respostas que parseCrops lê. */
export const CROP_BUTTONS: readonly string[] = ['Café', 'Soja', 'Milho'];
