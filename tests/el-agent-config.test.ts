/**
 * A configuração do agente Vitória-voz — as regras da casa valem em voz.
 *
 * O agente nasce apontado pro quadrante certo (plano 2026-08-04-agente-voz):
 * LIGAÇÃO ESPERADA — quem atende já conversou com a Vitória no WhatsApp e
 * concordou em receber a chamada. As regras duras da Vitória-texto migram
 * intactas: nunca preço, escala pro Stefano, nunca inventa, e se apresenta
 * como assistente digital — em chamada esperada o disclosure não é surpresa.
 */
import { describe, it, expect } from 'vitest';
import { montarConfigAgente, AGENT_NAME_EL } from '../api/_lib/voice/elAgent';

const cfg = montarConfigAgente({
  voiceId: 'voz_teste',
  toolsUrl: 'https://roca-black.vercel.app/api/el-tools',
  toolsSecret: 's3gr3d0',
});

describe('montarConfigAgente', () => {
  it('fala português e usa o modelo de menor latência', () => {
    expect(cfg.conversation_config.agent.language).toBe('pt');
    expect(cfg.conversation_config.tts.model_id).toMatch(/flash/);
    expect(cfg.conversation_config.tts.voice_id).toBe('voz_teste');
    // Perfil "expressivo" escolhido de ouvido (04/ago): estabilidade baixa
    // pra prosódia variada, sem trocar de modelo.
    expect(cfg.conversation_config.tts.stability).toBeLessThan(0.5);
  });

  it('latência: LLM rápido com teto de tokens, turno especulativo ligado', () => {
    const p = cfg.conversation_config.agent.prompt;
    expect(p.llm).toMatch(/flash/); // tier rápido — a maior fonte de latência é o LLM
    expect(p.max_tokens).toBeGreaterThan(0); // -1 (sem teto) = fala-sermão
    expect(cfg.conversation_config.turn.speculative_turn).toBe(true);
    expect(cfg.conversation_config.turn.turn_model).toBe('turn_v3'); // requisito do especulativo
  });

  it('pronúncia: normalização por prompt e dicionário quando fornecido', () => {
    expect(cfg.conversation_config.tts.text_normalisation_type).toBe('system_prompt');
    expect(cfg.conversation_config.agent.prompt.prompt).toMatch(/por extenso/);
    // sem dicionário o campo nem aparece (a API rejeita locator vazio)
    expect('pronunciation_dictionary_locators' in cfg.conversation_config.tts).toBe(false);
    const com = montarConfigAgente({
      voiceId: 'v', toolsUrl: 'https://x', toolsSecret: 's',
      dicionario: { pronunciation_dictionary_id: 'd1', version_id: 'v1' },
    });
    expect(com.conversation_config.tts.pronunciation_dictionary_locators).toEqual([
      { pronunciation_dictionary_id: 'd1', version_id: 'v1' },
    ]);
  });

  it('o prompt carrega as regras duras da casa', () => {
    const p = cfg.conversation_config.agent.prompt.prompt;
    expect(p).toMatch(/assistente digital/i); // disclosure
    expect(p).toMatch(/nunca.*(pre[çc]o|valor)/i); // regra de preço
    expect(p).toMatch(/Stefano/); // escalada
    expect(p).toMatch(/combinad/i); // quadrante certo: ligação combinada…
    expect(p).toMatch(/NUNCA liga fria/i); // …e a proibição explícita de cold call
  });

  it('primeira fala é curta, se apresenta e ancora na conversa do WhatsApp', () => {
    const f = cfg.conversation_config.agent.first_message;
    expect(f.length).toBeLessThan(220);
    expect(f).toMatch(/Vit[óo]ria/);
    expect(f).toMatch(/WhatsApp/i);
  });

  it('as tools de webhook apontam pro nosso endpoint com o secret no header', () => {
    const tools = cfg.conversation_config.agent.prompt.tools;
    const webhooks = tools.filter((t) => t.type === 'webhook');
    expect(webhooks).toHaveLength(2);
    for (const t of webhooks) {
      expect(t.api_schema?.url).toBe('https://roca-black.vercel.app/api/el-tools');
      expect(t.api_schema?.request_headers['x-el-tools-secret']).toBe('s3gr3d0');
    }
    expect(webhooks.map((t) => t.name).sort()).toEqual(['contexto_prospect', 'registrar_resultado']);
  });

  it('a agente consegue desligar: end_call registrado e citado no prompt', () => {
    const tools = cfg.conversation_config.agent.prompt.tools;
    expect(tools.some((t) => t.type === 'system' && t.name === 'end_call')).toBe(true);
    expect(cfg.conversation_config.agent.prompt.prompt).toMatch(/end_call/);
    // e o anti-loop da ligação de teste 2: nunca repetir frase igual
    expect(cfg.conversation_config.agent.prompt.prompt).toMatch(/NUNCA repita/i);
  });

  it('nome do agente é estável — é a chave da idempotência do setup', () => {
    expect(AGENT_NAME_EL).toBe('Vitoria Voz (Stevi)');
  });
});
