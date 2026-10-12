# Estado do repositório — Stevi (roca)

> Escrito pela sexta passada do `/intel` em 2026-10-12. Janela: desde 05/10.
> HEAD `b0c354d` (merge do memo de 12/out sobre o `/intel` de 05/10), branch `master`.
> Reescrito a cada `/intel`. Fonte: o git e o banco, não o config.

## O parágrafo

**Nada mudou no produto — mas o próprio pipeline de `/intel` virou o achado
da semana.** Esta rodada descobriu que as últimas **quatro** passadas
(14/09, 21/09, 28/09, 05/10) rodaram, leram a fundo, pontuaram e abriram PR
— e nenhuma foi revisada ou mesclada. Master ficou congelado em `docs/intel/`
desde 07/09 enquanto quatro rodadas inteiras de trabalho (cada uma, sem saber
da outra, porque cada uma partiu do mesmo master parado) se acumularam como
PRs de rascunho sem dono. Ver a seção dedicada abaixo. No produto, zero
mudança: `users` total **30**, produtor externo real **1** (Gaia Tech, sem
mensagem nova há **87 dias**), zero mensagem de qualquer tipo nos últimos 7
dias — primeira leitura, segundo o memo do PM do Scorecard de 12/out, com
silêncio absoluto dos dois lados (nem o próprio Stefano testando apareceu).
O voo de 60 dias fechou em 11/set com veredito MATAR/PIVOTAR qualitativo
(`.claude/plans/memos-scorecard/README.md`, commit `a01212c`); são **31
dias** desde então, dia **91 de 60**.

## Achado desta rodada — quatro `/intel` e dois memos presos sem revisão

Levantamento feito via GitHub (`list_pull_requests` + `get_comments`), não
só git log — por isso ficou invisível para os memos do PM do Scorecard, que
só leem `git log` em `master`.

| PR | Conteúdo | Aberta em | Dias parada | Comentário humano |
|---|---|---|---|---|
| #4 | memo PM — semana de 10/ago | 10/ago | **64** | nenhum |
| #31 | memo PM — semana de 07/set (dia 57) | 08/set | **34** | nenhum |
| #32 | `/intel` de 14/set | 14/set | **28** | nenhum |
| #33 | memo PM — semana de 21/set | 21/set | **21** | nenhum |
| #34 | `/intel` de 21/set | 21/set | **21** | nenhum |
| #35 | `/intel` de 28/set | 28/set | **14** | nenhum |
| #36 | `/intel` de 05/out | 05/out | **7** | 1 (Stefano, sobre bloqueio de deploy da Vercel — não sobre o conteúdo) |

Nenhuma das sete PRs tem revisão, aprovação ou rejeição humana sobre o
conteúdo. O único comentário de Stefano em qualquer uma delas (`#36`)
responde ao bot da Vercel sobre "Deployment was blocked", não aos quatro
itens DISCUTIR daquela rodada. Os memos do PM do Scorecard (14/09, 28/09,
05/10, 12/10) relataram repetidamente "zero commit de produto desde o
fechamento" — leitura correta de `git log` em `master`, mas que escondeu que
havia, sim, trabalho sendo produzido: só não estava chegando a lugar nenhum
porque cada `/intel` partia do mesmo `master` parado e nunca via o anterior.

**O que esta rodada fez para não ser a oitava PR perdida na mesma pilha:**
em vez de ramificar de `master` (que seria a oitava rodada cega), esta
branch (`intel/2026-10-12`) parte de `origin/intel/2026-10-05` — a mais
recente das quatro — com o `master` atual mesclado em cima. O diff final
desta PR contra `master` já contém o trabalho das quatro rodadas combinado
com o incremento desta semana. **Mesclar esta PR resolve #32, #34, #35 e #36
de uma vez** — proponho ao Stefano fechá-las como superadas por esta, em vez
de revisar as cinco separadamente. `#4`, `#31` e `#33` são memos do PM do
Scorecard (routine diferente, não mexo no conteúdo), mas ficam aqui
registradas porque são a mesma categoria de problema: trabalho automatizado
que o founder nunca chegou a ver. Histórico à parte, note-se que dois memos
do PM nunca entraram no `README.md` mesclado (`#31`, de 07/set, e `#33`, de
21/set) — a linha do tempo mesclada salta do FECHAMENTO direto para 14/09 e
depois 28/09, sem o de 07/09 nem o de 21/09. Não decido por isso; registro.

## O que shipou (05/10–12/10)

- **`6c3cc41` (12/10) — quinto memo do PM do Scorecard pós-fechamento.**
  Mesma leitura de sempre ("nada mudou"), mas com uma peça nova: é a
  **quinta** vez pedindo para reduzir a cadência da própria rotina (pedida
  em 14/09, 28/09, 05/10, e agora 12/10 — 28 dias sem resposta), e confirma
  que a tentativa técnica de editar a Routine em 05/10 ficou bloqueada
  (criada via painel/API, só o Stefano pode editar — link de 1 clique
  deixado no próprio memo: `https://claude.ai/code/routines/trig_01JFWNd7xgBCeJ2sydbZeiss`).
- Nenhum commit de produto ou engenharia. Desde `328cd3d` (08/09) — **34
  dias** — zero linha de código fora de memo/intel.

## O que está em voo

- Nada. Mesmo estado da rodada anterior: decisão dos founders pendente
  sobre recomeçar (do zero) ou encerrar formalmente.
- A branch órfã de 76 commits (`claude/xenodochial-moore-9dc540`) continua
  presente no remoto (confirmado via `git ls-remote`), sem PR.

## O que morreu

- Nada de novo nesta janela — a cadência do memo do PM já estava morta na
  prática desde a rodada anterior (continua rodando por falta de clique, não
  por decisão de valor).

## Medição de 12/10 — o que o banco diz agora

Consulta somente-leitura no projeto `ruuflfeqcmxpziernaop`, sem PII. Dois
números reconfirmados por query direta nesta própria rodada (não só citados
do memo do PM):

- **Mensagens nos últimos 7 dias, de qualquer `kind`: ZERO** —
  `select count(*) from messages where created_at > now() - interval '7
  days'` devolveu `0`. Primeira vez que nem o próprio Stefano testando
  aparece na janela (o memo do PM confirma o mesmo número, chegando por
  caminho próprio).
- **`users` total: 30**, inalterado desde 03/09. Produtor externo real
  segue em **1** (Gaia Tech) — **87 dias** sem mensagem nova (17/jul).
- `farmer_alerts`: **2** linhas, as mesmas de 14/08, ambas teste.
- Farms com pin pertencentes a `kind='produtor'`: **0** (as 4 existentes são
  teste/empresa).
- Golden set: **38/38 casos com `verified_by` nulo**, reconfirmado pelo memo
  do PM linha a linha.
- Prospecção B2B: **367** linhas, **0 envios desde 07/ago** (66 dias) —
  descoberta roda em segundo plano, disparo parado.

## Estado do tripwire

| Lado | Número |
|---|---|
| Commits nos últimos 7 dias (`git log --since='7 days ago'`) | **1** — o próprio commit do memo de PM de 12/10, só docs |
| Conversas de produtor externo real na mesma janela | **0** — confirmado por query direta em `messages` |
| Dias desde o fechamento do voo (11/09) | **31** |

**Lido ao pé da letra, 1×0 dispara. Pela convenção já usada nas três rodadas
anteriores deste memo** (contar só commit de ENGENHARIA competindo com
campo, não o registro do próprio instrumento de medição) **, é 0×0 — não
dispara.** Registro os dois números: quem quiser aplicar a regra sem a
interpretação tem o dado cru.

## Divergências com o config

Nenhuma foi aplicada sozinha além do mecânico já feito na rodada de 05/10
(fato do fechamento em `settled`, confirmado pelo git sem ambiguidade).

1. **A `verdict_note` está mais desatualizada do que nunca.** Ainda diz
   "restam 8 dias até 11/set/2026 (contado em 03/09)" — mas isso descreve um
   voo que fechou há **31 dias**. Esta é a terceira rodada seguida (07/09,
   05/10, agora 12/10) sinalizando a mesma divergência sem que o Stefano a
   tenha reescrito. Não edito sozinho porque a trava de teto que a nota
   carrega (PROTOTIPAR/IMPLEMENTAR só se ajudar a CONVERSAR ou ALERTAR)
   ainda parece certa — talvez até devesse apertar mais, não afrouxar — mas
   isso é leitura, não fato mecânico.
2. **Pergunta nova, fora do mecânico:** a rotina do `/intel` (routine
   `trig_01Rc3pqfVqSpfpgXLaQsV3f4`) está no mesmo regime que o memo do PM já
   documentou como problema — seis rodadas seguidas pós-fechamento sem
   nenhum PROTOTIPAR, quatro delas sem revisão alguma. Vale a mesma pergunta
   que o PM do Scorecard já fez sobre a própria rotina: reduzir cadência
   (mensal ou por evento) até a decisão de recomeçar/encerrar ser tomada?
   Diferente da rotina do PM, não investiguei se esta Routine tem o mesmo
   bloqueio de permissão — fica como pergunta aberta, não como fato
   confirmado.
