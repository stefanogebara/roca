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
**RELATADO** · `db.ts:868-879`

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
**RELATADO** · `reason.ts:235`

O modelo classifica `crop` como `"outro"` e o código converte para `null` —
indistinguível de "não deu pra ver". A resposta sai genérica, com a **mesma
embalagem de confiança** das culturas em que a Stevi é boa.

Foi o caso do mamão em 03/ago. O goldenset (36 casos) não tem um único caso fora
de domínio.

### 10. Página em branco se o `app.js` não chegar
**VERIFICADO** · `web/index.html:38` + `styles.css:492` + `index.html:575`

`.js` é setado síncrono no `<head>`; `.js .reveal { opacity: 0 }`; `app.js` é
`defer`. Se a conexão derrubar só o JS, **nada nunca reaparece** — 11.492px de
conteúdo invisível, e o CTA fica invisível mas clicável. Zero `<noscript>`.

É exatamente o modo de falha do público-alvo (2G/3G rural). Conserto de uma
linha: mover o `classList.add('js')` para dentro do `app.js` — se ele não chegar,
`.js` nunca é setado e a página renderiza inteira.

---

## MEDIUM

- **11.** `triage_events` com **0 linhas** (VERIFICADO). Só grava com praga
  identificada e confiança não-baixa — a triagem incerta, que é o dado de treino
  mais valioso, não deixa rastro. O moat descrito no comentário não existe.
- **12.** Gate de compliance não pega as unidades do produtor pequeno (RELATADO):
  `por litro`, `por bomba`, `%`, `meio litro`, `1 saca`, e **verbo + marca sem
  dose** (`"Aplique Priori Xtra"`), que é prescrição sob a Lei 14.785/2023.
  Disparou 0 vezes em 926 mensagens e não há tabela de eventos — não dá para
  saber se é bom comportamento ou gate cego.
- **13.** `agrofit.ts:44` lança na inicialização do módulo, dentro da cadeia
  estática do webhook (VERIFICADO). Mesma forma do outage de 29/jul. O vizinho
  `compliance.ts:80` carrega dado igual com a política oposta e correta.
- **14.** Guardas caras antes da guarda de idempotência (RELATADO):
  `guardDeletionRequest` e `guardPartnerReply` antes de `guardDuplicateInbound`
  — reentrega da Meta duplica dossiê ao parceiro e alerta aos founders.
- **15.** `alertFounders` é awaited no caminho da resposta, com WhatsApp primeiro
  e em série (RELATADO). Em `webhook.ts` o `ack()` só acontece depois dele.
- **16.** Opt-out sem verbatim (RELATADO): a mensagem do prospect nunca é gravada,
  e `reason` é string fixa. Para LGPD o que sustenta é a evidência do pedido.
- **17.** `OPTOUT_RE` larga demais (RELATADO): "não quero atrapalhar", "vou sair
  pro campo" viram bloqueio permanente, sem alerta e sem reversão.
- **18.** `verifyCardQuery` falha ABERTO sem segredo (RELATADO) — `cardSign.ts:49`
  devolve `true` se `REPORT_URL_SECRET` sumir. O irmão `reportToken.ts` falha
  fechado. Fusível de vidro.
- **19.** UI: tap targets abaixo de 44px (header 138×38, footer 343×34) e chips
  `.tag--data` a 10-11px — que carregam justamente o conteúdo da demo.
- **20.** `FALLBACK_REPLY` não é acionável ("manda de outro jeito" — qual?) nem
  tem escape de urgência. O repo já sabe escrever melhor: ver `PHOTO_RETRY_MSG`.

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
