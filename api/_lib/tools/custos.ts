/**
 * Grounding de CUSTO DE PRODUÇÃO — a resposta que saía rasa.
 *
 * "Quanto custa produzir uma saca de café?" não é cotação (isPriceRequest não
 * pega, e não deve pegar) e caía no caminho general sem base nenhuma: o modelo
 * respondia de memória, sem fonte e sem número honesto. Existe referência
 * pública nacional para isso: o projeto Campo Futuro (CNA/Senar), com painéis
 * em 400+ municípios desde 2007 e boletins mensais por cadeia — no café,
 * elaborados pelo CIM/UFLA — publicados com "Reprodução permitida desde que
 * citada a fonte". É a MESMA base que alimenta o JoIA, o assistente que a CNA
 * lançou em 25/08/2026; a base é pública, e citável por qualquer um.
 *
 * O bloco deliberadamente NÃO carrega número de custo: o boletim é mensal e um
 * número hard-coded aqui estaria velho na primeira safra. O que ele dá é a
 * estrutura (COE/COT), a fonte citável e o gancho pro dado que só a Stevi tem —
 * o caderno do próprio produtor.
 */

// "custo de produção", "custo por saca/hectare/litro/arroba", "quanto custa
// produzir", "quanto gasto pra produzir". NÃO pega cotação/preço (rota prices)
// nem "quanto custa" de coisa avulsa sem produção envolvida.
const CUSTO_INTENT =
  /\bcustos?\s+(m[ée]dios?\s+)?(de|da|do)\s+produ[çc][ãa]o\b|\bcustos?\s+(m[ée]dio\s+)?(por|de|da|do)\s+(saca|hectare|ha|litro|arroba|talh[ãa]o|lavoura)\b|\bquanto\s+(custa|gasto|gasta|se\s+gasta|eu\s+gasto)\b[^.?!]*\bproduzir\b/i;

/** Se a mensagem pergunta sobre custo de produção. Pure. */
export function isCostQuestion(text: string): boolean {
  return CUSTO_INTENT.test(text);
}

/**
 * O bloco injetado no caminho de raciocínio quando a pergunta é de custo.
 * Estrutura + fonte + honestidade sobre o limite — nunca um número inventado.
 */
export function custosGroundingBlock(): string {
  return (
    `[Custo de produção — base de referência, não invente números]\n` +
    `- Referência pública nacional: projeto Campo Futuro (CNA/Senar) — painéis anuais definem a ` +
    `propriedade MODAL (típica) de cada região produtora e as matrizes de custo são atualizadas ` +
    `mensalmente. No café, a elaboração é do CIM/UFLA. Os boletins "Ativos do Campo" são públicos em ` +
    `cnabrasil.org.br (reprodução permitida com citação da fonte).\n` +
    `- Estrutura que você PODE explicar: COE = o desembolso do ano (insumos, mão de obra, operações, ` +
    `pós-colheita); COT = COE + depreciação de máquinas/lavoura + pró-labore. No café, fertilizantes, ` +
    `defensivos e mão de obra (colheita) costumam dominar o COE.\n` +
    `- NUNCA afirme um valor atual de custo de memória. Se falar em ordem de grandeza, diga de qual ` +
    `boletim/safra veio e deixe claro que é a propriedade modal da região do painel — não a lavoura dele.\n` +
    `- O custo DELE só sai da anotação dele: convide a registrar aqui na Stevi o que aplicar e gastar ` +
    `("me manda o que você aplicou que eu anoto no caderno") e sugira comparar depois com o boletim ` +
    `regional do Campo Futuro — a cooperativa ou o Senar da região costumam ter o painel local.`
  );
}
