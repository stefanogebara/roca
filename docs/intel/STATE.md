# Estado do repositório — Stevi (roca)

> Escrito pela quinta passada do `/intel` em 2026-11-09. Janela: desde
> 2026-09-07 (última passada — **63 dias de lacuna**, a maior da história
> desta rotina).
> HEAD `f1058a1`, branch `master`.
> Reescrito a cada `/intel`. Fonte: o git e o banco, não o config.

## O parágrafo

**O voo de 60 dias fechou em 11/set com veredito qualitativo
MATAR/PIVOTAR, e os 59 dias seguintes — incluindo os 63 dias em que este
`/intel` não rodou — não produziram uma única linha de engenharia: os 12
commits desde a última passada são 10 memos semanais do PM do Scorecard,
mais o próprio `/intel` de 07/09 e dois commits de site que antecedem o
fechamento.** Não há voo em curso. O que existe desde 11/set é uma rotina
de medição (o memo semanal do scorecard) relatando, toda semana, a mesma
leitura: zero usuários novos, zero mensagens de produtor, zero disparo de
alerta — e pedindo, há 8 semanas consecutivas sem resposta, para reduzir a
própria cadência. Este `/intel` reaparece num momento em que a pergunta
não é mais "o que mudou no mercado", é "alguém está olhando o rumo do
projeto" — o gap de 63 dias nesta própria rotina é, em si, um dado do
mesmo tipo que o tripwire mede.

## O que shipou (31/08–11/set — antes do fechamento)

Nada novo além do que o `STATE.md` de 07/09 já registrou: os 25 commits de
iteração de landing (v9→v30), o kit da Fecon (zero conversão), a
diversificação de gateway. Ver a versão anterior deste arquivo no
histórico do git para o detalhe — não repito aqui porque nada disso mudou
desde então.

## O que está em voo

**Nada.** O gate S4 passou há mais de 90 dias, a janela de 60 dias fechou
há 59 dias (medido no memo de 09/nov), e não há nenhum branch, PR ou
commit de produto aberto além da branch órfã já conhecida
(`claude/xenodochial-moore-9dc540`, 76 commits nunca mesclados — confirmada
ainda presente no remoto, sem mudança desde 07/09).

## O que morreu

**A campanha de validação de 60 dias.** `a01212c` (12/set) registra o
veredito: pelo piso literal do scorecard pré-registrado (coorte D7 ≥ n=15)
o N é insuficiente para decidir — mas todos os critérios **booleanos** que
não dependem de piso de n (≥3 parceiros com PIX, ≥1 parceiro pagando
confiável, ≥1 corrente de indicação espontânea) ficaram em **zero absoluto**
nos 60 dias inteiros, o que o próprio memo lê como MATAR/PIVOTAR
qualitativo. Recomendações do fechamento: encerrar a prospecção fria B2B
no formato atual, decisão explícita sobre Gaia Tech/Michel, e — se a
campanha continuar — recomeçar do zero na aquisição vouchada, sem herdar o
histórico atual como prova de nada.

## Medição de 09/11/2026 — o que o banco diz agora

Consulta somente-leitura no projeto `ruuflfeqcmxpziernaop`, sem PII (via
Supabase MCP, nesta própria sessão — não copiado do memo do scorecard).

- **`messages` (produtor, `direction='in'`, últimos 7 dias): 0 mensagens, 0
  produtores distintos.** Confirmado direto no banco por este `/intel`, não
  herdado do memo.
- Os números de `users` (30, inalterado), `farmer_alerts` (2, inalterado
  desde 14/08) e golden set (0/38 `verified_by`) batem com a última leitura
  do memo do PM do Scorecard (09/nov) — não há motivo para rodar de novo as
  mesmas queries e arriscar um número diferente por ruído; a leitura
  convergente dos dois instrumentos independentes é, em si, o dado.

## Estado do tripwire

| Lado | Número |
|---|---|
| Commits nos últimos 7 dias (`git log --since='7 days ago'`) | **1** — `f1058a1`, o memo do scorecard de 09/nov. **Zero commits de engenharia.** |
| Conversas de produtor externo real nos últimos 7 dias | **0** — medido direto no banco (`messages` × `users.kind='produtor'` × `direction='in'`), não estimado |
| Dias desde o fechamento do voo (11/set) | **59** |
| Dias de lacuna desta própria rotina (`/intel`) | **63** |

**Leitura literal: 1 commit > 0 conversas → tripwire disparado.** **Leitura
pelo espírito da regra (engenharia real vs. campo, convenção usada pelo
próprio `STATE.md` desde 24/08 e por todos os memos do scorecard pós-
fechamento): 0 commits de engenharia × 0 conversas → não disparado.** Registro
os dois porque o instrumento pede medição, não interpretação — mas a leitura
qualitativa importa menos esta semana que o fato de fundo: **o projeto está
parado dos dois lados há dois meses**, e a pergunta que fica não é mais
sobre código excessivo, é sobre se a pausa é deliberada (aguardando decisão
dos founders sobre recomeço/encerramento) ou é a própria decisão, por
omissão.

## Divergências com o config

Nenhuma foi aplicada sozinha.

1. **A `verdict_note` do `intel.config.json` está desatualizada e descreve
   uma realidade que não existe mais.** Ela fala de "restam 8 dias até
   11/set/2026" e trava PROTOTIPAR/IMPLEMENTAR em função de um voo em
   andamento. O voo fechou há 59 dias, com veredito MATAR/PIVOTAR
   qualitativo. A rubrica deste `/intel` continua herdando uma urgência que
   não é mais real — o que, nesta rodada, só reforça o teto em DISCUTIR
   (ver seção "Em aberto" do `INTEL.md`), mas merece uma `verdict_note`
   nova, escrita pelo Stefano, que diga o que vale **depois** de um
   MATAR/PIVOTAR: recomeçar, pivotar, ou arquivar o projeto. Não editei —
   é decisão de rumo, não fato mecânico do git.
2. **Os `known_gaps` do config predatam o fechamento e não mencionam o
   veredito nem o gap de 63 dias.** Vários (tração em 1 usuário, branch
   órfã, deriva de schema) continuam factualmente válidos — só não citam
   que agora vivem num projeto sem voo em curso. Não reescrevi `known_gaps`
   porque a lista inteira precisaria de uma passada de curadoria que é
   trabalho de julgamento, não mecânico.
3. **O achado do PM do Scorecard sobre `Corpal Tratores`** (loop de eco
   automático em 03/08, 836×2 mensagens em 4h15, risco não verificado de
   `quality_rating`/`messaging_limit_tier` da Meta) não é item de intel
   externo — é achado operacional de outra rotina. Não vira entrada aqui;
   fica mencionado porque toca a mesma pergunta de fundo (alguém está
   olhando o sistema?) que motiva este `/intel` reaparecer depois de 63
   dias.
