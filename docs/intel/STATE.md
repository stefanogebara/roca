# Estado do repositório — Stevi (roca)

> Escrito pela primeira passada do `/intel` em 2026-08-24. Janela: 30 dias.
> HEAD `467ee137`, branch `master`, último commit **08/ago**.
> Reescrito a cada `/intel`. Fonte: o git, não o config.

## O parágrafo

**190 commits em 30 dias, zero conversas de produtor externo registradas.** O
tripwire do flight plan foi declarado disparado em três semanas consecutivas
(51×0 em 27/jul, 50×0 em 03/ago, 54×0 em 10/ago), e o memo de 10/ago escreve
que *"não é mais pico, é regime confirmado"*. O que se construiu no período foi
real e bem feito: agente de voz por ligação de ponta a ponta em quatro dias,
motor de sourcing de prospects, separação de identidade que finalmente torna a
tração mensurável, e confiabilidade sob prazo. Mas nenhum desses commits tocou
o loop proativo ao produtor — `api/_lib/alerts.ts` não aparece entre os 25
arquivos mais tocados, e `farmer_alerts` segue em zero na vida do produto. O
sinal novo, que nenhum memo interpretou, é o **silêncio de 16 dias**: o master
parou em 08/ago e não há memo de scorecard nem em 17/ago nem em 24/ago,
contrariando a rotina de segunda-feira. Restam **18 dias** até 11/set.

## O que shipou

- **Agente de voz por ligação (ElevenLabs), estudo a produção em 4 dias** —
  `c39e18b` (estudo com latência real), `40462c3` (integração completa),
  `37a7d9a` (turn_v3, barge-in, fillers), `dd64a84` (clone da voz da Vitória),
  `467ee13` (o desfecho da ligação nunca se perde). **É a Vitória prospectando
  empresa, não o produtor sendo atendido.**
- **Motor de sourcing e enriquecimento de prospects** — `7de1d78` ("atacar onde
  o funil morre"), `12b15ad` (lê bio-link, Instagram e Facebook, não só site),
  `cf1b76a` (rotação de cidades: a grade inteira nunca tinha sido varrida).
- **A tração vira mensurável** — `42e5e33` (`users.kind` + digest filtrado),
  `42ca4ce` (Simulador Roca vira `kind='teste'`), `a33a0c3` (**o bug do nono
  dígito** — a Meta devolve o remetente sem ele; era a causa raiz das 11
  empresas contaminando WAU/D7/caderno).
- **Confiabilidade sob prazo** — `dc79963` (todo fetch do transporte com
  prazo), `aaf4ea5` (prazo compartilhado fecha o caminho da foto nos 60s),
  `212adb1` ("a resposta ao produtor não pode depender de satélites").
- **Honestidade do conselho endurecida** — `9dbb1b9` (cultura fora de domínio
  para de sair com cara de diagnóstico firme), `0da1083` (mamão por texto sai
  honesto **e o goldenset passa a vigiar isso**).
- **Post-mortem do dispatch fechado** — a causa raiz era **billing** (#131042),
  não limite de engajamento da Meta.

## O que está em voo

- **PR #4 — `claude/pm-scorecard-memo-10-ago`, DRAFT desde 10/ago.** A leitura
  de scorecard mais recente que existe **não está no master**.
- **`claude/xenodochial-moore-9dc540` — 76 commits à frente, sem PR jamais
  aberto.** Carrega `a642bb9` (a poda de `farmer_alerts` que nunca rodou),
  `dfb9dbe` (o alarme da empresa estava morto), `4f77bfa` (o vigia não pode
  cair junto com o vigiado). O memo de 10/ago classifica como *"achado crítico
  de infraestrutura"* e registra que não tentou mesclar por ser decisão de
  engenharia. **Existe código de confiabilidade escrito e não deployado.**
- **Decisões de founder paradas ≥16 dias:** CNPJ; acordo escrito e assinatura
  dos 36 casos golden com o Michel; envs `FOUNDER_NOTIFY_TO` e
  `WHATSAPP_TEMPLATE_ALERT` na Vercel ("não medido"); follow-up humano no Gaia
  Tech.

## O que morreu

- **Bump D+3 na prospecção** (`b8b05fa`) — 23 envios, zero humanos.
- **Bloqueio de telefone fixo** (`f6c00f1`) — nascido e revertido no mesmo dia:
  9 das 14 entregas bem-sucedidas da história eram para fixo.
- **Titiler** (`70bc1a5`) — removido por completo.
- **LiveKit** (`ef5e41c`) — avaliado e **adiado**, "ortogonal à naturalidade".
- **Cold call por IA** (`ea6cdc0`) — decidido fora.
- **"Recrutar agrônomo SP/MT para as 5 referrals"** (`33e8e57`) — morto quando
  se descobriu que as 5 eram teste dos próprios founders.

> **Trava de estado:** item que proponha bump automático de cadência, cold call
> por IA, bloqueio de fixo ou LiveKit perde o eixo Alavanca. Foram testados ou
> avaliados e recusados aqui, com motivo escrito.

## Áreas quentes

`tasks/lessons.md` (21) · `api/_lib/prospect/agent.ts` (19) ·
`api/_lib/pipeline.ts` (19) · `web/painel.html` (12) ·
`tests/prospect-agent.test.ts` (12) · `api/_lib/prospect/inbound.ts` (11) ·
`api/_lib/prospect/gym.ts` (11) · `api/_lib/prospect/dispatch.ts` (10).

Nove dos 25 arquivos mais tocados são `api/_lib/prospect/*` ou seus testes.
**`api/_lib/alerts.ts` — o loop que a `bets[1]` diz valer mais que tudo — não
aparece na lista.**

## Estado do tripwire

| Lado | Número |
|---|---|
| Commits nos últimos 30 dias | **190** |
| Commits nos últimos 7 dias | **0** (master parado em 08/ago) |
| Conversas com produtor externo registradas | **0**, em três medições |
| Externos reais na vida do produto | **1** (Gaia Tech, 1 msg, 17/jul) |
| `farmer_alerts` | **2 linhas** — medido em 24/08, não zero (ver abaixo) |
| Alvos reais do loop proativo | **1** produtor com pin · **1** produtor com soja (SP) |
| Dias restantes até 11/set | **18** |

O silêncio de 16 dias tem duas leituras — founder em campo (o que os três memos
pediram como prioridade 1) ou campanha parada — e **não são distinguíveis a
partir deste repositório**: a evidência de conversa vive no banco de produção e
no WhatsApp pessoal. Registrado como **não medido**, conforme o guard-rail da
casa.

## Divergências com o config

Nenhuma foi aplicada sozinha. `bets` e `settled` só o Stefano mexe.

1. **`settled[2]` — "métrica sempre reportada em duas colunas: total e externos
   reais" — ESTÁ SENDO VIOLADO PELO CÓDIGO.** A regra vale nos memos escritos
   por agente e **não vale em nenhuma superfície automatizada do produto**.
   - `api/_lib/digest.ts:76-90` busca `users` com `.neq('kind','produtor')`,
     monta um `Set` de `empresaIds` e aplica `soProdutor()` a **todas** as
     linhas. O comentário admite: *"Filtra AQUI, num ponto só, porque tudo
     abaixo deriva de `rows`"*.
   - `api/_lib/digest.ts:253` `formatDigest()` — a linha que os founders leem no
     WhatsApp é `👥 {inboundTotal} mensagens de {uniqueUsers} produtor(es)`.
     **Um número por métrica.** A interface `DigestStats` não tem um único campo
     `*Total` versus `*Externo` — o dado para exibir duas colunas **não
     existe**, mesmo que se quisesse.
   - `web/painel.html:310` — `['Msgs recebidas', d.inbound, '', 'Tudo que
     produtores já mandaram pra Stevi']`. Coluna única, e o tooltip afirma
     "produtores" sobre um número que não distingue.

   Este `settled` existe **exatamente porque** a decomposição por identidade
   salvou o repo duas vezes: as "5 referrals orgânicas" que eram teste do
   próprio Stefano (25/jul) e os "8 novos usuários" que eram bots de
   atendimento de revenda (03/ago). Nos dois casos a leitura errada veio de uma
   superfície de coluna única e foi corrigida à mão, depois. O commit
   `42e5e33` implementou **esconder** quando o `settled` pedia **mostrar os
   dois** — e esconder é mais frágil que a regra: qualquer `kind` novo some em
   silêncio, e o founder nunca vê o denominador que ele mesmo pré-comprometeu a
   olhar.

   **Decisão pendente do Stefano:** corrigir `digest.ts` e `painel.html` para
   duas colunas é a coisa mais barata desta lista e a mais alinhada ao
   scorecard — mas é código, e o tripwire diz que o conserto nunca é mais
   código. Sua chamada.

2. **`bets[1]` — "notificação proativa vale mais que resposta sob demanda" —
   contradita pelo comportamento, corroborada pela intenção.** Os três loops
   proativos estão construídos, testados e agendados (`api/_lib/alerts.ts` +
   cron diário às 11h em `vercel.json`). Mas nos 190 commits do período,
   **nenhum** foi para o loop proativo ao produtor. `farmer_alerts` = 0 não é
   código morto: é ausência de produtor com pin (3 farms, nenhuma externa
   ativa) somada ao canal de template bloqueado por billing e a uma env não
   confirmada. *`known_gaps[1]` reformulado com essa causa real.*

3. **`stack` dizia "WhatsApp Business API" como se fosse um transporte; são
   dois.** Meta Cloud API é o ativo, Twilio é legado mantido como rollback e
   captador do OTP de voz. E faltava **ElevenLabs** — o maior tema de
   engenharia do mês inteiro. *Corrigido.*

4. **INMET e NASA POWER estavam em `focus_areas` e `platform_deps` e não estão
   integrados.** NASA POWER: zero ocorrências no repo. INMET: as duas únicas
   ocorrências são texto de mensagem em `api/_lib/alerts.ts` — a Stevi manda o
   produtor conferir no INMET, não consome API do INMET. Quem faz clima é
   **Open-Meteo**; solo é SoilGrids; NDVI é Sentinel-2 via Earth Search.
   *Corrigido, com nota na `verdict_note`.*

5. **Correção da própria primeira passada — a env `WHATSAPP_TEMPLATE_ALERT` não é o
   bloqueio.** Escrevi acima, seguindo o memo de 10/ago, que ela estava "não medida" há
   16 dias. O repositório contradiz:
   `.claude/plans/2026-07-30-virada-cloud-api/README.md:81` registra
   `[x] ~~Janela de 24h~~ — WHATSAPP_TEMPLATE_ALERT está setado na Vercel (Preview +
   Production, conferido em vercel env ls)`. O template `stevi_alerta_v1` está no registry
   (`api/_lib/prospect/template.ts`) com 1 param de corpo, `cloud.sendTemplate` monta
   exatamente 1 param, e `api/_lib/canary.ts` já vigia a forma dele. **O bloqueio residual
   do loop proativo é billing, não configuração.** O memo estava desatualizado, e o config
   foi corrigido.

6. **Três defeitos pequenos e reais no caminho do alerta, achados ao aterrar um item:**
   - `listSojaFarmersByUf` (`api/_lib/db.ts:777-794`) **não filtra `users.kind`**. A partir
     de **30/08** o `upcomingTransitions(now, 7)` põe o vazio de MT na janela e o cron das
     11h tenta disparar. Se o único candidato for fazenda de teste, o primeiro número
     não-zero de `farmer_alerts` — a métrica que o scorecard mede — nasce contaminado.
     **Isso tem prazo: seis dias.**
   - `api/_lib/tools/calendar.ts` cobre **17 das 22 UFs** da portaria. Faltam PA, RR, AL,
     AP e CE. O PA é o único com peso real em soja (vazio 15/06→15/09/2026) e cairia dentro
     do voo; hoje um produtor do PA recebe `vazioStatus()` devolvendo
     `{known:false, line:null}` — silêncio, não erro.
   - `alertDedupKey` é `${kind}:${uf}:${date}` com a data ISO completa. Como a portaria muda
     as datas todo ano, o reenvio anual funciona — **por acidente**. Se uma portaria futura
     repetir a data exata da mesma UF, o alerta some em silêncio; não há `season` na chave.

7. **`known_gaps[2]` estava desatualizado.** A fonte de verdade agronômica
   existe e é usada no prompt. O buraco é a **assinatura**: os 37 casos de
   `knowledge/goldenset/goldenset.jsonl` têm `verified_by: null`. O campo já
   existe — é o slot exato onde a assinatura do agrônomo entra. *Reformulado.*

## Medição de 24/08 — o que o banco diz, e onde o registro estava errado

Consulta somente-leitura no projeto `ruuflfeqcmxpziernaop`, sem PII.

**`farmer_alerts` não está em zero.** Tem **2 linhas**, ambas `fire`, ambas de
**2026-08-14 11:00 UTC** — o cron diário —, ambas para users com `kind = 'teste'`
em MT. O loop proativo **já disparou**. O que nunca aconteceu foi disparar para
produtor real.

Os três memos de scorecard dizem zero porque **o último é de 10/08 e ninguém
mediu depois**. Eu repeti o número deles no `known_gaps`, no config e no corpo do
PR #7 sem medir. Corrigido nos três lugares.

**Consequência para o PR #7:** eu declarei ali que a mudança de formato da chave
de dedup não causaria reenvio, com a justificativa de que `farmer_alerts` estava
vazia. A justificativa era falsa; **a conclusão continua verdadeira**, e por
outro motivo — as duas linhas são `fire:2026-08-14`, e `fireDedupKey` não mudou.
Só `alertDedupKey` (vazio) ganhou safra, e não há nenhuma linha `vazio_*`.

**O denominador real, medido:**

| | |
|---|---|
| users | 29 — 19 `empresa`, 8 `teste`, **2 `produtor`** |
| farms com pin | 3 — **1 produtor**, 2 teste |
| farms com soja | 2 — **1 produtor (SP)**, 1 teste (MT) |

**Existe um alvo real, e ele tem data.** Um `produtor` em **SP**, canal `cloud`,
com pin, culturas `['soja','milho']`, criado em 08/07. Isso significa:
`listFarmsWithCoords` (geada e queimada) tem **1 alvo real**, e
`listSojaFarmersByUf('SP')` tem **1 alvo real**.

**O vazio de SP termina em 15/09**, então `upcomingTransitions(now, 7)` põe SP na
janela em **08/09** — dentro do voo, que fecha em 11/09. Seria o **primeiro
`farmer_alert` legítimo da vida do produto**.

**E é aí que está o defeito novo.** `buildVazioAlertText` **não hedgeia UF
regional**. Ele diria a esse produtor *"o vazio sanitário da soja em SP termina
em 7 dias"* — mas SP é `regional: true`, com três regiões e datas diferentes, e
15/09 é o fim da Região III, não necessariamente a dele. O caminho **reativo**
(`vazioStatus`) já resolve isso corretamente: para UF regional ele diz *"varia
por região... confirme a data exata da sua região"*. O caminho **proativo afirma
o que o reativo se recusa a afirmar**.

Não mexi nisso: mudar copy que vai para produtor real é decisão do Stefano, não
consequência de uma auditoria. Mas a data é 08/09 e o alvo é o único produtor
real que existe.

**O que a correção de 24/08 evitou, concretamente.** A única farm com soja em MT
é `kind = 'teste'`. Sem o filtro do PR #6, em 30/08 o cron teria mandado o alerta
de vazio de MT para uma fixture, e `farmer_alerts` ganharia sua primeira linha
`vazio_*` vinda de teste — contaminando o primeiro número não-zero da métrica que
o scorecard mede em 11/09. Com o filtro, MT devolve conjunto vazio.
