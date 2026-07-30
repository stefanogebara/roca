# Lessons

Append-only log of mistakes and the rules that prevent them. Newest first.

## 2026-07-26 — Infra compartilhada: enumere os CONSUMIDORES antes de opinar sobre remover

**Context:** achei um segundo app (Kapso) subscrito na WABA do Stevi recebendo
cópia de todos os webhooks dos produtores. Levantei como risco de privacidade e
disse ao fundador: *"pelo que vi no código do Stevi, nada aponta para o Kapso,
então o risco de remover é baixo"*. Ele autorizou a remoção. Antes de executar,
o print do painel mostrou que **a WABA se chama "TwinMe"** — é compartilhada
entre dois produtos. Consultei o banco do TwinMe: **306 envios via `kapso`, o
mais recente naquele mesmo dia.** Remover teria derrubado o WhatsApp do TwinMe,
num projeto onde eu nem estava trabalhando e sem eu saber que quebrei.

**What went wrong:** eu verifiquei o consumidor que estava na minha frente (o
repo do Stevi) e generalizei para um recurso que não pertence a ele. A pergunta
que respondi foi "o Stevi usa isso?"; a pergunta certa era "**quem** usa isso?".
Num recurso compartilhado, ausência de referência no meu código é evidência
sobre mim, não sobre o recurso. Detalhe agravante: o nome do recurso ("TwinMe")
gritava a resposta e eu só olhei o ID, que era o que eu procurava.

**Rules:**
- **Antes de afirmar que remover/alterar um recurso de infra é seguro,
  enumere os consumidores** — não pergunte "meu projeto usa?", pergunte "quem
  usa?". Recursos tipicamente compartilhados entre projetos do mesmo dono:
  WABA/número de WhatsApp, projeto Vercel, app Meta/OAuth, bucket, chave de
  API, banco, domínio.
- **Leia os NOMES dos recursos, não só os IDs.** Um ID confirma que você achou
  o objeto certo; o nome frequentemente revela de quem ele é. "TwinMe" numa
  conta que eu tratava como do Stevi era o aviso, e passou batido.
- Quando o dono autoriza uma remoção com base numa avaliação SUA, a avaliação
  passa a ser responsabilidade sua — **verifique antes de executar, mesmo já
  autorizado**. Autorização não transfere a checagem.
- Mesma família do erro do `DELETE /subscribed_apps` no mesmo dia: destrutivo
  sem enumerar o que depende. Custo aqui seria maior (outro produto, sem
  reversão óbvia, sem eu perceber).

## 2026-07-26 — Contexto de conversa precisa de janela de TEMPO, não só de contagem

**Context:** primeiro teste real do número BR. Mandei "oi" e a Stevi respondeu
"E aí, sabe me dizer se essa área do NDVI baixo é o café, o milho ou o
eucalipto?" — retomando uma thread de **11 dias antes** como se fosse a
mensagem seguinte. `getRecentTurns` buscava as últimas 6 mensagens ordenadas
por data, sem NENHUM filtro de idade.

**What went wrong:** "recente" foi implementado como *contagem* ("as últimas
6") quando o conceito é *sessão* ("o que ainda é a mesma conversa"). Num
produto de baixa frequência — o produtor fala quando tem problema, não todo dia
— as últimas 6 mensagens podem ser de semanas atrás. Efeito colateral pior: o
caminho de saudação já existia com a guarda certa (`intent === 'smalltalk' &&
!deps.history`), mas nunca disparava, porque o histórico velho fazia
`history` estar sempre presente. Uma proteção correta neutralizada por um dado
mal filtrado.

**Rules:**
- **Toda leitura de histórico conversacional filtra por idade além de
  quantidade.** Janela adotada: 48h (cobre "voltei no dia seguinte", corta a
  sessão morta). Row sem timestamp não é presumida fresca.
- Ao herdar estado de uma interação anterior (`awaiting`, histórico, carrinho,
  rascunho), pergunte: **quanto tempo esse estado continua verdadeiro?** Se não
  há resposta, ele precisa de expiração — não de mais um campo.
- **Guarda condicionada a um dado ("se não tem histórico, faça X") só funciona
  se o dado for correto.** Ao ver uma proteção que "existe mas nunca dispara",
  suspeite da fonte antes de reescrever a proteção.
- Testar isso exigiu extrair a seleção como função pura (`selectRecentTurns`)
  com `now` injetado — regra geral: lógica que depende de tempo só é testável
  se o tempo for parâmetro.

## 2026-07-26 — DELETE em API de terceiro: confirme QUAL objeto o endpoint afeta, não qual você quis afetar

**Context:** pedido para remover a subscrição do app "Kapso" do WABA (ele
recebia cópia de todas as mensagens dos produtores). Tentei
`DELETE /{WABA}/subscribed_apps?app_id=<KAPSO>`. A Meta respondeu
`{"success": true}` — e removeu o app do **token** (Stevi Agro), não o Kapso.
Resultado: o webhook do produto parou de receber mensagens até eu re-subscrever
(~30s de janela). Peguei porque a verificação seguinte listou `Kapso` sozinho.

**What went wrong:** o endpoint remove *o app dono do token* e **ignora
silenciosamente** o `app_id`. Eu presumi semântica de "remover o objeto que eu
nomeei" e li o `success: true` como confirmação do que eu queria, não do que a
API fez. Um parâmetro ignorado sem erro é pior que um erro — a resposta parece
sucesso.

**Rules:**
- **Antes de qualquer DELETE numa API de terceiro, responda: qual objeto ESTE
  endpoint remove?** Se a documentação não deixa explícito que ele aceita o
  alvo como parâmetro, presuma que o alvo é implícito (o dono do token / o
  recurso do path) — e que seu parâmetro será ignorado.
- **`success: true` confirma que a chamada rodou, não que ela fez o que você
  queria.** Toda mutação destrutiva é seguida de um GET que verifica o estado
  esperado, na mesma execução — foi só isso que evitou um outage silencioso.
- Em operação com efeito em produção, tenha o comando de reversão pronto
  ANTES de disparar o destrutivo (aqui: `POST /{WABA}/subscribed_apps`). Trinta
  segundos de indisponibilidade foram sorte de volume baixo, não competência.
- Se a única via de remoção é o painel (caso do Kapso: exige token do próprio
  app ou Business Settings), **pare e diga isso** em vez de procurar um jeito
  criativo pela API.

## 2026-07-26 — A rede é parte do contrato: retry vai onde o custo de desistir é externo, não onde é conveniente

**Context:** `scripts/otp-capture.mjs` pede à Meta que ligue para o número BR,
espera a Twilio gravar/transcrever a chamada e extrai o código de 6 dígitos.
Um único `UND_ERR_CONNECT_TIMEOUT` (deadline de 10s do undici, sem retry)
escapou do loop de poll e matou o processo — **depois** de a Meta já ter
ligado. O código existia numa gravação que ninguém leu; a chamada foi
recuperada na mão consultando a Twilio por fora, e o cooldown da Meta queimou
à toa.

**What went wrong:** o script tratava toda chamada de rede como igual. Mas o
custo de desistir muda radicalmente ao longo do fluxo: ANTES da ligação, uma
falha de rede não consome nada externo (dá para tentar de novo em 2 min);
DEPOIS da ligação, o recurso escasso (o cooldown, e um código com validade de
minutos) já foi gasto — ali desistir é jogar fora o que já se pagou. Retry
uniforme, ou nenhum, ignora essa assimetria. Bônus: `request_code` é o único
lugar onde retry seria ATIVAMENTE nocivo (dispararia uma segunda ligação).

**Adendo (mesmo dia, 30 min depois):** o script ad-hoc que escrevi para
CONFERIR o resultado da correção morreu com o mesmo
`UND_ERR_CONNECT_TIMEOUT` — porque eu não usei o helper que acabara de criar.
Reescrito com `fetchJsonWithRetry`, aguentou 3 timeouts seguidos e entregou o
dado. Regra: **script descartável que fala com API externa usa o mesmo helper
do script "de verdade"** — a rede não sabe que o seu script é temporário.

**Adendo 2 — versão da Graph API não é detalhe:** o `POST /register` do número
BR falhava com "(#200) does not exist / missing permissions" na `v21.0` (o
padrão do repo) e funcionou de primeira na `v23.0`, com o MESMO token e os
mesmos escopos. Erro de permissão da Meta pode ser, na verdade, endpoint não
suportado naquela versão. **Antes de concluir "falta permissão", teste a
versão mais nova** — e desconfie de mensagem de erro genérica da Graph API.

**Rules:**
- **Antes de escrever retry, pergunte por chamada: "se eu desistir aqui, o que
  já foi consumido e não volta?"** Recurso externo já gasto (chamada feita,
  cobrança lançada, cooldown iniciado, token de uso único emitido) ⇒ a partir
  daquele ponto, falha de transporte custa uma iteração, nunca a execução:
  `try/catch` por iteração dentro do loop, não no topo.
- **Onde o retry duplicaria um efeito externo, fixe `attempts: 1` com
  comentário** dizendo por quê. Retry não é virtude por si; num `request_code`,
  `charge`, ou `send`, é um bug.
- Timeout explícito em TODO fetch: o default de 10s do undici é curto para
  APIs de terceiros em rede ruim. Erro de rede deve nomear a causa
  (`ENOTFOUND`, `UND_ERR_CONNECT_TIMEOUT`) — leia `err.cause.code` **e**
  `err.code`; ler só um dos dois transforma o diagnóstico num "Error" inútil
  (foi o bug que os próprios testes desta correção pegaram).
- **Teste com a falha injetada, não com o caminho feliz.** Rodar o fluxo bom
  não passa perto do código de retry: ele só acorda quando a rede quebra. Se o
  teste não consegue falhar, não prova nada. Um harness com fetch injetado
  (`fetchImpl`/`sleepImpl`) verifica em milissegundos o que só apareceria numa
  madrugada com rede ruim.
- Script operacional que consome recurso externo escasso merece o mesmo rigor
  de teste que código de produção — o prejuízo de um bug ali é medido em horas
  de cooldown e tentativas humanas, não em pixels.

## 2026-07-25 — Fresh queries are not enough: verify WHO the rows belong to before building strategy on them

**Context:** The 25/jul audit + roadmap + traction baseline all treated "5
referral_requests, soja/milho, SP/MT" as the company's only observed organic
demand, and derived strategy from it (recruit an SP/MT agronomist; "demand was
discarded"). A same-day identity join (`referral_requests → users`) showed all
5 came from the test simulator (1) and the founder himself (4). Deeper still:
of 10 "users", 6 are the simulator, 2 are the founders, 1 is a WhatsApp system
number — the product has had exactly ONE real external user (vouched by
Michel, 1 message, never returned). The 17/jul lesson ("query fresh, don't
trust compaction") was followed — and was still insufficient, because the
fresh query aggregated without identifying.

**Rules:**
- **Any metric used for a strategic claim must be decomposed by identity
  first**: join to `users`/source, separate founder/test/simulator rows from
  real ones. An aggregate over a small table is an anecdote, not a metric.
- Seed test data with an unmistakable marker (name='Simulador', `is_test`
  flag, reserved number range) and **filter it in every ops/metric query by
  default**. Add the flag before the next campaign, not after.
- When n is this small, skip aggregates entirely: read the actual rows. 10
  users is a page, not a dataset.
- The compounding failure mode: each verification layer (compaction → fresh
  query → identity) catches the previous layer's error. Stop at the layer
  that names WHO, not just HOW MANY.

## 2026-07-17 — Facts inherited through compaction are hearsay; verify against prod before any outbound promise

**Context:** The "4 leads parados esperando o Michel" narrative rode through
session summaries into the partner one-pager and then into WhatsApp messages
SENT to partner #1 ("4 produtores de café da tua região te esperando").
A later DB check showed the truth: 5 referral_requests, ALL in SP/MT
(soja/milho), partner_id null — zero ever matched or notified to Michel. The
promise was false; it cost a public walk-back to the first partner (recovered
by converting it into the carteira-invite ask).

**What went wrong:** a stateful claim ("X is waiting in the system") was
carried across compaction like a fact and re-used in an outbound message
without re-verification. Summaries preserve *narrative*, not *state* — state
drifts, and summarization can also distort it.

**Rules:**
- **Before ANY outbound promise that asserts system state** (leads waiting,
  data published, counts, statuses — in a message, page, or template), query
  the system of record FRESH in the same session. The DB is truth; a
  compaction summary is hearsay.
- Symmetric check when the claim involves a matcher/filter: verify the rows
  are actually LINKED (partner_id/status), not just that rows exist.
- If a false claim already shipped: correct it to the human FAST, before
  their next action can collide with reality — and convert the correction
  into the honest next step rather than a bare apology.
- Bonus tell that was missed: the lead-SLA never paged. A monitor's silence
  is itself evidence about state — reconcile "why hasn't X fired?" against
  the narrative before trusting it.

## 2026-07-16 — A timed-out `git push` may have LANDED; probe with ls-remote before retrying

**Context:** Pushing two commits during a network flap. `git push` hit the tool
timeout twice (exit 143 at 2min and 90s) while `git ls-remote` answered fine.
Third attempt — backgrounded, generous timeout, self-verifying — landed.

**What almost went wrong:** a killed push is only killed *locally* — the objects
may already be uploaded and the ref updated server-side. Blindly re-pushing is
usually harmless, but blindly *assuming failure* leads to wrong reports ("not
pushed") or, worse, panic re-work; and hammering retries at a 2-minute wall just
burns turns without ever learning whether the network or the push is the problem.

**Rules:**
- **After any timed-out push, check state before acting:**
  `git ls-remote origin master` vs `git log -1 --format=%H`. Same SHA → the push
  landed, you're done. Different → retry is safe (pushes are idempotent).
- `ls-remote` doubles as a **cheap network probe**: reads answering while pushes
  hang = upload-path degradation, worth retrying; ls-remote also dead = network
  down, stop and say so.
- **Make the retry self-verifying and background it** with a generous timeout, so
  even if the foreground would have timed out you still learn the outcome:
  `git push origin master 2>&1 | tail -3; echo "EXIT=$?"; git ls-remote origin master | cut -c1-8`
- Two strikes → stop hammering. Report honestly: commits are safe locally,
  nothing is at risk while unpushed, they ride the next successful push (or the
  user's own terminal). A push is never worth a retry loop.

**Context:** Committing my location-decoupling work in a worktree shared with the
active caderno session. I staged explicit paths (`git add <my files>`, per the
"never sweep" rule) — yet the commit still shipped 3 of the *other* session's
files (`api/report.ts`, `api/_lib/report/pdf.ts`, `tests/application-pdf.test.ts`),
because they were already **staged in the index** by that session. Caught it only
because the commit output listed unexpected `create mode` lines.

**What went wrong:** `git add <paths>` is *additive* — it doesn't clear the index
— and `git commit` ships the **entire index**, not just what I added. Explicit
staging guards what you ADD, not what another session already left staged.
Separately: a grep had earlier shown my `pipeline.ts` wiring "gone" (the caderno
session re-edited from a pre-my-changes base); I flagged it and held. When later
told to re-apply, the file was **already reconciled** — blindly re-adding the
branches would have duplicated and broken it.

**Rules:**
- **`git diff --cached --name-only` immediately before EVERY commit** — confirm
  the staged set is EXACTLY your files. `git status --short` (working tree) is
  NOT enough: the commit ships the *index*, and a concurrent session can pre-stage
  into it. (This sharpens the CLAUDE.md "status before every commit" rule.)
- Polluted commit → **`git reset HEAD~1`** (mixed: un-commits AND unstages,
  working tree preserved), re-stage explicitly, re-verify `--cached`, re-commit.
  Non-destructive.
- A shared file that looks like it lost your work may already be reconciled —
  **read it before re-applying**, never re-add wiring blind. Don't edit-war;
  surface the collision and reconcile only when the other session is confirmed
  parked.
- Entangled files (both sessions edited the same regions) can't be split by file
  without interactive `git add -p` (unavailable to the agent) — ship the features
  together or coordinate the sessions.
- Shared local repo → another session's commits land in your HEAD immediately;
  HEAD can move between your own commits (saw an empty redeploy commit and a
  lessons.md commit appear). Re-check `git log -1` before assuming your parent.

## 2026-07-15 — Surgical partial-commits must match import *paths*, not just symbols

**Context:** Committing the caderno-de-aplicacoes feature whose changes were
interleaved, in shared files (`pipeline.ts`, `db.ts`), with a concurrent session's
location-decoupling refactor. Staged only my hunks via `git apply --cached` + an awk
hunk filter, guarded by a contamination grep.

**What went wrong:** the contamination grep searched for the *other* feature's
identifier symbols (`ungeocodable`, `LocationPrecision`, `geocod`, `statedLocation`)
but not the bare `import ... from './location'` line. That import sat in the same hunk
as my own import additions, got swept into the Phase 0 commit (`b1274d3`), and left
HEAD importing a module that was not committed -> **the commit did not build.** Caught
only later via an isolated `git worktree` typecheck; the next commit removed it.

**Rules:**
- When surgically staging hunks out of a shared file, the contamination check MUST
  include **import specifiers/paths and references to files the commit does not add**,
  not only identifier symbols. Grep the *staged* diff for `from './`, `require(`, and
  any symbol the commit itself does not define.
- **Verify every partial commit builds in isolation** before moving on — a green
  working tree != a green commit when the tree has extra uncommitted files the commit
  references:
  `git worktree add /tmp/verify <sha> && ln -s "$PWD/node_modules" /tmp/verify/ && (cd /tmp/verify && npx tsc --noEmit)`
- Prefer **reconstruct-from-HEAD** over hunk-filtering for a badly entangled file:
  `git show HEAD:path > path`, re-apply only your own edits, stage, then restore the
  full worktree from a backup. Deterministic — no foreign hunk can slip in.

## 2026-07-15 — Concurrent sessions share one working tree; back up before racing git

**Context:** A parallel session ran `add -A` / commit / reset cycles on `master` while
I was mid-commit. It unstaged my staged changes, and briefly created then reset a commit
that bundled my files with theirs. Nothing was lost — but it was luck-adjacent.

**Rules:**
- In a shared worktree with another active agent, treat uncommitted work as **volatile**.
  Before any risky git operation, back up artifacts (untracked files + `git diff`
  patches) to `/tmp`; a concurrent `git reset --hard` / `git clean` would otherwise wipe
  unstaged changes.
- **Don't fight a concurrent committer.** If commit boundaries scramble (a commit appears
  then vanishes, staged changes get unstaged), stop, snapshot, and surface — don't keep
  issuing git writes into a moving target.

---

## Lição — Não confunda P(A|B) com P(B|A) antes de bloquear metade da base
**Data:** 27/jul/2026 · **Custo:** um filtro que teria matado 9 das 14 entregas que funcionavam

**O que aconteceu:** Analisando as falhas de disparo, vi que *todo* erro
`131026 Message undeliverable` tinha vindo de um telefone fixo, e nenhum de
celular. Concluí "fixo não tem WhatsApp" e implementei um filtro que bloqueava
toda linha fixa. A base é **71% fixo** — então "quase tudo veio de um fixo" era
o esperado por acaso, não sinal. Eu tinha medido P(fixo | falhou) e usado como
se fosse P(falhou | fixo).

Os números que eu não tinha olhado, e que levam 30 segundos:
- 9 das 14 entregas bem-sucedidas foram para fixos
- taxa de entrega: fixo 39%, celular 50%
- as falhas eram dominadas por `131042` (cobrança **nossa**), que atinge os dois

O site de uma das coops publica `wa.me` para o **próprio fixo** — WhatsApp
Business aceita linha fixa (verificação por chamada de voz).

**Regras:**
- Antes de bloquear uma classe inteira, meça a taxa **dentro** da classe, não a
  composição das falhas. Se a classe é maioria da base, ela será maioria de
  qualquer subconjunto — inclusive dos erros.
- Sempre pergunte: qual é a taxa de SUCESSO desta classe? Se eu tivesse
  perguntado isso, o filtro nunca teria sido escrito.
- Filtro de **evidência** (este número específico voltou 131026) > filtro de
  **classe** (números deste tipo costumam falhar). O primeiro é verificável e
  auto-corrige; o segundo é um preconceito codificado.
- Erro de plataforma que fala de NÓS (cobrança, limite, template) nunca pode
  condenar o destinatário — senão a base encolhe em silêncio por culpa nossa.

## Lição — Dois agentes de pesquisa discordando é o produto, não o problema
**Data:** 27/jul/2026

**O que aconteceu:** Três agentes buscaram WhatsApp de cooperativas. Onde as
buscas se sobrepuseram, o segundo agente derrubou dois achados do primeiro —
com evidência melhor: baixou a imagem do banner e provou que o "WhatsApp da
Minasul" era anúncio de trator Mahindra; removeu comentários HTML e provou que
o celular da Coopama estava **dentro de um comentário** (número morto,
substituído pelo fixo). Sem a sobreposição, teríamos mandado mensagem para um
número morto e para uma revenda de tratores.

Todos os três relataram a mesma armadilha independentemente: **resumos de busca
alucinam** um rótulo de "WhatsApp" em cima de um fixo, e diretórios
(econodata, listatudo) desenham um botão de WhatsApp sobre o telefone fixo da
ficha.

**Regras:**
- Em pesquisa de dados que vira ação (mandar mensagem, ligar, cobrar), planeje
  **sobreposição** entre agentes. O custo do agente redundante é menor que o de
  um dado errado que sai como mensagem.
- Exija do agente: a URL exata + o texto verbatim que ele viu. "Achei o
  WhatsApp da empresa X" sem citação é palpite.
- Instrua explicitamente contra as armadilhas conhecidas — inclua no prompt o
  que agentes anteriores erraram. Os três só escaparam porque o aviso foi passado
  adiante.
- Nunca deixe o agente completar dígito faltante (9º dígito, DDD ausente). Todos
  os três encontraram números truncados e todos os três acertaram em recusar.

## Lição — Snippet de busca não tem data; a fonte tem
**Data:** 27/jul/2026

**O que aconteceu:** Procurando o WhatsApp da Rede do Campo, o Google devolveu
um resultado com o número bem formatado, o endereço certo e o nome certo.
Parecia perfeito. Fui à fonte: era legenda de um post de **5 anos atrás**. A bio
atual daquele perfil só tem fixo. O número vivo estava em **outro** perfil da
mesma loja — e só apareceu ao expandir a bio (o "... more" do Instagram esconde
exatamente a linha do telefone).

No mesmo dia, a Agro União mostrou o inverso: o `wa.me` da própria bio deles
está quebrado (`553588240383`, 12 dígitos, faltando o 9), enquanto o número
correto está no TEXTO da bio, ao lado. Quem confiasse só no link erraria; quem
confiasse só no snippet erraria de outro jeito.

**Regras:**
- Snippet de busca é ponteiro, não evidência. Ele não carrega data e o motor
  não distingue "bio atual" de "post de 2021". **Sempre abra a fonte.**
- Em perfil social, **expanda a bio** antes de concluir que não há telefone. O
  truncamento corta justamente onde o telefone costuma estar.
- Quando link e texto discordam, prefira o que está **completo e bem formado**,
  e registre na fonte qual dos dois você usou e por quê. Não complete dígito de
  nenhum dos lados.
- Um dado com endereço e nome certos ainda pode estar velho. O que valida é a
  **fonte atual**, não a plausibilidade.

## Lição — Verde não é o mesmo que são: a suíte avisou e ninguém leu
**Data:** 29/jul/2026

**O que aconteceu:** Rodei a suíte depois do alerta de crédito: `806 passed`,
zero falha. Também dizia, três linhas abaixo, `Errors 4`. Quatro
`Unhandled Rejection: Missing required environment variable: SUPABASE_URL`, com
stack em `reasonFallback → handleInbound` — o caminho do webhook de produção.
Verifiquei com `git stash` e eram pré-existentes; isto é, a suíte vinha
reportando isso havia tempo, e o número que todo mundo olha (806/806) dizia que
estava tudo bem.

A causa era um `void insertTriageEvent(...)`: promise solta, sem catch. No Node
22 unhandled rejection encerra o processo por padrão, e no Fluid Compute a
instância é **reusada entre requisições concorrentes** — então uma gravação de
telemetria falhando pode derrubar a resposta de OUTRO produtor que estava em voo
na mesma instância. Um produtor pagaria com a própria resposta por um dado que
existe só pra nós.

O grep achou três `void` em `api/`. Um era meu, do commit anterior, no mesmo
dia — eu tinha posto try/catch interno, mas por sorte, não por regra.

**Regras:**
- **Leia a linha `Errors` do vitest, não só `Tests`.** Rejeição solta não conta
  como teste falhando. O relatório separa as duas coisas e o hábito olha uma só.
- **Todo disparo sem await passa por `fireAndForget(() => ..., escopo)`**
  (`api/_lib/fireAndForget.ts`). `grep "void " api/` deve voltar zero. A regra
  vale mais que o caso: um `void` novo é bug novo, mesmo que a função chamada
  trate os próprios erros hoje.
- **O helper recebe thunk, não promise.** `getDb()` lança na hora quando falta
  env; um catch que só olhasse a promise pronta não pegaria o throw de montagem.
  Foi exatamente assim que essas quatro nasceram.
- **Telemetria nunca pode matar a resposta.** Se o dado é só pra nós, a falha
  dele é log, não incidente do usuário.
- Contrato garantido em comentário não é contrato. `markRead` tinha
  "never throws by contract" escrito no call site e a interface não obrigava
  ninguém — a única implementação cumpria por coincidência. Garanta no código.

## Lição — Blindar contra erro solto pode trocar a quebra por silêncio

**Data:** 30/jul/2026

**O que aconteceu:** A lição acima termina dizendo "contrato garantido em
comentário não é contrato — garanta no código". Foi ao garantir no código que o
`markRead` quebrou. O commit que passou os três disparos sem await pelo
`fireAndForget` escreveu, no `api/webhook.ts`:

```ts
const markRead = adapter.markRead;              // perdeu o receptor
if (markRead) fireAndForget(() => markRead(msg.messageId), 'markRead');
```

O `void adapter.markRead(id)` de antes preservava o `this`. Extraído para
variável, não: `markRead` é método de protótipo e lê `this.inboundPhoneId`
**antes** do próprio try/catch, então `this` undefined vira `TypeError` — e o
helper engole como ruído de fundo. O contrato "never throws" passou a ser
cumprido pelo pior caminho possível: nunca lança porque nunca funciona.

O bug ficou ~10h em produção, no caminho real, e escapou por sorte: entre o
deploy (29/jul 22:18) e o fix (30/jul 08:21) não chegou UMA mensagem — último
usuário 29/jul 13:00, último inbound de prospect 11:10. Madrugada. A suíte seguia
815/815, 0 unhandled, e `webhook.test.ts` não tinha uma linha sobre `markRead`:
aquele call site estava descoberto.

E aqui está o erro que eu cometi **duas vezes** ao avaliar a gravidade, que é a
lição mais afiada deste episódio. Primeiro afirmei que produtores estavam sem
read receipt. Depois corrigi para "branch dormente, o transporte ativo é o
Twilio" — apoiado no README e na ausência de linhas de `markRead` nos logs.
Ambas erradas. O banco decidiu: `select channel, count(*) from users` devolve
**zero `twilio`** e sete `cloud`. Todo inbound entra pelo Cloud; o README ("Twilio
sandbox agora") está velho. E a ausência de log era ausência de TRÁFEGO, não de
execução.

**Terceira correção, no dia seguinte.** "Ausência de tráfego" também estava
errada. Não havia tráfego porque o `/api/webhook` respondia **500 em toda
requisição desde 29/jul 14:04** — `ERR_REQUIRE_ESM` no import do geotiff,
24h de outage que ninguém tinha visto (ver a lição seguinte). Ou seja: expliquei
o mesmo silêncio de três jeitos diferentes, todos plausíveis, todos errados,
até um disparo REAL contra produção mostrar o que era. Silêncio não tem uma
causa óbvia — ele tem a causa que você ainda não mediu.

O `markRead` corrigido só foi verificado em produção em 30/jul 11:12, quando o
webhook voltou: `[cloud] markRead failed 400 (cosmetic, ignored)` — o catch
INTERNO dele, prova de que o `this` sobreviveu (sem o bind seria
`[bg] ERROR markRead lançou na chamada … reading 'inboundPhoneId'`).

O `fireAndForget` fez o trabalho dele (a instância não caiu) e, no mesmo golpe,
esconder quem chama errado. Fail-soft protege o processo e cega o autor.

**Regras:**
- **Rotear uma chamada nova pelo fail-soft é mudança de comportamento, não
  blindagem.** Vai junto no mesmo commit um teste do call site — senão você não
  removeu a falha, promoveu ela a silenciosa.
- **Extrair método para variável perde o `this`.** Se for passar método adiante,
  `obj.metodo.bind(obj)` ou chame `obj.metodo(...)` dentro do thunk. Vale para
  qualquer callback, não só `fireAndForget`.
- **Prove que o teste discrimina: tire o fix e veja falhar.** Foi tirando o
  `bind` e vendo `Cannot read properties of undefined (reading
  'inboundPhoneId')` que a regressão ficou provada. Teste novo em código que já
  passa não vale nada até você vê-lo vermelho.
- **Não diagnostique com barulho concorrente.** Concluí que um teste de controle
  vazava rejeição para o listener do vitest; era contenção de CPU (`tsc` rodando
  junto com o `vitest`). Reproduza isolado ANTES de escrever a conclusão numa
  mensagem de commit — eu escrevi, e tive que corrigir depois.
- **Recorte de grep/sed não é o arquivo.** Quatro conclusões erradas neste
  episódio saíram do mesmo mecanismo: um `grep -oE "(WHATSAPP|META)_[A-Z_]+"`
  casou o SUFIXO de `TWILIO_WHATSAPP_FROM` e me fez inventar uma var
  `WHATSAPP_FROM` que não existe em lugar nenhum; e um `sed -n '25,50p'` cortou
  na linha 50, órfãou o comentário "fonte ÚNICA" da sua var na 52 e eu colei o
  comentário na var errada. Antes de afirmar que algo existe (ou não existe),
  abra as linhas em volta. Padrão de sufixo sem `\b` inventa símbolos.
- **Ausência de log em janela sem tráfego não é prova de caminho morto.** Zero
  linha de `markRead` em 24h parecia "branch dormente"; era madrugada. Antes de
  declarar código inerte, mostre que ele foi EXERCITADO e não reagiu — ou vá ao
  estado persistido, que não tem retenção de 1 dia. Foi `users.channel` que
  desempatou, não o log.
- **Doc de arquitetura não é evidência de runtime.** O README dizia "Twilio
  sandbox agora" e eu tratei como fato do presente; o banco diz Cloud em 100% do
  inbound. Para "o que está ativo agora", pergunte ao dado, não ao doc.
- **Premissa de minutos atrás expira.** Comecei a tarefa com o teste do
  `fireAndForget` untracked na árvore principal; no meio, uma sessão paralela
  commitou tudo no master e o arquivo virou rastreado. Ia apagar "a sobra" e
  teria quebrado o master. Reconfira `git log`/`status` antes de agir sobre um
  plano formado antes.

## Lição — 24h de produção fora, e o canário passou verde todo dia

**Data:** 30/jul/2026

**O que aconteceu:** Fui rodar o simulador de inbound pra verificar um detalhe
cosmético (o `markRead`) e descobri que o `/api/webhook` respondia **500 em toda
requisição havia 24 horas**: 162 de 193 nas últimas 24h.

```
Error [ERR_REQUIRE_ESM]: require() of ES Module quick-lru
from geotiff/dist-node/source/blockedsource.js
Node.js process exited with exit status: 1
```

`quick-lru@6` é ESM puro; o build CJS do geotiff faz `require()` nele. Entrou com
`a228b20` (29/jul 14:04, "ler o COG direto por range request"). A última linha em
`users` é de 29/jul 13:00 — bate na hora.

Três coisas conspiraram pra isso durar um dia:

1. **Passou em tudo localmente.** O Node 22 daqui implementa `require(esm)`
   desde a 22.12; o loader da Vercel (`/opt/rust/nodejs.js` no stack) não. Suíte
   verde, typecheck limpo, `require('geotiff')` funcionando no terminal — e a
   função morrendo em produção.
2. **A cadeia é estática.** `webhook → pipeline → farmcard → tools/ndvi → cog →
   geotiff`. Um recurso de satélite derrubou TODO o inbound, de produtor e de
   prospect, porque todos entram pelo mesmo endpoint.
3. **O canário não bate no webhook.** Ele checa modelo, template, qualidade de
   número e frescor do Agrofit — tudo menos o único endpoint que recebe
   mensagem. Rodou verde todo dia enquanto ninguém era atendido.

**Regras:**
- **O canário tem que exercitar o CAMINHO DO USUÁRIO, não as dependências dele.**
  Um POST assinado no `/api/webhook` teria gritado em minutos. A ferramenta agora
  existe: `scripts/simulate-inbound.mjs --cloud`.
- **Verde local não cobre diferença de runtime.** Onde o bundle/loader do
  provedor difere do Node local (require(esm), resolução de ESM, `exports`), o
  teste local é mudo por construção. Dependência nova que entra em caminho
  crítico pede uma requisição real contra o deploy, não só suíte verde.
- **Ausência de dado novo é sintoma, não calmaria.** Nenhuma linha em `users`
  desde 13:00 do dia anterior era o alarme — eu li como "pouco movimento". Se o
  fluxo normal parou, pergunte o que quebrou ANTES de inventar explicação
  benigna. Eu inventei três.
- **Import estático amarra o raio de explosão ao pior componente.** Se um recurso
  periférico (satélite) não pode derrubar o essencial (responder mensagem), ele
  não pode estar no import estático do caminho essencial.

## 2026-07-30 — O dia em que o instrumento quase mandou reverter trabalho bom (duas vezes)

O juiz pareado disse "reverta" de manhã (3×8) e de tarde (5×8). Nas duas vezes
a leitura dos transcripts mostrou outra coisa: rubrica com regra do domínio
errado ("prescrever dose" numa conversa de parceria), negação frágil que o
modelo invertia (punia a Vitória por SE APRESENTAR como IA — nossa regra zero),
e JSON truncado contado como "juiz falhou". Depois de consertar a rubrica, um
experimento de CONTROLE — mesmo código dos dois lados — deu "B 5 × 6 A →
reverta". Cinco controles depois: margens 0, 1, 1, 1, 2. O apurador declarava
vencedor com margem 1.

**Regras:**
- **Antes de obedecer um veredito automático, meça o ruído do instrumento.**
  Um controle (mesma coisa dos dois lados) custa uma rodada e diz se o placar
  significa algo. Margem dentro do ruído não é veredito, é moeda ao ar.
- **Piso conservador primeiro, calibragem depois.** Escolhi margem ≥3 com UMA
  amostra de controle; o quinto controle deu margem 2 — um piso "calibrado" em
  2 teria declarado reversão falsa em menos de duas horas. Com poucas amostras,
  o lado certo de errar é o conservador.
- **Rubrica de juiz: sem regras de outro domínio, sem negações em lista, e
  alegação de regra dura exige CITAÇÃO da transcrição.** Citação não impede o
  modelo de errar — torna o erro visível, porque a frase citada ou está lá ou
  não está.
- **Regra nova que alonga o output pede orçamento novo de tokens.** Exigi
  citação e não subi o maxTokens; o gate de parse converteu a rubrica melhor em
  cenários perdidos. E o mesmo conserto aplicado num juiz só (pareado, não
  absoluto) é meia-correção que volta a morder no mesmo dia.
- **Métrica-manchete precisa da incerteza COLADA nela, onde a decisão é
  tomada.** "Avanço limpo 29% → 42% → 57%" foi reportado como progresso; era
  ruído de uma métrica binária com denominador 11-14. Quatro rodadas idênticas:
  4-8/11. O aviso agora é impresso junto do número (terminal e painel).
- **Denominador só com quem PODE converter.** Três cenários onde parar é o
  comportamento correto contavam como fracasso de avanço (teto real ~79%). E
  conversão de funil é sobre quem PASSOU pelo estágio: contar só quem está
  parado nele faz cada promoção "melhorar" a taxa esvaziando o denominador.
- **Placar que decide coisa não pode morrer no terminal.** O pareado decidia
  promoção de prompt e não persistia; painel só mostrava o absoluto. Se um
  número muda decisão, ele vai pro banco e pra tela dos founders.
