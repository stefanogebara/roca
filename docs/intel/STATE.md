# Estado do repositório — Stevi (roca)

> Escrito pela décima passada do `/intel` em 2026-11-23. Janela: desde
> 2026-09-07 (última passada mesclada em `master`) — nenhuma passada entre
> 16/11 e hoje foi mesclada, então o estado congelado continua o mesmo.
> HEAD `f5e4755`, branch `master`. Esta atualização roda em cima da PR #42
> (`intel/2026-11-16`), não abre uma PR nova — ver "Entrega" no corpo do PR.
> Reescrito a cada `/intel`. Fonte: o git, o GitHub e o
> `.claude/plans/memos-scorecard/README.md`, não o config.

## O parágrafo

**O achado mais importante desta rodada, de novo, não é de mercado — é que
esta rodada escolheu não piorar o próprio problema que a rodada anterior
identificou.** Nada mudou na engenharia ou no campo desde 16/11 (ver
Tripwire abaixo: 1 commit em 7 dias, e é o próprio memo semanal; zero
conversa de produtor). O que mudou é a decisão de processo: em vez de abrir
a décima quarta PR de `/intel` sem revisão, esta rodada **empilha o
incremento de hoje em cima da PR #42** (que já continha o trabalho de
16/11) e não cria uma nova. Isso segue a recomendação nº2 do próprio corpo
da PR #42: "mesclar uma PR de `/intel` (esta ou a #41) e fechar as outras
sete — todas são `docs/`, nenhuma conflita com produto." Continuam
existindo **treze PRs abertas, zero mescladas, zero fechadas** (doze da
leitura de 16/11 — nove rodadas de `/intel`, três memos do PM do Scorecard
— mais a própria #42, que esta rodada atualiza em vez de duplicar). Ver a
tabela abaixo.

## PRs de `/intel` e do PM do Scorecard nunca revisadas (checado agora via `gh api`, não só `git log`)

| PR | Conteúdo | Branch | Aberta em | Dias parada (hoje, 23/11) |
|---|---|---|---|---|
| #42 | intel — 41 itens (16/11), **esta rodada atualiza com o incremento de 23/11 em vez de abrir #43** | `intel/2026-11-16` | 2026-11-16 | 7 |
| #41 | intel — 26 itens, 7 DISCUTIR (Gemini, SoilGrids) | `intel/2026-11-09` | 2026-11-09 | 14 |
| #40 | intel — 45 itens, achado = 10 PRs sem revisão | `intel/2026-11-02` | 2026-11-02 | 21 |
| #39 | intel — 37 itens | `intel/2026-10-26` | 2026-10-26 | 28 |
| #38 | intel — 56 itens, voo fechado, 7ª rodada sem spike | `intel/2026-10-19` | 2026-10-19 | 35 |
| #37 | intel — 29 itens, "pipeline achou a si mesmo" | `intel/2026-10-12` | 2026-10-12 | 42 |
| #36 | intel — 36 itens, voo fechou MATAR/PIVOTAR | `intel/2026-10-05` | 2026-10-05 | 49 |
| #35 | intel — 43 itens | `intel/2026-09-28` | 2026-09-28 | 56 |
| #34 | intel — 34 itens, Sicoob racha premissa de app | `intel/2026-09-21` | 2026-09-21 | 63 |
| #33 | memo PM — semana de 21/set | `docs/memo-scorecard-2026-09-21` | 2026-09-21 | 63 |
| #32 | intel — 39 itens, fecha em MATAR/PIVOTAR | `intel/2026-09-14` | 2026-09-14 | 70 |
| #31 | memo PM — semana de 07/set (dia 57) | `claude/scorecard-memo-0907` | 2026-09-08 | 76 |
| #4 | memo PM — semana de 10/ago | `claude/pm-scorecard-memo-10-ago` | 2026-08-10 | 105 |

**Treze PRs abertas, zero mescladas, zero fechadas, zero comentadas** — o
mesmo total de 16/11, uma semana mais velho, e não quatorze porque esta
rodada deliberadamente não abriu uma nova. Nenhuma delas é código de
produto — nove rodadas de `/intel` e três memos do PM do Scorecard (o
quarto memo, de 23/11, foi direto pra `master` como as demais, não via PR),
todas puro `docs/`. Mesclar qualquer uma continua mecanicamente seguro.

## O que shipou (31/08–11/09 — antes do fechamento)

Sem mudança desde 16/11 — ver a versão anterior deste arquivo no histórico
do git. Não repito aqui porque nada mudou.

## O que está em voo

**Nada de produto.** A branch órfã de 76 commits (`claude/xenodochial-moore-9dc540`)
segue sem PR, sem mudança desde 07/09. As treze PRs da tabela acima são os
únicos branches "em voo", e nenhuma é código.

## O que morreu

Sem mudança — ver a leitura de 16/11: a campanha de validação de 60 dias
fechou em `a01212c` (12/09) com veredito MATAR/PIVOTAR qualitativo.

## Medição mais recente do banco (citada do memo de 23/11, não requerida de novo)

A leitura de hoje do `stevi-pm-scorecard`
(`.claude/plans/memos-scorecard/README.md`, "Semana de 23/nov — dia 133 de
60") já mediu o banco direto via Supabase MCP nesta mesma data — décima
primeira leitura pós-fechamento, décima vez pedindo (sem resposta) para
reduzir a cadência do próprio memo. Não há motivo para rodar as mesmas
queries de novo:

- `users` total: **30**, inalterado desde início de agosto — mais de 110
  dias sem usuário novo.
- Produtor externo real: **1** (Gaia Tech, vouchado pelo Michel) — **0
  mensagens novas em 129 dias**.
- `messages` nos últimos 14 dias: **0** — nenhum produtor, teste ou
  founder mandou qualquer coisa. Última mensagem inbound de toda a base:
  30/09 (**54 dias** de silêncio total).
- `farmer_alerts`: **2**, inalterado desde 14/08, ambas `kind='teste'`.
- Golden set: **0/38** casos com `verified_by` (não reconfirmado linha a
  linha nesta rodada — sem mudança de sinal desde a última leitura).
- Prospecção: **367** linhas, idêntico há 7+ semanas, disparo parado.
- **Achado do memo de 02/11, ainda sem confirmação:** `Corpal Tratores`
  (836 mensagens IN + 836 OUT em 4h15, 03/08 — assinatura de loop de eco
  automático) segue sem ninguém checar `quality_rating`/`messaging_limit_tier`
  no WhatsApp Manager daquele dia. Terceira semana consecutiva sinalizando
  o mesmo item parado.

## Estado do tripwire

| Lado | Número |
|---|---|
| Commits nos últimos 7 dias (`git log origin/master --since='7 days ago'`, medido agora) | **1** — `f5e4755`, o próprio memo do scorecard de 23/11. Zero commits de engenharia. |
| Conversas de produtor externo real nos últimos 7 dias (`produtores_conversados_7d`, medido no banco pelo memo de 23/11) | **0** |

**Leitura literal: 1 commit > 0 conversas → tripwire disparado.** **Leitura
pelo espírito da regra (engenharia real vs. campo, convenção usada desde
24/08): 0 commits de engenharia × 0 conversas → não disparado.** Registro
os dois, como em toda rodada desde o fechamento. Decimo primeira leitura
seguida com exatamente este padrão — o tripwire parou de ser a métrica que
importa; o que importa é que ninguém decidiu ainda o que fazer com o
veredito MATAR/PIVOTAR entregue há 73 dias.

## Divergências com o config

Nenhuma foi aplicada sozinha nesta rodada — nada novo e inequívoco no git
que justifique adicionar a `settled`.

1. **A `verdict_note` continua desatualizada** (apontado desde 26/10, por
   quatro rodadas não mescladas agora). Ela descreve um voo em andamento
   ("restam 8 dias até 11/set/2026") que fechou há 73 dias. Precisa de uma
   reescrita do Stefano dizendo o que vale depois de um MATAR/PIVOTAR —
   recomeçar, pivotar ou arquivar.
2. **O pedido de reduzir a cadência do memo do PM do Scorecard** está
   parado há 70 dias e dez pedidos consecutivos (ver
   `.claude/plans/memos-scorecard/README.md`, link de 1 clique:
   `https://claude.ai/code/routines/trig_01JFWNd7xgBCeJ2sydbZeiss`). O
   mesmo raciocínio vale para a cadência deste `/intel`: ambos os
   instrumentos estão medindo, toda semana, um sistema que não muda.
3. **Novo nesta rodada: decidir o destino das treze PRs é mais urgente que
   qualquer achado de mercado.** Mesclar a #42 (mais completa e mais
   recente) e fechar as outras doze resolveria a perda de continuidade que
   já causou dado real perdido (ver histórico de 02/11 e 09/11 no corpo da
   PR). Isso não é uma trava de rubrica — é manutenção operacional que só
   o Stefano pode fazer (merge/close em PRs de outra pessoa).
