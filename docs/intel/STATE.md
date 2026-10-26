# Estado do repositório — Stevi (roca)

> Escrito pela quinta passada do `/intel` em 2026-10-26. Janela: desde 07/09
> (49 dias — o `/intel` ficou sem rodar, ou rodou sem achar candidato, por
> sete semanas).
> HEAD `f2ce6da`, branch `master`.
> Reescrito a cada `/intel`. Fonte: o git e o banco, não o config.

## O parágrafo

**O voo de 60 dias fechou há 45 dias (11/set/2026, dia 60) com veredito
qualitativo MATAR/PIVOTAR — e desde então o repositório não recebeu uma
única linha de código de produto.** Dos 10 commits nesta janela de 49 dias,
8 são os memos semanais do PM do Scorecard (todos `docs(memo)`, nenhum toca
`api/`, `web/` ou `knowledge/`), 1 é o próprio `/intel` de 07/09 que já
registrou o fechamento, e os últimos 2 commits de produto (`328cd3d`,
`76132fa`) são de 07–08/09, já cobertos na rodada anterior. Desde 12/09 —
**44 dias** — zero engenharia. O banco confirma a mesma pausa do lado do
campo: zero mensagens de qualquer tipo (produtor, teste ou founder) nos
últimos 7 dias; a última mensagem de qualquer natureza em toda a base é de
30/09 (26 dias atrás); o único produtor externo real (Gaia Tech) não escreve
desde 17/07 (101 dias). Os memos semanais do PM do Scorecard (`.claude/plans/memos-scorecard/README.md`)
pedem, pela sétima semana consecutiva (14/set, 28/set, 05/out, 12/out, 19/out,
26/out), para reduzir a própria cadência — sem resposta do Stefano até agora.

## O que shipou (07/09–26/10)

- **Nada de engenharia de produto.** Os dois commits de `site:` desta janela
  (`328cd3d`, `76132fa`) são de 07–08/09, antes do fechamento, e já constavam
  no `STATE.md` anterior.
- **FECHAMENTO do voo de 60 dias (`a01212c`, 12/set).** Veredito: **N
  insuficiente para decidir pelo piso literal do scorecard** (a coorte D7
  nunca saiu de n=1), **mas leitura qualitativa inequívoca de MATAR/PIVOTAR**
  nos critérios booleanos que não dependem de piso de n — todos em zero
  absoluto nos 60 dias: 0 parceiros com PIX, 0 indicação espontânea
  produtor→produtor, 0 dos 10 leads necessários pro teste de "matar" (nunca
  chegou a 10 porque o caderno de aplicações nunca foi usado). Tripwire final:
  27 commits (7 dias) × 0 conversas de produtor — a semana de fechamento teve
  58 commits no total, 25 deles iterações visuais de uma landing page nunca
  vista por um produtor.
- **Seis memos semanais do PM do Scorecard pós-fechamento** (`e01bf5d` 14/set,
  `10aa0aa` 28/set, `2f9d1c4` 05/out, `6c3cc41` 12/out, `25ddce0` 19/out,
  `f2ce6da` 26/out) — todos confirmam a mesma leitura: `users` total parado em
  30 desde 25/jul, produtor externo real parado em 1 (Gaia Tech) desde 17/jul,
  `farmer_alerts` parado em 2 (`kind='teste'`) desde 14/08, golden set em
  0/38 `verified_by` desde sempre. Nenhum número mudou em 45 dias.

## O que está em voo

Nada. Os memos do PM do Scorecard são unânimes: "não há voo em curso — o que
resta é decisão dos founders sobre o veredito já entregue." A branch órfã de
76 commits (`claude/xenodochial-moore-9dc540`) segue sem PR, não confirmada
de novo nesta rodada (sem sinal de que mudou).

## O que morreu

O voo de 60 dias inteiro, formalmente, em 11/set — ver FECHAMENTO acima.
Nenhuma morte nova nesta janela.

## Medição de 26/10 — o que o banco diz agora

Consulta somente-leitura no projeto `ruuflfeqcmxpziernaop`, sem PII.

- `users` total: **30** (inalterado desde 25/jul). Produtor: **1** (Gaia
  Tech).
- **Mensagens nos últimos 7 dias: 0 — de qualquer tipo**, nem produtor, nem
  teste, nem founder.
- Última mensagem de qualquer natureza em toda a base: **30/09/2026** (26
  dias de silêncio total).
- Última mensagem do único produtor externo real: **17/07/2026** (101 dias).

Estes números são consistentes com os sete memos do PM do Scorecard —
nenhuma medição nova além da confirmação de que nada mudou.

## Estado do tripwire

| Lado | Número |
|---|---|
| Commits nos últimos 7 dias | **1** — e é o próprio commit do memo anterior do PM do Scorecard (`f2ce6da`, `docs(memo)`), não engenharia |
| Mensagens de produtor (`kind='produtor'`) nos últimos 7 dias | **0** — medido no banco |
| Mensagens de qualquer tipo nos últimos 7 dias | **0** |
| Dias desde o fechamento do voo (11/set) | **45** |
| Dias sem nenhum commit de engenharia de produto | **44** (desde 12/09) |

**Leitura: tripwire não disparado pelo espírito da regra** (0 engenharia × 0
conversas), mesma convenção que o PM do Scorecard já vem aplicando desde
14/set — lido ao pé da letra, o único commit da janela é de documentação do
próprio processo de medição, não do produto. Isso não é mais um sinal de
"excesso de código"; é a confirmação de que o projeto está, de fato, parado
dos dois lados — exatamente o estado que o fechamento do dia 60 recomendou
("nenhuma linha de código, nenhuma iteração de produto, nenhum disparo de
prospecção").

## Divergências com o config

Nenhuma foi aplicada sozinha. `bets` e `settled` só o Stefano mexe — mas uma
linha foi acrescentada a `settled` nesta rodada porque é fato que o git
mostra sem ambiguidade (regra: "acrescentar ao settled o que o git mostra sem
ambiguidade é permitido"): o fechamento do voo em 11/set com veredito
MATAR/PIVOTAR qualitativo, documentado no commit `a01212c`.

1. **A `verdict_note` do `intel.config.json` está desatualizada e precisa de
   decisão do Stefano, não de edição silenciosa.** Ela ainda fala em "restam
   8 dias até 11/set/2026" e enquadra o projeto como "sob um flight plan com
   tripwire" — mas o flight plan fechou há 45 dias, com veredito MATAR/PIVOTAR
   qualitativo, e os memos do PM do Scorecard documentam 45 dias de pausa
   total. A trava de PROTOTIPAR/IMPLEMENTAR (exigir CONVERSAR/ALERTAR) segue
   válida e, neste estado, fica ainda mais restritiva — mas a redação atual
   induz quem ler a pensar que há um voo ativo com dias contados, o que não é
   mais verdade. Proposta no corpo do PR: reescrever a `verdict_note` para
   refletir o estado pós-fechamento.
2. **Os `known_gaps` do config têm pelo menos 8 entradas com matemática de
   "restam N dias" ou medições de agosto/início de setembro que o PM do
   Scorecard já superou com medições mais recentes e idênticas (nada mudou,
   mas a prosa do config ainda fala do voo como se estivesse em andamento).**
   Não editado nesta rodada — é prosa extensa e reescrevê-la é julgamento, não
   mecânica; fica como proposta pro Stefano decidir se vale a limpeza.
3. **Pergunta de processo que este `/intel` também precisa fazer a si mesmo:**
   o PM do Scorecard pede redução de cadência desde 14/set (agora pela sétima
   vez, 42+ dias sem resposta). O `/intel` não tinha essa mesma pergunta em
   aberto porque rodou silencioso (sem achar candidato, ou sem rodar) por sete
   semanas — mas, dado que o projeto está formalmente morto/pausado há 45
   dias, vale a mesma pergunta aqui: esta rotina deveria continuar semanal, ou
   passar a mensal/por evento, como o PM do Scorecard já pediu pra si mesmo?
   Ver corpo do PR.
