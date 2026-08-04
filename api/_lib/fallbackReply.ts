/**
 * A resposta de desistência, num módulo-FOLHA — sem importar nada.
 *
 * Parece exagero dar arquivo próprio a uma string. Não é: o canário precisa
 * dela (uma taxa elevada dessa frase exata é a assinatura de slug de modelo
 * morto ou provedor fora), e ela morava em `pipeline.ts`. Importar de lá
 * arrastava `pipeline → farmcard → tools/ndvi → cog → geotiff` pra dentro do
 * vigia.
 *
 * O preço disso apareceu em 29-30/jul: o `geotiff` quebrou no carregamento
 * (ERR_REQUIRE_ESM) e derrubou o webhook por 24h. O canário TINHA uma sonda no
 * `/api/webhook` desde 12/jul e não alertou — porque o módulo dele também não
 * carregava, pelo mesmo import. O vigia morreu do bug que existia pra denunciar.
 *
 * Regra que este arquivo encarna: **o que vigia não compartilha grafo de import
 * com o que é vigiado.** Uma constante do vigiado vira folha.
 */

/**
 * Duas coisas que esta frase precisa fazer, e a versão antiga não fazia
 * (achado #20 da auditoria de 04/ago):
 *
 * 1. SER ACIONÁVEL. "manda de outro jeito" — qual outro jeito? O produtor não
 *    sabe o que a Stevi consegue ler. O `PHOTO_RETRY_MSG`, no mesmo repo, já
 *    ensina o padrão certo: diz exatamente o que fazer ("focando na folha, de
 *    pertinho e com boa luz"). Aqui as opções concretas são texto curto e
 *    áudio, e vale nomeá-las.
 *
 * 2. TER SAÍDA DE URGÊNCIA. Esta frase aparece quando TUDO falhou, e quem está
 *    com lavoura em risco não pode ficar preso esperando um robô voltar. Se a
 *    resposta não vem, o caminho honesto é o agrônomo — dizer isso custa nada e
 *    é o que a Stevi diria se fosse gente.
 *
 * O canário conta a frequência desta frase exata (taxa elevada = slug de modelo
 * morto ou provedor fora). Ao mudá-la, o casamento é por prefixo lá; ver
 * canary.ts antes de reescrever.
 */
export const FALLBACK_REPLY =
  'Tive um problema pra processar isso agora 😔. Tenta de novo daqui a pouco — ' +
  'se ajudar, manda em texto curto ou em áudio, que costuma passar. ' +
  'E se for urgente na lavoura, não espera por mim: fala com seu agrônomo.';
