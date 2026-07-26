# Lessons

Append-only log of mistakes and the rules that prevent them. Newest first.

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
