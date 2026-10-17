# Estado do repositório — Stevi (roca)

> Escrito pela quinta passada do `/intel` em 2026-09-28. Janela: desde 2026-09-07
> (data do `STATE.md` anterior).
> HEAD `10aa0aa`, branch `master`.
> Reescrito a cada `/intel`. Fonte: o git e os memos do repo, não o config.

## O parágrafo

**O voo de 60 dias fechou em 11/set com veredito qualitativo MATAR/PIVOTAR
(N insuficiente pelo piso literal do scorecard, mas todos os critérios
booleanos — parceiros pagantes, indicação espontânea — zerados por 60 dias
inteiros) — e são 17 dias de silêncio quase total desde então.** Só 6 commits
tocaram este repo nos 21 dias entre 07/09 e hoje: dois ajustes finais de
landing (07–08/09), a rodada de `/intel` de 07/09, o memo de FECHAMENTO
(12/09), o memo de 14/set e o memo de hoje (28/09). Nenhuma linha de código
de produto desde 08/09. O tripwire não disparou esta semana — mas por
ausência total dos dois lados (0 commits x 0 conversas), não por disciplina:
o próprio memo de hoje chama isso de "confirmação de pausa total", não sinal
de saúde.

## O que shipou (07/09–28/09)

- **`76132fa` + `328cd3d` (07–08/09) — últimos ajustes de landing antes do
  fechamento.** Reversão para o design anterior (foto em tela cheia, seções
  pinadas) que o Stefano preferiu, correção de divergência entre dois números
  de geada na mesma página, cartaz do balcão com QR real, limpeza de 4
  imagens órfãs. Já registrados como parte da leitura de 07/09.
- **`830e81c` — a rodada de `/intel` de 07/09** (26 itens, tripwire disparado,
  Fecon fecha em zero). Sem novidade além do que o `INTEL.md` já registra.
- **`a01212c` (12/09) — memo de FECHAMENTO do voo de 60 dias.** Veredito
  qualitativo MATAR/PIVOTAR: os cinco critérios booleanos do scorecard
  (parceiros PIX, indicação espontânea, latch, etc.) ficaram em zero
  absoluto por 60 dias — sem precisar de piso de n para serem lidos. Único
  produtor externo real (Gaia Tech) nunca reengajou desde 17/07. Recomendação
  explícita: parar toda engenharia nova (landing, prospecção, confiabilidade)
  até 3 decisões humanas saírem do papel.
- **`e01bf5d` (14/09) — memo de confirmação, dia 64.** Nada mudou em 3 dias;
  tripwire tecnicamente disparado mas por commits anteriores ao fechamento.
  Já recomendava reduzir a cadência do próprio memo para mensal/por evento.
- **`10aa0aa` (hoje, 28/09) — memo de confirmação, dia 78 (17 dias após o
  fechamento).** Zero commits em 14 dias, zero mensagens novas em qualquer
  tabela do produto. As 3 decisões seguem paradas: Gaia Tech/Michel (73
  dias), CNPJ (65 dias), assinatura do golden set (65 dias). O memo pede,
  pela segunda vez, para desarmar a própria cadência semanal.

## O que está em voo

Nada. A branch órfã de 76 commits (`claude/xenodochial-moore-9dc540`) segue
sem PR — não verificada nesta rodada por não ter mudado desde 07/09.

## O que morreu

O voo de 60 dias em si — encerrado formalmente em 11/09, veredito qualitativo
MATAR/PIVOTAR registrado em `.claude/plans/memos-scorecard/README.md`.

## Estado do tripwire (medido hoje)

| Lado | Número |
|---|---|
| Commits nos últimos 7 dias | **1** (`git log --since='7 days ago'` — só o memo de hoje) |
| Conversas de produtor externo na semana | **0** — já medido pelo memo do PM do Scorecard de hoje (`10aa0aa`), query fresca em `messages`; não remedido por este agente por falta de acesso de escrita ao papel de leitura de banco nesta rotina |
| Leitura | **Não disparado** — mas por ausência total dos dois lados, não por disciplina. Zero sinal de campo desde 17/07 continua de pé. |

## Divergências com o config

Nenhuma foi aplicada sozinha. `bets` e `settled` só o Stefano mexe.

1. **`intel.config.json.verdict_note` está desatualizada e precisa de revisão
   do Stefano.** O texto diz "Restam 8 dias até 11/set/2026 (contado em
   03/09)" — mas o voo fechou há 17 dias, com veredito qualitativo
   MATAR/PIVOTAR já registrado no repo. A trava de PROTOTIPAR/IMPLEMENTAR
   (exigir CONVERSAR ou ALERTAR) continua fazendo sentido como regra de
   triagem, mas a referência a "dias restantes" de um voo já encerrado é
   ruído para quem ler o config a partir de agora.
2. **`known_gaps` não reflete o fechamento do voo nem os 3 itens parados
   há 65–73 dias** (Gaia Tech/Michel, CNPJ, assinatura do golden set) — eles
   vivem só nos memos do PM do Scorecard, não no config. Proponho ao Stefano
   mover essas três pendências para `known_gaps` ou para uma seção própria,
   já que são as decisões que travam qualquer recomeço.
