# Auditoria completa — 04/ago/2026

Cinco frentes em paralelo (fluxo, respostas, Vitória, UI, segurança), todas somente
leitura. Cada achado abaixo está marcado como **VERIFICADO** (eu confirmei
pessoalmente no código ou no banco) ou **RELATADO** (achado de agente que eu não
re-confirmei — trate como forte, não como certo).

## O padrão que aparece em quatro das cinco frentes

Antes da lista: cinco casos independentes em que **o comentário descreve o
comportamento certo e o código faz outra coisa**.

| local | o comentário promete | o código faz |
|---|---|---|
| `pipeline.ts:1305` | opt-out honrado "before any other handling" | áudio não é honrado; prospect não é apagado |
| `farmcard.ts:88` | "Never throws" | chama `setFarmLocation` fora de qualquer try |
| `webhook.ts:113` | explica por que a função irmã ganhou try/catch | a de cima ficou sem |
| `db.ts:868` | resolve o crescimento perpétuo do dado de terceiro | poda só a tabela filha |
| `core.ts` (corrigido 03/ago) | "an uncited number is someone's guess" | caía no número não citado |

Não é descuido pontual — é o modo de falha da casa. **Comentário não é testado.**
Onde a intenção está escrita com clareza e ninguém a fixou em teste, a
implementação diverge sem sinal. Os itens 1, 2, 4 e 6 abaixo são todos instâncias
disso.

---

## CRITICAL

### 1. `handleInbound` roda sem rede — qualquer throw = produtor sem resposta
**VERIFICADO** · `api/_lib/pipeline.ts:1283-1353` (zero `try`/`catch` na função)

O único fail-soft real está dentro de `reasonFallback`. `buildRouteContext`, as 15
rotas e `finalizeAndSend` rodam descobertos. Um throw sobe para `webhook.ts`, que
loga, alerta os founders e dá `ack()`. **O produtor recebe zero.**

Caminho concreto: pin 📍 → `locationPinRoute` → `buildFarmCard` → `setFarmLocation`
fora do `Promise.allSettled` e de qualquer try, apesar do docstring dizer *"Never
throws"*. O momento de payback do onboarding vira silêncio.

Nenhum teste cobre "rota lança → produtor recebe algo".

### 2. Contabilidade de prospecção pode derrubar a resposta do produtor
**VERIFICADO** · `api/webhook.ts:109`

`applyProspectStatuses` roda antes de `handleInbound`, sem proteção. O comentário
oito linhas abaixo explica exatamente esse risco e resolve para a função irmã
(`aplicarStatusEmAlertas`) — a de cima ficou descoberta.

Ela é a mais pesada: um UPDATE por evento e um `await alertFounders` **sequencial**
por status `failed`. Um lote da Meta com 3 falhas dispara 3 alertas em série pela
mesma Graph API que acabou de falhar. Se qualquer um estourar, `handleInbound`
nunca roda: o produtor mandou foto de ferrugem e recebeu nada porque a
prospecção quebrou.

### 3. Loop bot-contra-bot: 95% do volume de saída
**VERIFICADO** (distribuição) · **RELATADO** (causa) · **CORRIGIDO** 04/ago

Guard em `api/_lib/ecoGuard.ts`, ligado antes do roteamento (é a chamada de LLM
que custa). O sinal NÃO é o do `ecoDeMaquina` da Vitória: lá a contraparte
repete a si mesma e há piso de 40 chars porque gente repete "ok"; aqui ela
repete a NÓS, verbatim — "Até mais! Tamo junto. 🌱" devolvido idêntico. Sem piso
de tamanho (o caso real tem 3 palavras), comparação estrita (só caixa e espaço),
e só os turnos `stevi` — produtor que insiste com a própria frase é humano e
urgente, e continua sendo respondido.

Medido contra o dia real: **832 das 837** mensagens `out` de 03/ago são
posteriores ao ponto onde o guard dispararia (99,4%). Varrendo a base inteira,
o guard calaria **um único interlocutor** — "Corpal Tratores", 589 ecos, o
autoatendimento de uma revenda. Nenhum produtor real.

**Residual, de propósito:** um robô que PARAFRASEIA em vez de espelhar escapa.
Afrouxar a comparação pegaria esse caso e passaria a arriscar calar produtor —
o erro barato é deixar escapar.

880 de 926 mensagens `out` são `smalltalk`. O agente identificou 25+ turnos de
`"Até logo! 🌱"` ↔ `"Até logo! 🌱"` com o mesmo interlocutor automático, ~13s por
turno, em 03/ago 13:48–14:22. Não existe guard de eco no lado do produtor (o
`ecoDeMaquina` existe só na Vitória).

Cada turno é uma invocação e uma chamada de LLM. Além do custo, **contamina toda
métrica**: caderno, digest e WAU contam esse ruído. Qualquer leitura de tração
hoje está inflada.

---

## HIGH

### 4. "Apaga meus dados" mente para o prospect
**VERIFICADO** · `pipeline.ts:1288` → `db.ts:995-1013`

`guardDeletionRequest` roda primeiro, chama `deleteUserData`, que procura só em
`users` e devolve `true` quando não acha. O prospect recebe:

> "Pronto, apaguei seus dados (localização e histórico)."

**Não existe um único delete em `prospects` no código.** Nome, telefone, cidade,
notes e o thread inteiro permanecem. São 279 linhas na base, a mais antiga de
09/jul.

Dado de terceiro coletado sem consentimento + declaração falsa ao titular
(LGPD Art. 18 §6). É o único achado da auditoria que não é risco técnico, e sim
uma afirmação incorreta feita a uma pessoa.

### 5. Opt-out por áudio não é honrado
**VERIFICADO** · `pipeline.ts:1309` vs `:1318`

`handleProspectInbound(msg.from, msg.text ?? null)` roda **nove linhas antes** da
transcrição de voz. Áudio chega com `text = null`, `isOptOut` devolve false, e a
mensagem vai para o agente conversacional — que responde.

Numa base do agro brasileiro, áudio é o canal natural de quem não digita. O robô
continua falando com quem pediu para parar, e o pedido não fica registrado.

### 6. `prospects` não tem retenção nenhuma
**RELATADO** · **CORRIGIDO** 04/ago · `db.ts` PURGE_TARGETS

Régua: `updated_at`, 365 dias — "um ano sem NENHUM toque". Lead sendo trabalhado
nunca é podado; contato raspado e nunca usado sai um ano depois da descoberta. A
coluna é NOT NULL com default `now()`, o que importa porque `.lt()` não casa com
null e coluna anulável viraria isenção silenciosa.

**Achado maior encontrado ao consertar este:** `voice_calls.prospect_id` (criada
04/ago pela integração de voz) tinha FK **NO ACTION**. Isso quebrava DUAS coisas,
em silêncio, até existir a primeira ligação ligada a prospect:

1. **LGPD.** `deleteProspectByPhone` tomaria violação de FK — o titular pediria
   exclusão, a função devolveria false, e a TRANSCRIÇÃO da ligação dele ficaria
   na base. O mesmo defeito que o conserto de hoje resolveu, reaberto por outra
   porta.
2. **Retenção.** O purge cairia inteiro no primeiro prospect com ligação: um
   DELETE com filtro é uma operação só, uma linha presa derruba o lote.

Corrigido por migration (CASCADE, aplicada e verificada em produção) e travado
por teste topológico: toda FK que aponte para `prospects` tem que ser CASCADE —
vale para a PRÓXIMA tabela que alguém pendurar lá.

**Deriva de schema descoberta no caminho — CORRIGIDA no fim do dia.**

A contagem inicial ("seis migrations faltando") estava errada: eu comparei NOMES
DE ARQUIVO com os nomes registrados no banco. `moat_events_and_caderno_fields`
já estava no repo como `20260725000030_moat.sql` — dali em diante os nomes locais
divergem dos timestamps reais, então a comparação por nome não valia nada.
Comparando OBJETOS (tabelas e colunas), faltavam quatro:

- `20260727192947_prospect_mobile_enrichment`
- `20260730201006_prospect_gym_paired_runs`
- `20260731195546_prospects_enrich_tried_at`
- `20260803192238_founder_alerts_delivery_tracking`

Todas reconstruídas do schema real e commitadas. E um defeito de verdade que
apareceu no processo: `prospect_wa_phone.sql` faz RENAME de `mobile_phone`, cuja
criação estava justamente na migration ausente — **um banco novo não subia**. Os
dois arquivos de 27/jul foram renumerados para os timestamps reais do banco, para
que a ordem de aplicação volte a bater.

`tests/migrations-completas.test.ts` trava a regra: toda tabela usada pelo código
tem CREATE, todo RENAME cai sobre coluna criada, e o create vem ANTES do rename.

O comentário afirma resolver o crescimento perpétuo do dado de terceiro, mas o
alvo é `prospect_messages` — a **filha**. A mãe, onde mora o PII, nunca é podada.
A FK é CASCADE: podar a mãe levaria as filhas junto.

Mesma família do bug do `farmer_alerts` corrigido em 03/ago — desta vez não é
coluna errada, é tabela ausente.

### 7. Nenhum `fetch` do Cloud API tem timeout
**VERIFICADO** · `transport/cloud.ts` — 6 `fetch`, zero `signal:`

Único módulo de I/O da casa sem deadline (`llm.ts`, `weather.ts`, `soil.ts`,
`geo.ts`, `cog.ts`, `alert.ts` todos têm). Graph API pendurada → `withRetry` 3×
pendurado → `alertFounders` tenta WhatsApp pela mesma API → estoura o
`maxDuration` de 60s. Função morta: sem 200, sem alerta, sem resposta. A Meta
reentrega e o ciclo repete.

### 8. Orçamento de 60s não fecha no caminho da foto
**RELATADO** · **CORRIGIDO** 04/ago · `api/_lib/orcamento.ts`

Apertar timeout por chamada não fechava: são as TENTATIVAS que multiplicam
(25s × 2 × duas chamadas = 100s só de LLM). O conserto é um prazo compartilhado
por requisição — cada tentativa gasta o que sobrou, e a segunda só existe se
couber. Orçamento de 55s, não 60: o estouro passa a ser nosso, com throw que o
catch de topo vira FALLBACK_REPLY, em vez da plataforma matar a função sem
deixar nada rodar. Para o produtor é a diferença entre "deu ruim, manda de
novo" e silêncio absoluto.

O prazo viaja por `AsyncLocalStorage`, não por variável de módulo: no Fluid a
mesma instância atende requisições concorrentes, e estado de módulo faria o
produtor que chegou depois herdar um prazo vencido de outra pessoa. Tem teste
de concorrência fixando isso — com estado de módulo ele falha.

Também fechada a segunda metade do achado: os seis extractors baratos agora
passam `timeoutMs: 10_000`. Eram ZERO — o docstring pedia desde sempre e nenhum
call site cumpria. `tests/extractor-prazo.test.ts` lê o fonte e trava a regra,
porque o que apodreceu foi justamente a chamada nova que ninguém ligou a teste.

`fetchMedia` (sem timeout) → `identifyFromPhoto` (até 50s) → compose (até 50s).
Pior caso passa de 100s. O docstring do `llm.ts` pede que extractors baratos
passem ~10s; **nenhum call site passa `timeoutMs`**.

### 9. Cultura fora de domínio some silenciosamente
**RELATADO** · **CORRIGIDO** 04/ago · `reason.ts`

O conserto inverte quem decide: o modelo diz o que VÊ, em texto livre, e o
código decide se é cultura de casa via `normalizeCrop`, que já existia. Enum no
prompt era o modelo apagando informação antes de nós — e nenhum conserto a
jusante recupera um nome que nunca foi dito. `VisionId` passa a ter `cropVisto`
(o nome livre) e `crop` (a chave canônica); "fora de domínio" e "não deu pra ver"
deixam de ser o mesmo `null`. Fora do domínio a composição recebe instrução
explícita de dizer que ali a Stevi vai pelo geral, não citar Agrofit e reforçar o
agrônomo local.

**Segundo defeito, achado ao consertar:** o enum do caminho de TEXTO
(`extractPestTarget`) era `soja|milho|pastagem|outro` — sem café e sem citros,
que a Stevi ANCORA no Agrofit. "Meu cafezal tá com broca" virava `outro` e perdia
o grounding de uma cultura de casa. Mesmo conserto.

O modelo classifica `crop` como `"outro"` e o código converte para `null` —
indistinguível de "não deu pra ver". A resposta sai genérica, com a **mesma
embalagem de confiança** das culturas em que a Stevi é boa.

Foi o caso do mamão em 03/ago. O goldenset (36 casos) não tem um único caso fora
de domínio.

### 10. Página em branco se o `app.js` não chegar
**VERIFICADO** · **CORRIGIDO** 04/ago · `web/index.html` + `web/app.js`

Não pelo conserto proposto abaixo. Mover o `classList.add('js')` para dentro do
`app.js` (defer) faria o conteúdo renderizar visível e SUMIR quando o script
chegasse — um piscar em toda visita boa para consertar a visita ruim. O inline
fica onde está e passa a se desarmar: se em 3s o `app.js` não levantou
`window.__steviApp`, o `.js` sai e a página aparece inteira, sem animação. Os
três estados fecham: sem JS (inline nunca roda), JS sem app.js (desarme), tudo
certo (reveal normal).

`.js` é setado síncrono no `<head>`; `.js .reveal { opacity: 0 }`; `app.js` é
`defer`. Se a conexão derrubar só o JS, **nada nunca reaparece** — 11.492px de
conteúdo invisível, e o CTA fica invisível mas clicável. Zero `<noscript>`.

É exatamente o modo de falha do público-alvo (2G/3G rural). Conserto de uma
linha: mover o `classList.add('js')` para dentro do `app.js` — se ele não chegar,
`.js` nunca é setado e a página renderiza inteira.

---

## MEDIUM — todos CORRIGIDOS em 04/ago

- **11.** `triage_events` com 0 linhas. **CORRIGIDO**: a gravação estava presa ao
  card visual, e o card só sai com praga identificada e confiança não-baixa —
  regra de PRODUTO correta que virou regra de DADO sem ninguém decidir. Agora o
  `reason` expõe dois observadores separados (`onPestCard` = o que mostrar,
  `onTriage` = o que vimos) e `triage_events.pest` aceita null, porque "não deu
  pra identificar" É dado. Migration aplicada.
- **12.** Gate de compliance cego ao produtor pequeno. **CORRIGIDO**: entraram
  `bomba`, `litro de água`, `calda`, `saca`, `%` e quantidade por extenso ("meio
  litro"). O gate só sabia ler taxa por ÁREA — a régua de quem tem pulverizador
  de barra, não de quem carrega bomba costal. Segunda metade: **verbo + MARCA
  sem dose** passa a barrar, porque a Lei 14.785/2023 põe a escolha do PRODUTO
  no receituário, não só a dose. Restrito a marca, não a ativo: citar ativo é o
  que a Stevi faz para ancorar no Agrofit.
- **13.** `agrofit.ts` lançava na init. **CORRIGIDO**: degrada com log alto, como
  o vizinho `compliance.ts` já fazia. Um throw ali não é erro de requisição — é
  o módulo falhando ao carregar, com nenhuma requisição chegando a rodar, e
  nenhum try/catch a jusante alcança. Mesma forma do apagão de 29/jul.
- **14.** Guardas caras antes da idempotência. **CORRIGIDO**: a reivindicação
  passa a ser a PRIMEIRA coisa, sem dono (`messages.user_id` é nullable), e a
  linha é adotada quando o usuário aparece. Não deu pra só trocar as linhas de
  lugar: as duas guardas rodam antes de resolver o usuário de propósito.
- **15.** `alertFounders` awaited antes do ack. **CORRIGIDO** no webhook e nos
  quatro pontos do pipeline que ficam entre a mensagem e o ack. A ORDEM DOS
  CANAIS não mudou — é decisão de produto documentada ("alerta em caixa de
  entrada não acorda ninguém") e não era o que estava errado.
- **16.** Opt-out sem verbatim. **CORRIGIDO**: coluna `verbatim` própria
  (migration aplicada), truncada em 500 na camada de dados. `reason` segue sendo
  a categoria; a evidência do pedido agora existe.
- **17.** `OPTOUT_RE` larga demais. **CORRIGIDO**: a régua nova exige que a
  mensagem INTEIRA seja o pedido (ancorada nas duas pontas) ou que a frase diga
  explicitamente que é sobre receber mensagem. "quero sair" casa; "vou sair pro
  campo agora" não.
- **18.** `verifyCardQuery` falhava ABERTO. **CORRIGIDO**: recusa sem segredo, e
  — a outra metade, sem a qual o conserto pioraria as coisas — quem monta a
  resposta consulta `cardSecretConfigured()` e não anexa card que o endpoint vai
  negar. Só endurecer a verificação trocaria "guarda desligada" por "imagem
  quebrada no WhatsApp do produtor".
- **19.** Alvos de toque e fontes. **CORRIGIDO**: piso de 44px no `.btn` (e não
  na variante grande — quem errava era a pequena) e nos links do rodapé; chips
  `.tag--data` com piso absoluto de 14px, porque eram eles que carregavam o
  conteúdo da demo.
- **20.** `FALLBACK_REPLY` não acionável. **CORRIGIDO**: diz o que fazer (texto
  curto ou áudio) e abre saída de urgência (procurar o agrônomo). O prefixo de
  30 chars que o canário casa não mudou, então as linhas antigas seguem
  contando.

---

## O que está BOM — não gastar tempo

**Segurança está sólida.** Zero segredo hardcoded, histórico do git limpo
(verificado blob a blob), assinatura dos dois transportes com `timingSafeEqual` e
fail-closed, cobertura de auth sem buraco em todos os handlers, **27 tabelas com
RLS habilitada e 0 policies** (negação total para anon), zero injeção SQL, zero
XSS no painel e nos cards, e prompt injection limitada por construção — a saída
do router é allow-list e a da Vitória é tipo coagido, não string.

**A honestidade sobre incerteza nas respostas** é o melhor ativo do produto, e é
estrutural: `reason.ts:230` força confiança para `media` quando o modelo devolve
lixo, e desvia para fallback quando é baixa. O handoff vira serviço
(*"quer que eu anote pra levar pronto pro agrônomo?"*), não aviso jurídico.

**A Vitória não inventa nada.** Cada afirmação do prompt foi conferida contra o
código; preço e prazo são barrados por gate, não por instrução; a disclosure de
IA é sofisticada.

**As 6 outras tabelas de retenção realmente podam** (conferido contra o schema
vivo), e `tests/retencao.test.ts` fixa cada coluna contra as migrations.

**`/verificar` é a melhor página do produto** — explica com honestidade o número
+1 e diz sem rodeio que a Stevi é robô e não receita defensivo.

---

## Ordem recomendada

1. **#4** — parar de mentir ao titular. Ou apaga `prospects`, ou muda o texto.
2. **#5** — opt-out por áudio: mover a checagem para depois da transcrição.
3. **#1 + #2** — catch de topo no `handleInbound` e try/catch no
   `applyProspectStatuses` (três linhas; o arquivo já ensina como).
4. **#7** — timeouts no `cloud.ts`. Destrava #8 e #15 junto.
5. **#3** — guard de eco no lado do produtor. Corta 95% do volume e limpa a
   métrica.
6. **#10** — uma linha no `app.js`.

Os itens 1-4 são risco de produto ou legal. O 5 é custo e qualidade de dado. O 6
é barato demais para não fazer.

## Nota de método

O gargalo medido da Vitória **não é a conversa**: 41 empresas alcançadas
produziram 5 frases humanas (2,4% de resposta), e o único humano que respondeu
estava fora do ICP. Os gates de repetição e despedida foram calibrados contra 125
turnos **sintéticos**. Continuar afinando o turno 2 é otimizar um evento que quase
nunca acontece — o problema é conseguir o turno 1.
