# Estado do repositório — Stevi (roca)

> Escrito pela nona passada do `/intel` em 2026-11-16 (a primeira a rodar
> **sozinha** — sem acesso de sessão anterior aos branches das oito rodadas
> anteriores não mescladas, exceto pela checagem de GitHub feita abaixo).
> Janela: desde 2026-09-07 (última passada mesclada em `master`).
> HEAD `3884f23`, branch `master`.
> Reescrito a cada `/intel`. Fonte: o git, o GitHub e o `.claude/plans/memos-scorecard/README.md`, não o config.

## O parágrafo

**O achado mais importante desta rodada não é de mercado — é que este próprio
pipeline está travado há mais de três meses, e isso já foi dito ao Stefano
três vezes sem resposta.** Desde a última passada mesclada em `master`
(09/07–09/10), o voo de 60 dias fechou (11/09) com veredito qualitativo
MATAR/PIVOTAR, o repositório não recebeu uma linha de engenharia (só memos
semanais do PM do Scorecard), e **oito rodadas seguintes de `/intel`
(14/09 a 09/11) rodaram, cada uma abriu um PR em draft, e nenhuma foi
revisada ou mesclada.** `master` está congelado no estado de `docs/intel/`
de 07/09; cada rodada nova (inclusive esta) parte desse mesmo estado
congelado, porque não há como herdar o trabalho das rodadas anteriores sem
mesclar os PRs. Isso já causou perda real de dado: um item lido a fundo em
02/11 (triagem materna por WhatsApp na Índia, arXiv 2609.09356, score
11/15) foi reconhecido ali como "recuperado de uma PR que nunca foi
mesclada" — e some de novo na rodada de 09/11, porque aquela também não
foi mesclada. As rodadas de 26/10, 02/11 e 09/11 já registraram esse exato
problema como achado principal, cada vez com mais detalhe. Esta é a quarta
vez. Ver a seção dedicada abaixo.

## PRs de `/intel` e do PM do Scorecard nunca revisadas (checado agora via GitHub, não só `git log`)

| PR | Conteúdo | Branch | Aberta em | Dias parada (hoje, 16/11) |
|---|---|---|---|---|
| #41 | intel — 26 itens, 7 DISCUTIR (Gemini, SoilGrids) | `intel/2026-11-09` | 2026-11-09 | 7 |
| #40 | intel — 45 itens, achado = 10 PRs sem revisão | `intel/2026-11-02` | 2026-11-02 | 14 |
| #39 | intel — 37 itens | `intel/2026-10-26` | 2026-10-26 | 21 |
| #38 | intel — 56 itens, voo fechado, 7ª rodada sem spike | `intel/2026-10-19` | 2026-10-19 | 28 |
| #37 | intel — 29 itens, "pipeline achou a si mesmo" | `intel/2026-10-12` | 2026-10-12 | 35 |
| #36 | intel — 36 itens, voo fechou MATAR/PIVOTAR | `intel/2026-10-05` | 2026-10-05 | 42 |
| #35 | intel — 43 itens | `intel/2026-09-28` | 2026-09-28 | 49 |
| #34 | intel — 34 itens, Sicoob racha premissa de app | `intel/2026-09-21` | 2026-09-21 | 56 |
| #33 | memo PM — semana de 21/set | `docs/memo-scorecard-2026-09-21` | 2026-09-21 | 56 |
| #32 | intel — 39 itens, fecha em MATAR/PIVOTAR | `intel/2026-09-14` | 2026-09-14 | 63 |
| #31 | memo PM — semana de 07/set (dia 57) | `claude/scorecard-memo-0907` | 2026-09-08 | 69 |
| #4 | memo PM — semana de 10/ago | `claude/pm-scorecard-memo-10-ago` | 2026-08-10 | 98 |

**Doze PRs abertas, zero mescladas, zero fechadas, zero comentadas.** Esta
rodada abre a **décima terceira** (ver Entrega). Nenhuma delas é código de
produto — são oito rodadas de `/intel` e quatro memos do PM do Scorecard,
todas puro `docs/`. Mesclar qualquer uma é mecanicamente seguro (não toca
`api/`, não precisa de deploy, não quebra nada em produção) — o único custo
de não mesclar é exatamente este: perda de continuidade e trabalho
repetido, rodada após rodada, pela própria falta de revisão.

## O que shipou (31/08–11/09 — antes do fechamento)

Nada novo além do que o `STATE.md` de 07/09 (último mesclado) já registrou:
os 25 commits de iteração de landing (v9→v30), o kit da Fecon (zero
conversão), a diversificação de gateway (#13-#15). Ver a versão anterior
deste arquivo no histórico do git — não repito aqui porque nada mudou.

## O que está em voo

**Nada de produto.** A branch órfã de 76 commits (`claude/xenodochial-moore-9dc540`)
segue sem PR, confirmada ainda presente no remoto, sem mudança desde 07/09.
As doze PRs da tabela acima são os únicos branches "em voo", e nenhuma é
código — são `docs/` aguardando revisão humana.

## O que morreu

**A campanha de validação de 60 dias.** `a01212c` (12/09) registra o
veredito: os critérios booleanos do scorecard que não dependem de piso de
n (≥3 parceiros com PIX, ≥1 parceiro pagando confiável, ≥1 corrente de
indicação espontânea) ficaram em zero absoluto nos 60 dias inteiros —
MATAR/PIVOTAR qualitativo. Recomendações do fechamento: encerrar a
prospecção fria B2B no formato atual, decisão explícita sobre Gaia
Tech/Michel, e, se a campanha continuar, recomeçar do zero na aquisição
vouchada.

## Medição mais recente do banco (citada do memo de 16/11, não requerida de novo)

A leitura de hoje do `stevi-pm-scorecard` (`.claude/plans/memos-scorecard/README.md`,
"Semana de 16/nov — dia 127 de 60") já mediu o banco direto via Supabase
MCP nesta mesma data; não há motivo para rodar as mesmas queries de novo e
arriscar um número diferente por ruído:

- `users` total: **30**, inalterado desde início de agosto.
- Produtor externo real: **1** (Gaia Tech, vouchado pelo Michel) — **0
  mensagens novas em 122 dias**.
- `messages` nos últimos 14 dias: **0** — nenhum produtor, teste ou
  founder mandou qualquer coisa. Última mensagem inbound de toda a base:
  30/09 (**47 dias** de silêncio total).
- `farmer_alerts`: **2**, inalterado desde 14/08, ambas `kind='teste'`.
- Golden set: **0/38** casos com `verified_by`.
- Prospecção: **367** linhas, idêntico há 6+ semanas, disparo parado.

## Estado do tripwire

| Lado | Número |
|---|---|
| Commits nos últimos 7 dias (`git log --since='7 days ago'`) | **1** — `3884f23`, o próprio memo do scorecard de 16/11. Zero commits de engenharia. |
| Conversas de produtor externo real nos últimos 7 dias (`produtores_conversados_7d`, medido no banco pelo memo de 16/11) | **0** |

**Leitura literal: 1 commit > 0 conversas → tripwire disparado.** **Leitura
pelo espírito da regra (engenharia real vs. campo, convenção usada desde
24/08): 0 commits de engenharia × 0 conversas → não disparado.** Registro
os dois. A leitura qualitativa que importa de fato esta rodada não é o
tripwire — é que o próprio instrumento que mede o tripwire (este `/intel`)
ficou 63 dias sem rodar, e quando rodou, oito vezes seguidas, não convergiu
em nada por falta de revisão.

## Divergências com o config

Nenhuma foi aplicada sozinha; a única adição mecânica foi a linha de
`settled` sobre o FECHAMENTO (ver `intel.config.json`, o commit `a01212c` é
fonte inequívoca).

1. **A `verdict_note` está desatualizada desde pelo menos 26/10 (já
   apontado por três rodadas não mescladas) e eu reforço o mesmo ponto.**
   Ela descreve um voo em andamento ("restam 8 dias até 11/set/2026") que
   fechou há 66 dias. Isso não inverte nenhuma trava da rubrica desta
   rodada — PROTOTIPAR/IMPLEMENTAR continuam travados em DISCUTIR, só que
   agora por um motivo mais simples (projeto pausado, sem conversa ou
   alerta para ajudar) do que o texto atual da `verdict_note` descreve.
   Precisa de uma reescrita do Stefano que diga o que vale **depois** de
   um MATAR/PIVOTAR: recomeçar do zero, pivotar, ou arquivar — e, se
   arquivar, se este `/intel` semanal ainda faz sentido existir.
2. **O pedido de reduzir a cadência do memo do PM do Scorecard (`trig_01JFWNd7xgBCeJ2sydbZeiss`,
   `cron_expression: "0 12 * * 1"`) está parado há 63 dias e nove pedidos
   consecutivos** (ver `.claude/plans/memos-scorecard/README.md`). Não é
   meu papel editar essa Routine, mas o mesmo raciocínio vale para a
   cadência deste próprio `/intel`: rodar semanalmente um pipeline de
   mercado para um projeto pausado, sem mesclar nenhum resultado, é o
   mesmo tipo de ruído que o tripwire foi desenhado para impedir.
