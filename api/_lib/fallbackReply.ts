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

export const FALLBACK_REPLY =
  'Tive um problema pra processar isso agora. Tenta de novo daqui a pouco, ou manda de outro jeito.';
