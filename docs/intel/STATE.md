# Estado do repositório — Stevi (roca)

> Escrito pela quinta passada do `/intel` em 2026-10-05. Janela: desde 07/09.
> HEAD `2f9d1c4`, branch `master`.
> Reescrito a cada `/intel`. Fonte: o git e o banco, não o config.

## O parágrafo

**O voo de 60 dias fechou em 11/set com veredito MATAR/PIVOTAR qualitativo
(`.claude/plans/memos-scorecard/README.md`, commit `a01212c`) — e os 24 dias
desde então não mudaram nada.** Não é mais uma campanha em voo medindo
tripwire semana a semana; é um projeto com decisão entregue, esperando os
founders dizerem se recomeça do zero ou encerra. Desde o fechamento, **zero
commits de produto ou código** — os únicos 4 commits da janela são memos
semanais do PM do Scorecard (14/09, 28/09, 05/10), cada um confirmando a
mesma leitura: zero produtor conversando, zero decisão tomada. Os 2 commits
de código da janela (`76132fa`, `328cd3d`) são de 07–08/09, **antes** do
fechamento, e já eram esperados (ajuste visual da landing e limpeza de
imagens órfãs). Consulta fresca ao banco hoje (05/10) confirma: `users`
total **30**, produtor externo real **1** (Gaia Tech, inalterado desde
25/jul), `farmer_alerts` **2** linhas (as mesmas de 14/08, ambas teste), e
**zero** fazenda pertencente a um usuário `kind='produtor'` com pin. A
última mensagem em todo o banco foi em **30/09** — 86 mensagens nos últimos
30 dias, mas são as 84 do próprio Stefano testando algo entre 28–30/09, não
produtor.

## O que shipou (07/09–05/10)

- **`76132fa` (07/09) + `328cd3d` (08/09) — últimos dois commits de produto
  antes do fechamento.** Restaura a landing anterior preferida pelo Stefano
  (foto em tela cheia, seções pinadas), corrige divergência entre os dois
  números de geada exibidos na página, adiciona o cartaz do balcão com QR
  real; depois remove 4 imagens órfãs (1,5 MB/deploy) que não eram mais
  referenciadas. Nenhum dos dois toca D7 ou alerta — são a cauda da mesma
  rodada de design que o `/intel` de 07/09 já tinha marcado como excesso do
  tripwire.
- **`a01212c` (12/09) — FECHAMENTO do voo de 60 dias.** O memo do PM do
  Scorecard lê o scorecard pré-registrado de 13/jul: a métrica que decidiria
  VENTURE/NEGÓCIO/MATAR (coorte D7 vouchada) nunca saiu de n=1, abaixo do
  piso de leitura (n≥15) — então não decide por taxa. Mas todos os critérios
  **booleanos** do scorecard (não dependem de piso de n) ficaram em zero
  absoluto nos 60 dias inteiros: 0 parceiros com PIX, 0 parceiro pagando,
  0 corrente de indicação espontânea. Veredito: **N insuficiente pelo piso
  literal, leitura qualitativa inequívoca de MATAR/PIVOTAR** pelos critérios
  que não precisam de n. A Fecon (1–3/09, única janela de campo do voo)
  confirmou zero cadastros via `#fecon`/`#fecon-cartaz`, como o `/intel` de
  07/09 já tinha registrado.
- **`e01bf5d` (14/09) + `10aa0aa` (28/09) + `2f9d1c4` (05/10) — três memos
  de acompanhamento pós-fechamento, cada um "nada mudou".** Os três
  recomendam reduzir a cadência semanal do próprio memo para mensal ou por
  evento, já que não há mais janela nem dado novo a medir. A recomendação
  foi feita duas vezes (14/09, 28/09) e **não executada** — o memo de 05/10
  investigou por quê: a Routine que dispara o memo toda segunda
  (`trig_01JFWNd7xgBCeJ2sydbZeiss`) foi criada via API/painel, não por um
  agente, então só quem a criou (o Stefano) pode editá-la. Link de 1 clique
  deixado no memo de 05/10.

## O que está em voo

- Nada. O voo de 60 dias terminou; não há mais experimento em curso, só a
  decisão dos founders pendente sobre recomeçar (do zero, não herdando a
  coorte atual) ou encerrar.
- A branch órfã de 76 commits (`claude/xenodochial-moore-9dc540`) segue sem
  PR, não reconfirmada nesta rodada — não houve mudança que a tocasse.

## O que morreu

- **A cadência semanal do memo do PM do Scorecard, de fato, embora não
  formalmente.** Três rodadas seguidas pedindo redução de frequência, uma
  delas bloqueada por permissão. Continua rodando por falta do clique do
  Stefano, não por decisão de que valha a pena.

## Medição de 05/10 — o que o banco diz agora

Consulta somente-leitura no projeto `ruuflfeqcmxpziernaop`, sem PII.

- **`users`: 30 no total, inalterado desde 03/09.** Produtor externo real
  segue em **1** (Gaia Tech) desde 25/jul — **80 dias** sem mensagem nova.
- **Mensagens inbound nos últimos 7 dias, de qualquer `kind`: ZERO.**
  Confirmado por query direta (não só o memo do PM) — nem produtor, nem
  teste, nem empresa escreveu para a Stevi na última semana.
- **Últimos 30 dias: 86 mensagens**, mas a última é de **30/09** e o bloco
  é dominado por 84 mensagens do próprio Stefano (28–30/09, `kind` não
  produtor) — não há sinal de campo nelas.
- **`farmer_alerts`: continua com exatamente 2 linhas**, as mesmas de
  14/08, ambas `fire`, ambas de teste. Nenhum alerta novo desde então.
- **Fazendas pertencentes a um usuário `kind='produtor'` com pin: ZERO.**
  Confirmado por join direto — mesmo resultado que os memos vêm reportando
  desde 03/09 (as 4 farms com pin existentes são todas `kind='teste'`).

## Estado do tripwire

| Lado | Número |
|---|---|
| Commits nos últimos 7 dias (`git log --since='7 days ago'`) | **1** — o commit deste próprio memo de PM (05/10), só docs |
| Conversas de produtor externo real na mesma janela | **0** — confirmado por query direta em `messages` (zero inbound de qualquer `kind` nos últimos 7 dias) |
| Dias desde o fechamento do voo (11/09) | **24** |

**Leitura: o tripwire dispara (1 > 0), mas o número não significa o que
significava durante o voo.** Não há mais engenharia correndo na frente do
funil — há silêncio total dos dois lados, e o único commit da semana é a
própria rotina de medição confirmando o silêncio pela quarta vez. O
tripwire original existia para pegar "código substituindo conversa"; hoje
não há nem código nem conversa, o que é uma leitura distinta e não deveria
disparar o mesmo alarme. Isso é um sinal de que a `verdict_note` do config
(que ainda descreve o projeto como "sob flight plan... restam 8 dias até
11/set") está desatualizada — ver Divergências.

## Divergências com o config

Nenhuma foi aplicada sozinha além do mecânico permitido (ver `settled`
abaixo, adição que o git mostra sem ambiguidade).

1. **A `verdict_note` descreve um voo em andamento que já fechou há 24
   dias.** Ela diz "restam 8 dias até 11/set/2026 (contado em 03/09)" — mas
   o voo terminou em 11/09 com veredito MATAR/PIVOTAR qualitativo registrado
   em `a01212c`. A trava de teto (PROTOTIPAR/IMPLEMENTAR só se ajudar a
   CONVERSAR ou ALERTAR) provavelmente ainda deveria valer — ou valer mais
   forte, já que agora não há nem voo nem decisão de recomeço — mas isso é
   leitura, não fato mecânico, então fica aqui para o Stefano reescrever a
   nota em vez de eu reescrevê-la.
2. **O `known_gaps` mais recente do config é de 07/09 e não reflete o
   fechamento nem os 24 dias de silêncio pós-voo.** Mecânico (acrescentar o
   fato do fechamento) foi feito em `settled` nesta rodada; o que falta —
   decidir se a campanha recomeça — é julgamento do Stefano, proposto no PR.
