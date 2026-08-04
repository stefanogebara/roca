/**
 * Configuração do agente Vitória-voz no ElevenLabs. Pura — o provisionador
 * (scripts/el-setup.ts) aplica via API; os testes fixam as regras da casa.
 *
 * Quadrante de uso (plano 2026-08-04-agente-voz): LIGAÇÃO ESPERADA — quem
 * atende já conversou com a Vitória no WhatsApp e concordou com a chamada.
 * Não é cold call: Luo et al. 2019 mediu -80% pra robô revelado em chamada
 * fria, e revelar é inegociável aqui. Em chamada combinada, o disclosure não
 * é surpresa — é continuidade.
 */

/** Nome estável do agente na conta EL — chave da idempotência do setup. */
export const AGENT_NAME_EL = 'Vitoria Voz (Stevi)';

export interface ParamsAgente {
  voiceId: string;
  toolsUrl: string;
  toolsSecret: string;
}

const PROMPT_VITORIA_VOZ = `Você é a Vitória, assistente digital da Stevi — uma assistente de IA agronômica gratuita para cafeicultores do Sul de Minas. Esta é uma ligação que foi combinada antes: a pessoa do outro lado já conversou com você pelo WhatsApp e concordou em receber esta chamada. Você NUNCA liga fria.

QUEM VOCÊ É AO TELEFONE
- Apresente-se como assistente digital da Stevi logo no início, com naturalidade — a pessoa já sabe quem você é do WhatsApp.
- Fale como gente do interior de Minas fala: frases curtas, calorosa sem bajular, zero jargão corporativo.
- Uma pergunta por vez. Espere a resposta. Não atropele.

SUA MISSÃO NA LIGAÇÃO
- Retomar de onde a conversa do WhatsApp parou (use a ferramenta contexto_prospect ANTES de aprofundar).
- Avançar a parceria: entender como chegam clientes novos hoje, se aceitariam receber produtores já triados, e qual formato preferem.
- Se houver interesse concreto: combinar o próximo passo com o Stefano (fundador) — dia e hora que funcionam para a pessoa.
- Ao final, SEMPRE registrar o que ficou combinado com a ferramenta registrar_resultado.

REGRAS DURAS — NUNCA QUEBRE
- NUNCA cite preço, valor, comissão ou condição comercial. Se perguntarem: "essa parte é com o Stefano — posso pedir pra ele te falar direto".
- NUNCA prometa prazo de resposta de terceiros ("já já ele liga" é proibido). Destino sim, prazo não.
- NUNCA invente cliente, número, funcionalidade ou caso que não existe.
- Se a pessoa pedir para não ser contatada, agradeça, confirme que não haverá novo contato e encerre com dignidade.
- Se a pessoa não puder falar agora, ofereça recombinar pelo WhatsApp e encerre rápido — o tempo dela vale mais que o seu roteiro.
- Ligação caindo em caixa postal ou atendente sem contexto: não deixe recado longo; diga que a Vitória da Stevi retorna pelo WhatsApp e encerre.`;

const FIRST_MESSAGE =
  'Oi! Aqui é a Vitória, da Stevi — a gente combinou essa ligação pelo WhatsApp. Tudo bem falar agora?';

/** Config completa do agente, no shape da API de criação da EL. */
export function montarConfigAgente(p: ParamsAgente) {
  return {
    name: AGENT_NAME_EL,
    conversation_config: {
      agent: {
        language: 'pt',
        first_message: FIRST_MESSAGE,
        prompt: {
          prompt: PROMPT_VITORIA_VOZ,
          tools: [
            {
              type: 'webhook',
              name: 'contexto_prospect',
              description:
                'Busca quem é o prospect e as últimas mensagens da conversa de WhatsApp. Use no INÍCIO da ligação, antes de aprofundar qualquer assunto.',
              api_schema: {
                url: p.toolsUrl,
                method: 'POST',
                request_headers: { 'x-el-tools-secret': p.toolsSecret },
                request_body_schema: {
                  type: 'object',
                  properties: {
                    action: { type: 'string', description: "Sempre 'contexto'", enum: ['contexto'] },
                    phone: { type: 'string', description: 'Telefone E.164 da pessoa na ligação' },
                  },
                  required: ['action', 'phone'],
                },
              },
            },
            {
              type: 'webhook',
              name: 'registrar_resultado',
              description:
                'Registra o que ficou combinado na ligação (próximo passo, dia/hora, recusa, pedido de remoção). Use SEMPRE antes de encerrar.',
              api_schema: {
                url: p.toolsUrl,
                method: 'POST',
                request_headers: { 'x-el-tools-secret': p.toolsSecret },
                request_body_schema: {
                  type: 'object',
                  properties: {
                    action: { type: 'string', description: "Sempre 'registrar'", enum: ['registrar'] },
                    phone: { type: 'string', description: 'Telefone E.164 da pessoa na ligação' },
                    nota: { type: 'string', description: 'Resumo objetivo do que ficou combinado, 1-3 frases' },
                  },
                  required: ['action', 'phone', 'nota'],
                },
              },
            },
          ],
        },
      },
      tts: {
        // Flash: o modelo de menor latência — a escolha certa pra conversa
        // (estudo 2026-08-04-agente-voz). A voz vem de fora porque escolher
        // voz pt-BR é decisão de ouvido, não de código.
        model_id: 'eleven_flash_v2_5',
        voice_id: p.voiceId,
      },
    },
  };
}
