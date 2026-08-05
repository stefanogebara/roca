/**
 * Como a Vitória escreve (decisões do Stefano, 05/ago).
 *
 * Três mudanças pedidas depois de ler as conversas reais:
 *
 * 1. ABRIR SÓ COM A PERGUNTA. Medido em 05/ago: de 13 respostas recebidas em 69
 *    envios, ONZE vieram de atendimento automático ("agradece seu contato",
 *    menu numerado, "aguarde um técnico"). Quem atende a porta da empresa é um
 *    robô. Bloco de texto gasto num robô é bloco perdido; pergunta curta é
 *    barata de queimar e é o que faz uma PESSOA responder.
 *
 * 2. SEM RÓTULO CORPORATIVO. "assistente virtual/digital" soa a script de call
 *    center. A honestidade continua obrigatória — se perguntarem, confirma na
 *    hora — mas em palavra de gente, e não recitada na abertura.
 *
 * 3. SEM TRAVESSÃO. Ninguém digita "—" no WhatsApp; é assinatura de texto
 *    gerado e a pessoa sente.
 *
 * O teste lê o PROMPT porque é lá que a regra mora. Não garante que o modelo
 * obedeça (isso é o gym pareado que mede); garante que a instrução não suma
 * numa edição futura, que é como estas coisas se perdem.
 */
import { describe, it, expect } from 'vitest';
import { agentSystemPrompt } from '../api/_lib/prospect/agent';

const prompt = agentSystemPrompt('Vitória');

describe('abertura', () => {
  it('manda abrir com UMA pergunta, não com bloco', () => {
    expect(prompt).toMatch(/UMA PERGUNTA CURTA/);
    expect(prompt).toMatch(/Falo com a \[nome da empresa\]/);
  });

  it('proíbe despejar a proposta na primeira mensagem', () => {
    expect(prompt).toMatch(/N[ÃA]O despeje/i);
  });

  it('carrega o PORQUÊ junto da regra — instrução sem motivo é a que alguém apaga', () => {
    expect(prompt).toMatch(/autom[áa]tico|rob[ôo]/i);
  });
});

describe('como ela se refere a si mesma', () => {
  it('não manda usar rótulo corporativo', () => {
    // A instrução cita os rótulos para PROIBIR; o que não pode é mandar usar.
    expect(prompt).toMatch(/N[ÃA]O use r[óo]tulo corporativo/i);
    expect(prompt).not.toMatch(/apresente-se J[ÁA] como assistente/i);
    expect(prompt).not.toMatch(/Use "assistente digital" ou "IA"/i);
  });

  it('a honestidade continua obrigatória — isso NÃO foi afrouxado', () => {
    // Se um dia alguém quiser tirar isto, que seja uma decisão explícita: é o
    // que protege o número (pessoa falsa desmascarada vira denúncia).
    expect(prompt).toMatch(/NUNCA se passa por pessoa/i);
    expect(prompt).toMatch(/Nunca minta/i);
  });
});

describe('travessão', () => {
  it('a regra existe e nomeia os dois sinais', () => {
    expect(prompt).toMatch(/NUNCA use travess[ãa]o/i);
    expect(prompt).toContain('—');
    expect(prompt).toContain('–');
  });
});
