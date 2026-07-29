# Produto, dados e arquitetura — o que medi em 29/jul

Não é auditoria por leitura: cada número abaixo saiu de rodar o código de
produção ou de consultar a fonte. Onde não consegui medir, está escrito que não
consegui.

---

## 1. O achado que mais dói: o preço está 25% errado

Rodei `fetchPrices()` + `formatPricesReply()` de produção. É isto que o
cafeicultor recebe hoje:

```
💰 Cotações de hoje (referência internacional)
• Café arábica (NY): ~R$ 2.228,75/saca 📈 +4,0% na semana
```

O indicador que ele de fato usa para negociar, no mesmo dia:

| | R$/saca |
|---|---|
| Nossa resposta (KC=F convertido) | **2.228,75** |
| CEPEA/ESALQ arábica, 28/07/2026 | **1.782,18** |

**Diferença: R$ 446/saca, 25% para cima.** Num lote de 100 sacas são
R$ 44.600 de valor que não existe.

A conversão em si está certa (`(¢/lb ÷ 100) × 132,276 × USD/BRL`). O erro é de
**referência**: KC=F é arábica lavado entregue em armazém americano. O café
brasileiro natural transaciona com desconto sobre NY, e o CEPEA mede o físico
brasileiro — bica corrida, tipo 6, peneira 13, à vista.

O rodapé diz "o preço físico na sua região varia com frete, qualidade e praça".
É verdade e é insuficiente: o produtor lê **R$ 2.228** e ancora nele. Um número
grande com uma ressalva pequena é um número errado com álibi.

**O que fazer:** liderar com CEPEA e mostrar NY como contexto secundário
("NY subiu 4% na semana"), não o contrário. O CEPEA não publica API — as saídas
são licenciar, usar um redistribuidor, ou negociar acesso. É decisão de produto
com custo, não um patch.

**Enquanto não muda:** trocar o rótulo de "Cotações de hoje" para "Bolsa de
Nova York hoje" e dizer o desconto típico. Custa uma linha e para de ancorar
errado.

---

## 2. Dependências externas: duas são risco real

8 hosts externos sustentam as respostas. Duas merecem ação:

| Host | O que serve | Problema |
|---|---|---|
| `api.open-meteo.com` | clima, Delta T, geada | **Tier grátis proíbe uso comercial**, explícito nos termos. Limite 10k/dia |
| `titiler.xyz` | NDVI (satélite) | Endpoint de **demonstração** da Development Seed. A doc deles pede "please be kind" |
| `query1.finance.yahoo.com` | cotações | API não documentada, sem contrato. Já nos deu 429 |
| `rest.isric.org` | solo | Instabilidade conhecida — já falha soft, ok |

O Open-Meteo é o mais urgente porque é **jurídico, não técnico**: somos um
produto comercial usando um tier que proíbe uso comercial. O plano pago começa
barato; é linha de custo, não bloqueio.

O `titiler.xyz` é infraestrutura de terceiro que ninguém prometeu manter. Se
sair do ar, o NDVI morre sem aviso. Self-host de TiTiler é container simples.

---

## 3. O que está BOM e não deve ser mexido

**O veredito de pulverização.** Delta T 2–8 °C é a janela agronômica padrão, e
o código a implementa com vento (10/15 km/h) e chuva (40/70%), degradando
`go → caution → no-go` com motivo em português falado:

> *"Delta T 9,2 °C está muito alto: a gota evapora antes de chegar na folha e
> deriva pro vizinho."*

Isso é bom produto: número técnico traduzido em consequência concreta. É o
diferencial mais defensável que temos e não precisa de mudança.

**O grounding do Agrofit.** Citar "212 produtos registrados, grupos X/Y/Z, a
escolha é do agrônomo" resolve os dois lados: dá lastro técnico e devolve a
decisão a quem tem CREA. É o que torna a tese "triagem, não prescrição"
verificável em vez de slogan.

**O brief pro agrônomo.** Determinístico (não é geração livre), e o caso
incompleto cobra o que falta em vez de inventar. Corrigido hoje: imprimia
`cafe` sem acento — slug interno vazando pro produtor.

---

## 4. Arquitetura: o padrão que já acertamos

A convergência da indústria em 2026 é **guarda determinístico ANTES do LLM,
checagem por modelo depois** — filtros baratos cedo evitam chamada cara e
evitam que o modelo decida o que não deveria.

Nós já fazemos isso, em dois lugares:

- **Roteamento:** 5 regexes de intenção (preço, satélite, histórico, brief,
  referral) decidem a rota antes de qualquer LLM.
- **Prospecção:** hoje portamos da Olímpia o porteiro, o teto de cadência e o
  silêncio-como-tipo — todos determinísticos, todos pré-LLM.

A lição que resume é do código deles: *"a detecção existia e estava
desconectada da decisão"*. Regra em prompt não é mecanismo de execução.

### Frameworks: não adotar agora

LangGraph (1.0 GA), CrewAI, Pydantic AI resolvem: streaming, sessões, retries,
idempotência, aprovação de tool. Vale quando o problema é **orquestração de
muitos agentes com estado complexo**.

Nosso problema não é esse. É uma conversa por vez, com rotas determinísticas e
poucas ferramentas. Trocar por framework seria multi-semanas de migração para
resolver o que já está resolvido — e perderíamos os guard-rails específicos que
custaram incidentes reais para aprender.

**O que vale roubar sem adotar o framework:** aprovação explícita de tool para
ação de risco, e argumentos de tool tipados. Hoje as ações de risco (escrever
no caderno, criar referral) são decididas por regex + LLM sem contrato tipado.

---

## 5. O débito estrutural: `pipeline.ts` com 1.317 linhas

É o arquivo que decide toda resposta ao produtor. A auditoria já apontou; hoje
ficou pior porque cada correção entra nele.

Não proponho refatorar agora — o gargalo do negócio é campo, não código, e o
tripwire de commits×conversas está disparado. Mas registro que **cada mês que
passa aumenta o custo de mexer nele**, e que a próxima feature grande deve
vir com a extração junto.

---

## 6. Ordem que eu recomendo

| # | O quê | Por quê | Esforço |
|---|---|---|---|
| 1 | Rótulo do preço: "Bolsa de NY" + desconto típico | Para de ancorar 25% errado. Uma linha | 15 min |
| 2 | Open-Meteo plano pago | Risco jurídico num produto comercial | decisão + cartão |
| 3 | CEPEA como número principal | É o preço que ele negocia | pesquisa + custo |
| 4 | Self-host do TiTiler | Tirar produção de um demo alheio | ~4h |
| 5 | Tool tipada para escrita | "Anotado ✅" que não anotou já aconteceu | ~6h |

O #1 é o único que faço sem perguntar: é correção de honestidade, barata e
reversível. Os outros custam dinheiro ou mudam produto.
