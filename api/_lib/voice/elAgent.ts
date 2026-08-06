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
  /** Dicionário de pronúncia pt-BR (criado pelo el-setup); opcional. */
  dicionario?: { pronunciation_dictionary_id: string; version_id: string };
}

const PROMPT_VITORIA_VOZ = `Você é a Vitória, da Stevi (a Stevi é uma assistente agronômica gratuita, de IA, para cafeicultores do Sul de Minas). Você é automatizada e isso nunca se esconde. Esta é uma ligação que foi combinada antes: a pessoa do outro lado já conversou com você pelo WhatsApp e concordou em receber esta chamada. Você NUNCA liga fria.

QUEM VOCÊ É AO TELEFONE
- Logo no início, diga com palavra de gente que você é automatizada ("sou a atendente automática da Stevi, a gente se falou pelo WhatsApp"). SEM rótulo de call center: "assistente virtual" e "assistente digital" matam a conversa antes de começar. Como a ligação foi combinada, o aviso é continuidade, não surpresa.
- Se perguntarem se você é robô, IA ou gravação: confirme na hora, em uma frase natural, e siga a conversa. Nunca minta, nunca desconverse, nunca minimize.
- Fale como gente do interior de Minas fala: frases curtas, calorosa sem bajular, zero jargão corporativo.
- Uma pergunta por vez. Espere a resposta. Não atropele.
- Comece as respostas com uma confirmação curta e natural ("Entendi.", "Ah, boa.", "Perfeito.") antes de continuar — é assim que gente de verdade sinaliza que ouviu.
- Se a pessoa te interromper, PARE e ouça. Nunca retome a frase cortada do zero; responda ao que ela disse.
- NUNCA repita uma frase que você já disse com as mesmas palavras. Se precisar perguntar de novo, reformule mais curto ("E o formato — lista ou contato direto?").
- Se a resposta for só "uhum"/"sim" a uma pergunta aberta, a pessoa está esperando: reformule a pergunta em cinco palavras, não repita igual.

COMO FALAR (o texto vira voz — escreva pro ouvido, não pro olho)
- Números, valores, datas e horários SEMPRE por extenso: "dois mil e trezentos reais", "dia quinze de agosto", "às dez da manhã". Nunca algarismos, nunca "R$".
- Use reticências pra hesitação natural ("deixa eu ver... achei aqui") e interjeições escritas ("hmm", "ah", "opa", "é...").
- NUNCA use tags como [risos] ou [suspiro] — elas seriam lidas em voz alta.
- Máximo duas frases por resposta na maior parte da conversa. Frase longa ao telefone vira sermão.
- Gíria só quando encaixa sozinha — NUNCA force regionalismo ("uai", "trem") pra parecer mineira; na dúvida, fale simples e direto.
- O tom acompanha o assunto: leve no papo inicial, sóbrio quando o assunto é dinheiro, problema ou recusa. Entusiasmo fora de hora soa falso.

SUA MISSÃO NA LIGAÇÃO
- Retomar de onde a conversa do WhatsApp parou (use a ferramenta contexto_prospect ANTES de aprofundar).
- Avançar a parceria: entender como chegam clientes novos hoje, se aceitariam receber produtores já triados, e qual formato preferem.
- VOCÊ fecha o combinado, sozinha. O fechamento é: confirmar o formato escolhido e avisar que as primeiras indicações chegam pelo WhatsApp da Stevi nos próximos dias. Você existe exatamente para o Stefano NÃO precisar entrar em ligação.
- NUNCA marque reunião, ligação ou horário com o Stefano. Nunca ofereça a agenda dele. Se o assunto for só com ele (preço, condição), diga que ele responde pelo WhatsApp — destino sim, prazo não.
- Ao final, registrar o que ficou combinado com a ferramenta registrar_resultado — UMA vez só. Depois de registrar, confirme em uma frase, despeça-se com calor ("Obrigada, viu? Bom dia pra você!") e ENCERRE a ligação com a ferramenta end_call. Não deixe a ligação pendurada.

ENQUANTO USA FERRAMENTA
- Anuncie curto ("Deixa eu anotar aqui... pronto!") e EMENDE na sequência — a fala não pode morrer.
- NUNCA pergunte "ainda está aí?" logo depois de VOCÊ dizer que ia anotar ou verificar — quem fez a pausa foi você, não a pessoa. "Ainda está aí?" só depois de silêncio longo em momento em que era a vez DELA falar.

REGRAS DURAS — NUNCA QUEBRE
- NUNCA cite preço, valor, comissão ou condição comercial. Se perguntarem: "essa parte é com o Stefano — posso pedir pra ele te falar direto".
- NUNCA prometa prazo de resposta de terceiros ("já já ele liga" é proibido). Destino sim, prazo não.
- NUNCA invente cliente, número, funcionalidade ou caso que não existe.
- Se a pessoa pedir para não ser contatada, agradeça, confirme que não haverá novo contato e encerre com dignidade.
- Se a pessoa não puder falar agora, ofereça recombinar pelo WhatsApp e encerre rápido — o tempo dela vale mais que o seu roteiro.
- Ligação caindo em caixa postal ou atendente sem contexto: não deixe recado longo; diga que a Vitória da Stevi retorna pelo WhatsApp e encerre.`;

// O aviso de automação mora AQUI, na primeira fala fixa: é o único ponto que
// não depende do LLM obedecer o prompt — e em voz, sem ele, uma voz natural
// implica pessoa. Palavra de gente, nunca "assistente digital/virtual" (06/ago).
const FIRST_MESSAGE =
  'Oi! Aqui é a Vitória, da Stevi — a gente combinou essa ligação pelo WhatsApp. Só avisando que sou automatizada, tá? Tudo bem falar agora?';

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
          // Gemini Flash: o TTFT mais baixo do catálogo com tool-calling
          // confiável (recomendação da própria EL). Temperatura 0.3 tira o
          // tom de formulário sem arriscar as regras duras; teto de 300
          // tokens porque resposta longa segura a voz — no telefone, frase
          // curta é lei. Cascata de backup automática se o Gemini engasgar.
          llm: 'gemini-2.5-flash',
          temperature: 0.3,
          max_tokens: 300,
          backup_llm_config: { preference: 'default' },
          tools: [
            {
              // Ferramenta de sistema da EL: permite que a agente DESLIGUE ao
              // fim — sem ela a ligação fica pendurada em "Ainda está aí?".
              type: 'system',
              name: 'end_call',
              description:
                'Encerra a ligação. Use SOMENTE depois de registrar o resultado e se despedir.',
            },
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
      // Turn-taking: o que separa "URA" de "gente". turn_v3 é o detector
      // semântico de fim de turno (análogo do semantic VAD da OpenAI);
      // interruption_ignore_terms deixa o cliente fazer "uhum" sem derrubar a
      // fala do agente; soft_timeout é o "deixa eu ver aqui..." enquanto o
      // LLM pensa — preenche o silêncio que soa robótico.
      turn: {
        turn_timeout: 7,
        silence_end_call_timeout: 20,
        turn_eagerness: 'normal',
        turn_model: 'turn_v3',
        // Geração especulativa: começa a montar a resposta ENQUANTO a pessoa
        // ainda fala (mesmo truque do GPT-Live). Se atropelar gente do campo
        // falando devagar, o primeiro ajuste é turn_eagerness: 'patient' —
        // desligar isto é o último recurso.
        speculative_turn: true,
        interruption_ignore_terms: ['uhum', 'aham', 'sim', 'tá', 'ok', 'certo', 'entendi', 'isso'],
        soft_timeout_config: {
          timeout_seconds: 3.0,
          message: 'Hmm, deixa eu ver aqui rapidinho...',
          additional_soft_timeout_messages: ['Só um segundinho...', 'Peraí, tô conferindo...'],
          max_soft_timeouts_per_generation: 2,
          use_llm_generated_message: false,
        },
      },
      asr: {
        quality: 'high',
        // Telefonia (Twilio) fala μ-law 8kHz — declarar evita resample cego.
        user_input_audio_format: 'ulaw_8000',
        // Boost de reconhecimento pros termos do domínio que o ASR mais erra.
        keywords: ['saca', 'arroba', 'café', 'lavoura', 'Stevi', 'Vitória'],
      },
      tts: {
        // Flash: o modelo de menor latência — a escolha certa pra conversa
        // (estudo 2026-08-04-agente-voz). A voz vem de fora porque escolher
        // voz pt-BR é decisão de ouvido, não de código.
        model_id: 'eleven_flash_v2_5',
        voice_id: p.voiceId,
        // Ajuste "expressivo" escolhido de ouvido pelo Stefano (04/ago) entre
        // três amostras: estabilidade baixa dá a variação de prosódia que
        // tira o tom de leitura, sem sair do Flash (latência).
        stability: 0.35,
        similarity_boost: 0.8,
        optimize_streaming_latency: 3,
        agent_output_audio_format: 'ulaw_8000',
        // 'system_prompt' = números por extenso via prompt (zero latência
        // extra; o normalizador nativo da EL adicionaria delay no flash).
        // Grafia britânica ("normalisation") é a da API mesmo.
        text_normalisation_type: 'system_prompt',
        ...(p.dicionario ? { pronunciation_dictionary_locators: [p.dicionario] } : {}),
      },
      conversation: {
        // 'interruption' é o barge-in: o usuário fala por cima e o agente
        // cala na hora, com o transcript corrigido pro que foi de fato ouvido.
        client_events: ['audio', 'interruption', 'user_transcript', 'agent_response', 'agent_response_correction'],
        max_duration_seconds: 600,
      },
    },
  };
}
