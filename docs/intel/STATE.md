# Estado do repositório — Stevi (roca)

> Escrito pela quinta passada do `/intel` em 2026-09-14. Janela: desde 07/09.
> HEAD `e01bf5d`, branch `master`.
> Reescrito a cada `/intel`. Fonte: o git e o banco, não o config.

## O parágrafo

**O voo de 60 dias terminou. `a01212c` (12/09) registra o veredito do
scorecard pré-registrado: N INSUFICIENTE pelo piso literal (coorte D7
nunca saiu de n=1, piso mínimo de leitura é 15) — mas leitura qualitativa
inequívoca de MATAR/PIVOTAR nos critérios booleanos, que não dependem de
piso de n e ficaram todos em zero absoluto pelos 60 dias inteiros: 0
parceiros com PIX, 0 correntes de indicação espontânea, 0 leads chegando a
10 (então "matar" nem chegou a ter precondição pra disparar). A Fecon —
única janela de campo pré-comprometida do voo — converteu zero cadastros
apesar do kit pronto a tempo. A recomendação do memo é explícita: parar de
construir (landing, prospecção fria, pacotes de confiabilidade já estão
prontos e sem uso), decidir o destino do contato único real (Gaia Tech,
56 dias sem resposta) e, se a campanha continuar, recomeçar do zero na
aquisição vouchada — não herdar o histórico atual como prova de nada.**
Um segundo memo (`e01bf5d`, 14/09, dia 64) confirma que nada mudou nos 3
dias desde o fechamento — inclusive **zero commits** entre 12/09 e 14/09,
a primeira pausa total de engenharia em 60 dias. Esta rodada do `/intel`
roda depois desse fechamento; isso muda o que "tripwire disparado" quer
dizer esta semana (ver seção própria abaixo) e é a divergência de config
mais importante a levar ao Stefano.

## O que shipou (07/09–14/09)

- **`830e81c` (10/09) — PR #30 mesclado: a rodada de `/intel` de 07/09.**
  26 itens, 3 DISCUTIR (OpenRouter ToS sobre prompt logging, App do Cacau
  da UESC, Café 360 Premium), tripwire registrado disparado, item da Fecon
  fechado como resultado (zero cadastro) e movido pro Arquivo. Já estava
  descrito no `STATE.md` anterior; citado aqui só porque o merge em si
  aconteceu nesta janela.
- **`328cd3d` (08/09) — limpeza de 4 imagens órfãs** (`folha-ferrugem`,
  `geada-madrugada`) que não sobreviveram ao design descartado — 1,5 MB a
  menos por deploy, zero referência restante no HTML/CSS/JS.
- **`a01212c` (12/09) — memo de FECHAMENTO do voo de 60 dias.** Não é
  código de produto — é o instrumento de governança que o próprio
  flight-plan pré-registrou fazendo o trabalho que existe pra fazer: ler o
  scorecard contra o piso de n, nomear os critérios booleanos que não
  precisam de piso, e dizer MATAR/PIVOTAR sem meias-palavras. O memo
  também se autocritica: a rotina semanal do PM do Scorecard ficou **5
  semanas sem rodar** (38 dias de silêncio) antes deste fechamento — o
  mesmo padrão de silêncio que o memo descreve no produto, aplicado à
  própria governança do voo.
- **`e01bf5d` (14/09) — memo de confirmação, dia 64.** Não reabre o
  veredito; mede de novo (banco fresco) e confirma zero variação em 3
  dias. Recomenda cadência mensal (ou por evento) daqui pra frente, já que
  rodar semanalmente sem dado novo é o mesmo tipo de ruído que o próprio
  memo de fechamento criticou.
- **`76132fa` (07/09, manhã) — já contabilizado na rodada anterior**
  (reversão da landing pro design anterior + correção do número de geada).
  Cai dentro da janela `--since` mecânica desta rodada só por coincidência
  de data; não é atividade nova.

## O que está em voo

- Sem mudança: PR #4 (scorecard 10/ago) segue DRAFT; a branch órfã de 76
  commits (`claude/xenodochial-moore-9dc540`) segue sem PR, sem confirmação
  de remoção nesta janela.

## O que morreu

- **A campanha de prospecção fria B2B e a aquisição vouchada no formato
  atual — recomendação explícita do memo de fechamento, ainda não
  ratificada pelos founders em código ou config.** Isso é leitura de
  memo, não fato mecânico do git; por isso vira divergência abaixo, não
  edição em `intel.config.json`.

## Medição de 14/09 — o que o memo de PM (banco fresco, mesmo dia) diz

Não fiz consulta própria ao banco nesta rodada — o memo `e01bf5d` já
requisitou os mesmos números hoje, e reconsultar seria duplicar leitura
sem ganho. Citando a fonte:

- **`users`: 30 no total, inalterado desde o fechamento.** Produtor
  externo real segue em **1** (Gaia Tech, sem mensagem nova desde 17/jul).
- **Ativos 7 dias: 0.** `farmer_alerts`: **2** (as mesmas de 14/08, ambas
  teste). `triage_events`: **0**. Caderno de aplicações: **0**.
- **Prospecção: 8 `replied`, todos empresa, nenhum produtor, nenhum
  parceiro pagante — inalterado desde o fechamento.**

## Estado do tripwire

| Lado | Número |
|---|---|
| Commits nos últimos 7 dias (`git log --since='7 days ago'`) | **5** |
| Conversas de produtor externo distinto na semana | **0** — não medido por mim nesta rodada; citado do memo `e01bf5d` (consulta fresca ao banco no mesmo dia, mesma janela) |
| Commits DEPOIS do fechamento (12/09) | **0** até 14/09 — primeira pausa total de engenharia em 60 dias |
| Dias desde o fim do voo pré-registrado (11/09) | **3** |

**TRIPWIRE DISPARADO por número (5×0), mas a leitura qualitativa é outra
coisa esta semana.** Dos 5 commits, 2 são o merge da rodada de `/intel`
anterior e a limpeza de imagens (trabalho de manutenção, não "engenharia
correndo na frente do funil"), 1 é sobreposição mecânica de um commit já
contado na semana passada, e os outros 2 são os próprios memos de
fechamento e confirmação — texto sobre o veredito, não código de produto.
**Nenhum commit desta janela tenta mover D7 ou disparar alerta**; pela
primeira vez em sete rodadas, o disparo do tripwire não está sendo
acionado por excesso de construção, e sim por resíduo administrativo em
cima de uma campanha que os próprios memos já disseram para parar de
alimentar. Isso não desarma o tripwire — só muda o que ele está pegando.

## Divergências com o config

Nenhuma foi aplicada sozinha. `bets` e `settled` só o Stefano mexe.

1. **A `verdict_note` do config está com premissa vencida — e isso muda a
   rubrica desta própria rodada.** Ela diz "restam 8 dias até 11/set/2026
   (contado em 03/09)". Hoje é 14/09: o voo acabou há 3 dias, com veredito
   qualitativo de MATAR/PIVOTAR registrado em `a01212c`. A trava original
   (PROTOTIPAR/IMPLEMENTAR só se ajudar a CONVERSAR ou ALERTAR) fazia
   sentido *dentro* de um voo ativo medindo um scorecard; com o voo
   encerrado e a recomendação explícita do PM sendo "nenhuma linha nova de
   código" até os founders decidirem entre recomeçar do zero ou encerrar,
   a trava provavelmente deveria apertar mais, não relaxar — mas essa é
   uma decisão do Stefano, não uma inferência mecânica que eu deva aplicar
   sozinho. Apliquei a `verdict_note` como está escrita nesta rodada (ver
   itens "Em aberto" abaixo) porque é a única versão que tenho autorização
   pra usar, mas ela precisa ser reescrita ou explicitamente ratificada
   como ainda válida.
2. **O veredito MATAR/PIVOTAR do memo de fechamento não está refletido em
   `known_gaps` nem em `settled`.** Não fiz essa edição sozinho — é
   claramente um fato que o git mostra sem ambiguidade (o memo está
   commitado e mesclado), mas decidir COMO essa informação entra no
   config (vira `settled`? substitui um `known_gap`? fica só no memo?) é
   uma escolha de enquadramento, não uma cópia mecânica de texto.
