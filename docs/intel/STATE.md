# Estado do repositório — Stevi (roca)

> Escrito pela sexta passada do `/intel` em 2026-11-02. Janela: desde 26/10 (7 dias).
> HEAD `7cbb7cd`, branch `master`.
> Reescrito a cada `/intel`. Fonte: o git e o GitHub, não o config.

## O parágrafo

**O voo de 60 dias fechou há 52 dias (11/set/2026, dia 60) com veredito qualitativo
MATAR/PIVOTAR — e o único commit nos últimos 7 dias é o próprio memo semanal do PM do
Scorecard confirmando, pela oitava vez consecutiva, que nada mudou.** Mas o achado real
desta rodada não é sobre o produto: é sobre o próprio processo de intel. Verificando o
GitHub (não só `git log`), este `/intel` tem **dez pull requests em draft abertas desde
10/ago/2026, nenhuma revisada ou mesclada** — sete do próprio `/intel` (#32, #34, #35, #36,
#37, #38, #39) e três do PM do Scorecard (#4, #31, #33). `master` está preso no estado de
07/09 em `docs/intel/` e `intel.config.json`; cada rodada semanal reconstrói o acumulado
lendo as PRs anteriores diretamente no GitHub, porque nenhuma foi mesclada — e nessa
reconstrução pelo menos um item inteiro se perdeu entre #37 (12/out) e #38 (19/out): a
leitura da triagem materna da Noora Health (Índia, WhatsApp, arXiv 2609.09356), score 11/15,
só reapareceu nesta rodada porque fui direto ao histórico de PRs checar. Isso é a mesma
doença que o PM do Scorecard documenta sobre si mesmo há 7 semanas (pedir decisão sem
resposta), só que na escala de dois meses e com perda de dado real, não só repetição.

## O que shipou (26/10–02/11)

- **Nada de engenharia.** O único commit da janela é `7cbb7cd` (memo do PM do Scorecard,
  02/11), puro `docs(memo)`.

## O que está em voo

Nada. Dez PRs em draft (ver tabela abaixo) aguardam revisão humana; nenhuma delas é código
de produto em andamento — sete são `/intel`, três são memos do PM do Scorecard. A branch
órfã de 76 commits (`claude/xenodochial-moore-9dc540`) segue sem PR, confirmada ainda
presente no remoto.

## O que morreu

Nada nesta janela — o voo em si já morreu há 52 dias (ver FECHAMENTO, `a01212c`).

## Achado principal desta rodada: o backlog de PRs nunca revisadas

| PR | Conteúdo | Aberta em | Dias parada (hoje) | Revisão humana |
|---|---|---|---|---|
| #4 | memo PM — 10/ago | 2026-08-10 | 84 | nenhuma |
| #31 | memo PM — 07/set (dia 57) | 2026-09-08 | 55 | nenhuma |
| #32 | `/intel` 14/set | 2026-09-14 | 49 | nenhuma |
| #33 | memo PM — 21/set | 2026-09-21 | 42 | nenhuma |
| #34 | `/intel` 21/set | 2026-09-21 | 42 | nenhuma |
| #35 | `/intel` 28/set | 2026-09-28 | 35 | nenhuma |
| #36 | `/intel` 05/out | 2026-10-05 | 28 | nenhuma |
| #37 | `/intel` 12/out | 2026-10-12 | 21 | nenhuma (propôs fechar #32/#34/#35/#36 como superadas — também não executado) |
| #38 | `/intel` 19/out | 2026-10-19 | 14 | nenhuma |
| #39 | `/intel` 26/out | 2026-10-26 | 7 | nenhuma |

Esta PR (`intel/2026-11-02`) soma-se à lista como a 11ª draft aberta, seguindo a instrução do
skill — mas o problema estrutural (nenhuma PR sendo revisada) significa que esta tende a
se acumular também, a menos que a cadência ou o fluxo de revisão mudem.

**Por que isso importa mais que qualquer item de mercado desta semana:** o `/intel` existe
para levar decisão ao Stefano, não para acumular documento. Com 10 PRs nunca abertas, nenhum
dos itens DISCUTIR das últimas 8 semanas chegou de fato a ser decidido pelo canal normal — e
pelo menos um item de intel (a triagem materna Noora Health) se perdeu de verdade na
reconstrução manual entre rodadas, só recuperado porque este `/intel` foi checar o histórico
de PRs em vez de confiar só no `master`.

## Medição de 02/11 — o que o PM do Scorecard já mediu hoje (reaproveitado, não remedido)

O memo `.claude/plans/memos-scorecard/README.md` (commit `7cbb7cd`, rodado ~1h antes deste
`/intel`) já consultou o banco com query fresca hoje:

- `users` total: **30** (estável desde início de agosto). Produtor externo real: **1** (Gaia
  Tech) — **0 mensagens novas em 108 dias**.
- Mensagens de qualquer tipo nos últimos 14 dias: **0**. Última mensagem inbound de toda a
  base: **30/set** (Stefano testando).
- `farmer_alerts`: **2** (inalterado desde 14/08, ambas `kind='teste'`).
- **Achado novo do PM do Scorecard nesta semana, não deste `/intel`:** um contato
  `Corpal Tratores` trocou 836 mensagens IN e 836 OUT num loop de eco automático em
  03/ago/2026 (~4h15), nunca antes registrado em nenhum memo — risco de reputação de número
  não investigado, mas sem recorrência em 3 meses.

Não reconsultei o banco por conta própria nesta rodada — os números acima são do mesmo dia,
mesma query fresca, e repetir seria desperdício.

## Estado do tripwire

| Lado | Número |
|---|---|
| Commits nos últimos 7 dias | **1** — o próprio commit do memo do PM do Scorecard (`7cbb7cd`, `docs(memo)`), não engenharia |
| Conversas de produtor externo real nos últimos 7 dias | **0** — medido no banco pelo memo do PM do Scorecard de hoje |
| Dias desde o fechamento do voo (11/set) | **52** |
| Dias sem nenhum commit de engenharia de produto | **52** (desde antes de 12/09) |
| PRs em draft nunca revisadas (incluindo esta) | **11** |

**Leitura: não disparado pelo espírito da regra** (0 engenharia × 0 conversas) — mesma
convenção usada desde 14/set. Lido ao pé da letra, 1×0 = disparado; registro os dois
números. O tripwire original mede "código competindo com conversa"; hoje mede silêncio dos
dois lados, e o verdadeiro excesso da campanha não é mais commits de produto — é documentos
de processo (`/intel`, PM do Scorecard) nunca revisados.

## Divergências com o config

Nenhuma foi aplicada sozinha. `bets` e `settled` só o Stefano mexe, e nada mudou de forma
inequívoca nesta janela que justificasse nova linha em `settled`.

1. **A `verdict_note` continua desatualizada** (fala em "restam 8 dias até 11/set/2026") —
   sinalizado pela quarta rodada seguida (07/09, 10/12 via PR#37, 10/19, 10/26, agora). Não
   editado — é reformulação de julgamento, não fato mecânico.
2. **Novo, e mais urgente que a `verdict_note`:** o próprio fluxo de PRs do `/intel` e do PM
   do Scorecard precisa de uma decisão operacional — consolidar/fechar as PRs superadas
   (como #37 já propôs há 21 dias, sem resposta) e mesclar pelo menos a mais recente, ou o
   `master` nunca reflete o estado real do projeto e itens de intel continuam em risco de se
   perder, como já aconteceu uma vez.
