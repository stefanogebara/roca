# Estado do repositório — Stevi (roca)

> Escrito pela quinta passada do `/intel` em 2026-10-19. Janela: desde 07/09.
> HEAD `25ddce0`, branch `master`.
> Reescrito a cada `/intel`. Fonte: o git e o banco, não o config.

## O parágrafo

**O voo de 60 dias fechou em 11/09 com veredito qualitativo MATAR/PIVOTAR, e
nos 42 dias desde então o repositório não recebeu uma única linha de
engenharia — só seis memos do PM do Scorecard, todos dizendo a mesma coisa.**
Desde a última passada do `/intel` (07/09), houve exatamente 6 commits em
`master`: o memo de FECHAMENTO (11/09) e cinco memos semanais (14/09, 28/09,
05/10, 12/10, 19/10), todos tocando só
`.claude/plans/memos-scorecard/README.md`. Nenhum commit de produto, nenhum
de prospecção, nenhum de landing. O banco confirma o mesmo silêncio: 30
usuários (inalterado desde 25/jul), 1 produtor externo real (Gaia Tech, sem
mensagem nova desde 17/jul — **94 dias**), última mensagem de qualquer
natureza em **30/09** (um burst de 84 mensagens do próprio Stefano testando
algo), e **zero mensagens em 19 dias** até hoje. `farmer_alerts` continua
com exatamente 2 linhas, ambas de teste, desde 14/08.

## O que shipou (07/09–19/10)

- **Nada de produto ou engenharia.** Os 6 commits da janela são:
  `830e81c` (o próprio `/intel` de 07/09, já registrado na rodada anterior),
  `a01212c` FECHAMENTO dia 60, e os memos de `e01bf5d` (14/09), `10aa0aa`
  (28/09), `2f9d1c4` (05/10), `6c3cc41` (12/10), `25ddce0` (19/10) — todos
  escritos pelo agente `stevi-pm-scorecard`, todos só texto.
- **O memo de FECHAMENTO (11/09)** é o evento real da janela: leu o
  scorecard pré-registrado contra o banco e concluiu **N insuficiente para
  decidir pelo piso literal** (D7 vouchado nunca saiu de n=1, piso mínimo
  15), mas leitura qualitativa inequívoca de MATAR/PIVOTAR nos critérios
  booleanos que não dependem de piso — todos em zero absoluto nos 60 dias:
  0 parceiros com PIX, 0 parceiro pagando, 0 corrente de indicação
  espontânea. Recomendou: encerrar prospecção fria B2B, decisão explícita
  sobre Gaia Tech/Michel, e se a campanha continuar, recomeçar do zero na
  aquisição vouchada.
- **Os cinco memos seguintes (14/09→19/10)** confirmam, semana após semana,
  que nada mudou: mesmos 30 usuários, mesmo 1 produtor, zero commits de
  engenharia, e pedem — pela quinta vez consecutiva, sem resposta — para
  reduzir a cadência da própria rotina semanal (bloqueada tecnicamente: a
  Routine `trig_01JFWNd7xgBCeJ2sydbZeiss` foi criada via painel/API, só o
  Stefano pode editá-la). Isso é uma rotina **diferente** da deste `/intel`
  — não é algo que esta rodada pode resolver, mas é um sinal de governança
  que vale citar no PR.

## O que está em voo

- Nada. A branch órfã de 76 commits (`claude/xenodochial-moore-9dc540`)
  continua sem PR — não verificada de novo nesta rodada, sem motivo para
  mudar a leitura anterior já que zero merge aconteceu na janela.
- PR #4 (scorecard 10/ago) — não reverificado; fora do escopo desta janela
  de git (nenhum commit a tocou).

## O que morreu

- **A campanha do voo de 60 dias.** Não é um código que foi revertido — é o
  próprio experimento pré-registrado, encerrado com veredito qualitativo de
  MATAR/PIVOTAR em 11/09 (ver acima). Isso muda o que "intel relevante"
  significa para este projeto: não há mais um flight plan ativo pedindo
  spikes de engenharia — há founders decidindo se recomeçam, pivotam ou
  encerram.

## Medição de 19/10 — o que o banco diz agora

Consulta somente-leitura no projeto `ruuflfeqcmxpziernaop`, sem PII.

- **`users`: 30, inalterado desde 25/jul.** `kind='produtor'`: **1**
  (Gaia Tech) — mesmo valor desde o início.
- **Mensagens nos últimos 7 dias: 0 (confirmado, query fresca), inclusive
  0 de produtor.** Última mensagem de qualquer tipo em todo o banco:
  **2026-09-30** — 19 dias de silêncio total até hoje. Mensagens nos
  últimos 30 dias: **86** (o burst de teste do Stefano em 28-30/09, já
  registrado nos memos anteriores).
- **`farmer_alerts`: 2 linhas, inalterado desde 14/08** (ambas `kind='teste'`).

## Estado do tripwire

| Lado | Número |
|---|---|
| Commits nos últimos 7 dias (`git log --since='7 days ago'`) | **1** — `25ddce0`, o próprio memo semanal do PM do Scorecard, escrito ~1h antes desta rodada do `/intel` disparar |
| Mensagens de produtor (`kind='produtor'`) nos últimos 7 dias | **0** — medido no banco, não estimado |
| Commits em 42 dias (07/09→19/10) | **6**, todos no mesmo arquivo de memo, zero linha de produto |
| Conversas de produtor externo em 42 dias | **0** — o único produtor real (Gaia Tech) não escreve desde 17/jul |

**Leitura: 1×0 = disparado pela regra literal — mas o único commit é o
registro de uma rotina de medição constatando silêncio, não engenharia
competindo com campo.** É a mesma distinção que os memos do PM do Scorecard
vêm fazendo desde 28/09 (ler o tripwire "pelo espírito": engenharia real × 0
conversas = não disparado). Reporto os dois números sem aplicar essa
interpretação sozinho — é leitura, não edição de `settled`.

## Divergências com o config

Nenhuma foi aplicada sozinha.

1. **A `verdict_note` do `intel.config.json` está desatualizada e referencia
   uma janela que já fechou.** Ela diz "Restam 8 dias até 11/set/2026
   (contado em 03/09)" — mas hoje é 19/10, **38 dias depois** do fim do voo,
   e o voo já foi julgado (MATAR/PIVOTAR qualitativo, memo de FECHAMENTO,
   11/09). O teto que a `verdict_note` impõe (PROTOTIPAR/IMPLEMENTAR exigem
   ajudar a CONVERSAR ou ALERTAR) continua fazendo sentido como princípio,
   mas a frase específica sobre dias restantes não faz mais sentido ser lida
   ao pé da letra — e o `README.md` do flight plan em
   `.claude/plans/2026-07-13-flight-plan/` também descreve uma campanha que,
   pelo próprio repositório, já terminou. Proponho no PR atualizar a
   `verdict_note` para refletir o pós-fechamento (sem tocar `bets`/`settled`).
2. **A rotina do PM do Scorecard (`trig_01JFWNd7xgBCeJ2sydbZeiss`, diferente
   da rotina deste `/intel`) pede há 35 dias, em 5 memos seguidos, para
   reduzir sua própria cadência — e está bloqueada tecnicamente porque foi
   criada via painel/API, não por agente.** Não é algo que esta rodada do
   `/intel` resolve, mas é o mesmo tipo de sinal de governança que esta seção
   existe para capturar: duas rotinas automáticas seguem rodando semanalmente
   sobre um sistema que não recebe uma mensagem há 19 dias.
