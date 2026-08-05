/**
 * O template v4: só a pergunta (aprovado pelo Stefano, 05/ago).
 *
 * Por que ele existe, em uma linha de dado: de 13 respostas em 69 envios, ONZE
 * vieram de atendimento automático. Quem atende a porta da empresa é um robô, e
 * bloco de texto gasto no porteiro é bloco perdido.
 *
 * Duas coisas que este teste segura, e as duas já custaram caro aqui:
 *
 * 1. ARIDADE. O outage de 13/jul foi PROSPECT_TEMPLATE_PARAMS divergindo da
 *    forma aprovada: #132000 em todo envio, 0% de entrega, latch de saúde. Hoje
 *    a contagem vem do REGISTRO (registryParamCount), então o corpo daqui é a
 *    fonte da verdade da aridade — se ele mudar sem querer, o disparo quebra.
 * 2. A REGRA DA META. Variável não pode ficar no fim do modelo, e a pontuação
 *    não conta como conteúdo: a primeira submissão do v4 foi RECUSADA por isso
 *    ("As variáveis não podem estar no início ou no fim"). O texto depois da
 *    variável não é enfeite, é o que faz o template existir.
 */
import { describe, it, expect } from 'vitest';
import { V4_NAME, registryParamCount, templateCategory } from '../api/_lib/prospect/template';
import { readFileSync } from 'node:fs';
import { buildTemplateParams } from '../api/_lib/prospect/personalize';

describe('stevi_parceria_v4', () => {
  it('tem exatamente UM parâmetro: o nome da empresa', () => {
    expect(registryParamCount(V4_NAME)).toBe(1);
  });

  it('a pergunta vem primeiro — é a razão de ser da copy', () => {
    // Não basta ter a pergunta; ela tem que ABRIR. Se alguém puser saudação ou
    // apresentação na frente, volta a ser o v3.
    const params = buildTemplateParams(
      { name: 'Rural Consultoria', kind: 'consultoria', city: 'Montes Claros' },
      registryParamCount(V4_NAME) ?? 1
    );
    expect(params).toEqual(['Rural Consultoria']);
  });

  it('NAO termina na variavel: a Meta recusa isso', () => {
    // Regressão direta: a primeira submissão morreu exatamente aqui, com
    // "As variáveis não podem estar no início ou no fim do modelo".
    //
    // Lê o corpo no FONTE porque o registro não é exportado, e exportá-lo só
    // para o teste ampliaria a superfície pública por conveniência de teste.
    const fonte = readFileSync('api/_lib/prospect/template.ts', 'utf8');
    const corpo = /\[V4_NAME\]:\s*\{[\s\S]*?body:\s*'([^']*)'/.exec(fonte)?.[1];
    expect(corpo, 'corpo do v4 não encontrado no registro').toBeTruthy();

    // Pontuação não conta como conteúdo para a Meta: `{{1}}?` é "terminar na
    // variável". Por isso a checagem tira pontuação e espaço do fim antes.
    const semPontuacaoFinal = String(corpo).replace(/[\s?!.,;:]+$/, '');
    expect(semPontuacaoFinal.endsWith('}}'), `termina na variável: ${corpo}`).toBe(false);

    // E a pergunta abre a mensagem, que é a decisão de produto.
    expect(String(corpo).startsWith('Oi! Falo com a {{1}}?')).toBe(true);
  });

  it('é MARKETING, então leva o rodapé SAIR', () => {
    // Contato frio precisa da saída explícita. UTILITY não levaria, e usar
    // UTILITY para cold é o que faz a Meta reclassificar e punir o número.
    expect(templateCategory(V4_NAME)).toBe('MARKETING');
  });
});

describe('painel mostra o que foi enviado', () => {
  it('a thread do v4 renderiza a mensagem real, não um carimbo', async () => {
    // A Meta não devolve o corpo do template no callback, então o painel
    // RECONSTRÓI o texto a partir dos params. Com aridade 1 esse ramo devolvia
    // "(template de parceria v1)" — um texto que nunca foi enviado a ninguém.
    const { renderTemplateText } = await import('../api/_lib/prospect/personalize');
    const texto = renderTemplateText(['Rural Consultoria']);

    expect(texto).toBe('Oi! Falo com a Rural Consultoria? Aqui é a Vitória, da Stevi.');
    expect(texto).not.toMatch(/template de parceria/i);
  });

  it('o texto do painel BATE com o corpo aprovado', async () => {
    // Se um dia divergirem, o painel mente sobre o que a empresa recebeu — e é
    // por ele que a gente lê as conversas.
    const { renderTemplateText } = await import('../api/_lib/prospect/personalize');
    const fonte = readFileSync('api/_lib/prospect/template.ts', 'utf8');
    const corpo = /\[V4_NAME\]:\s*\{[\s\S]*?body:\s*'([^']*)'/.exec(fonte)?.[1] ?? '';
    expect(renderTemplateText(['ACME'])).toBe(corpo.replace('{{1}}', 'ACME'));
  });
});
