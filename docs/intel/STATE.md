# Estado do repositório — Stevi (roca)

> Escrito pela segunda passada do `/intel` em 2026-08-31. Janela: desde 24/08.
> HEAD `0a6b76d`, branch `master`.
> Reescrito a cada `/intel`. Fonte: o git e o banco, não o config.

## O parágrafo

**Rajada de 15 commits nas primeiras 27 horas depois da passada anterior, depois
silêncio total por seis dias.** As sete PRs (#5–#11) mescladas em 24–25/08 saíram
inteiras do próprio `/intel` de 24/08: ele achou três bugs com prazo no caminho
do alerta de vazio sanitário e uma linha do config desatualizada, e as sessões
seguintes consertaram tudo — inclusive um recurso novo de 2.552 linhas (mapa de
município → região da portaria) que ninguém pediu. Zero commits de 26 a 31/08.
Zero conversa de produtor externo registrada, de novo. E o achado mais forte da
semana não veio do git: a **CNA lançou nacionalmente, em 25/08, um concorrente
direto** — JoIA, assistente de IA gratuito para produtor rural no WhatsApp,
alimentado por 17 anos de dados do Campo Futuro. Restam **11 dias** até 11/set.

## O que shipou (24–25/08, todo em um único dia de trabalho)

- **`def021c` — o alvo proativo passa a ser só produtor.** `listSojaFarmersByUf`
  e `listFarmsWithCoords` não filtravam `users.kind`; filtro positivo
  (`kind = 'produtor'`), falha fechado. Motivado por prazo real: o vazio de MT
  fechava a janela de 7 dias em 30/08.
- **`7e891f5` — calendário completo (17→22 UFs) e safra no `alertDedupKey`.**
  PA, RR, AL, AP, CE deixam de devolver `{known:false}` em silêncio. Chave de
  dedup ganha `SAFRA_VAZIO` — sem isso, uma portaria futura que repetisse UF+data
  faria o alerta sumir sem erro.
- **`b9487ed` — corrige o próprio registro anterior** sobre `farmer_alerts` com
  a medição de banco de 24/08 (2 linhas, ambas teste, ambas 14/08).
- **`9de441d` — UF regional recebe hedge, não data pessoal.** `buildVazioAlertText`
  parou de cravar a data do envelope para UF com múltiplas regiões (SP incluída)
  — o caminho reativo já fazia isso, o proativo não.
- **`d86a8a2` — o recurso grande da semana: município resolve a região.**
  `scripts/extrair-regioes-vazio.mjs` + `knowledge/vazio-regioes-2026.json`
  (1.836 municípios, 7 UFs) permitem saber a data exata por região em vez do
  envelope — para SP isso é a diferença entre avisar no dia certo e avisar 15
  dias tarde. 2.552 linhas em 12 arquivos. **Não foi pedido; nasceu do achado do
  `/intel` anterior.**
- **`a4391a1` + `fb2eca5` — confiabilidade da migration.** Tolerância a
  `farms.municipio` ainda não aplicada, seguida da correção da deriva
  schema-vs-repo que já tinha voltado uma vez em 04/ago (10 arquivos renomeados
  para bater com o histórico real do banco).

## O que está em voo

- Nada novo além do que já estava: PR #4 (scorecard 10/ago) segue DRAFT; a
  branch órfã de 76 commits (`claude/xenodochial-moore-9dc540`) segue sem PR.

## O que morreu

Nada novo nesta janela.

## Medição de 31/08 — o que o banco diz agora

Consulta somente-leitura no projeto `ruuflfeqcmxpziernaop`, sem PII.

- **`farmer_alerts` continua com exatamente 2 linhas** — as mesmas de 14/08,
  ambas `fire`, ambas de teste. **Nenhum alerta novo disparou desde a última
  medição.** O loop proativo para produtor real segue em zero na vida do produto.
- **`farms.municipio` existe fisicamente na tabela — mas não está na tabela de
  migrations do Supabase** (`supabase_migrations.schema_migrations` para no
  `20260807160654`; `20260824180000_farms_municipio` não aparece). **A mesma
  deriva que `fb2eca5` acabou de consertar para outras 10 migrations já
  reapareceu numa 11ª**, um dia depois — a coluna foi criada fora do fluxo de
  migration outra vez.
- **E o produtor real de SP — o único alvo do recurso de município que acabou
  de ser construído — tem `farms.municipio = null`.** O mapa de 1.836
  municípios não tem, hoje, nenhum município seu para resolver. Sem isso, o
  código cai no hedge seguro (correto, não é bug), mas o ganho de precisão que
  motivou 2.552 linhas de código ainda não se aplica a ninguém de verdade.
- Denominador sem mudança desde 24/08: 3 farms com pin, 1 produtor com soja
  (SP).

## Estado do tripwire

| Lado | Número |
|---|---|
| Commits nos últimos 7 dias | **15** |
| Commits nos últimos 6 dias (26–31/08) | **0** |
| Conversas com produtor externo registradas | **não medido** — vive no banco de produção/WhatsApp pessoal, fora do alcance deste repositório |
| `farmer_alerts` | **2 linhas, sem mudança desde 14/08** |
| Alvos reais do loop proativo | **1** produtor com pin · **1** produtor com soja (SP), município ainda não capturado |
| Dias restantes até 11/set | **11** |

**Leitura qualitativa, mesmo sem o lado direito medido: os 15 commits inteiros
foram gerados pelo próprio `/intel` anterior — achado de bug vira PR no mesmo
dia, inclusive um recurso de 2.552 linhas que ninguém pediu.** Isso é o padrão
que o tripwire nomeia — "o conserto nunca é mais código" — acontecendo dentro
do próprio processo de intel. Vale nomear no PR sem meia-palavra.

## Divergências com o config

Nenhuma foi aplicada sozinha. `bets` e `settled` só o Stefano mexe.

1. **Concorrente direto novo, ausente do `intel.config.json` e de `known_gaps`.**
   A CNA lançou o **JoIA** em 25/08 — assistente de IA gratuito no WhatsApp para
   produtor rural, nacional, apoiado em 17 anos de dados do Campo Futuro e
   conteúdo do Senar. Ficou como item DISCUTIR nesta rodada (ver `INTEL.md`);
   registrado aqui porque muda a leitura competitiva que o config ainda não tem.
2. **A deriva de migration (`known_gaps`) não está resolvida — reapareceu.**
   `fb2eca5` consertou 10 migrations e classificou `farms_municipio` como "só
   rodar depois, idempotente". Ela não rodou pelo fluxo de migration; a coluna
   está em produção sem estar no histórico. O texto do `known_gaps` sobre deriva
   schema-vs-repo deveria refletir que o problema é recorrente, não um incidente
   fechado em 04/ago.
