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

  it('as duas tools apontam pro nosso endpoint com o secret no header', () => {
    const tools = cfg.conversation_config.agent.prompt.tools;
    expect(tools).toHaveLength(2);
    for (const t of tools) {
      expect(t.api_schema.url).toBe('https://roca-black.vercel.app/api/el-tools');
      expect(t.api_schema.request_headers['x-el-tools-secret']).toBe('s3gr3d0');
    }
    expect(tools.map((t) => t.name).sort()).toEqual(['contexto_prospect', 'registrar_resultado']);
  });

  it('nome do agente é estável — é a chave da idempotência do setup', () => {
    expect(AGENT_NAME_EL).toBe('Vitoria Voz (Stevi)');
  });
});
