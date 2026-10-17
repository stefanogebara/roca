# Estado do repositório — Stevi (roca)

> Escrito pela nona passada do `/intel` em 2026-09-21. Janela: desde 07/09.
> HEAD `e01bf5d`, branch `master`.
> Reescrito a cada `/intel`. Fonte: o git e o banco, não o config.

## O parágrafo

**O voo de 60 dias fechou em 11/set com veredito MATAR/PIVOTAR qualitativo — e
nos 14 dias desde a última leitura deste arquivo, o repositório ficou em
silêncio quase total.** Dois commits de produto antes do fechamento (07 e
08/09, cosméticos), o memo de fechamento (12/09) e um memo de confirmação
três dias depois (14/09) dizendo que nada mudou. **Zero commits nos últimos 7
dias** (medido agora, 21/09) — não há um único commit desde 14/09. E o banco
confirma o mesmo silêncio do lado do produtor: a **última mensagem em todo o
sistema, de qualquer tipo de usuário, é de 2026-09-03** — 18 dias sem uma
linha em `messages`. O tripwire (commits > conversas com produtor) **não
dispara pela leitura literal** desta semana — mas só porque os dois lados da
conta são zero, não porque a campanha encontrou equilíbrio saudável. É a
primeira leitura de `/intel` deste projeto depois do encerramento oficial do
scorecard pré-registrado.

## O que shipou (07/09–21/09)

- **`76132fa` (07/09, antes do fechamento) + `328cd3d` (08/09) — últimos
  commits de produto da campanha.** Ajuste de copy da landing (a geada vira
  dado visível) e remoção de 4 imagens não usadas. Nenhum dos dois toca
  produto que o produtor sente; já estavam refletidos no `/intel` de 07/09.
- **`830e81c` — o `/intel` de 07/09**, já registrado no `INTEL.md` anterior.
- **`a01212c` (12/09) — memo de FECHAMENTO do voo de 60 dias.** Veredito: **N
  insuficiente pelo piso literal do scorecard** (coorte D7 vouchada nunca
  saiu de n=1, piso mínimo n≥15) **mas leitura qualitativa inequívoca de
  MATAR/PIVOTAR** nos critérios booleanos que não dependem de piso — todos em
  zero absoluto nos 60 dias: 0 parceiros com PIX real, 0 parceiro pagando de
  forma confiável, 0 corrente de indicação espontânea. Tripwire disparado na
  semana de fechamento com o pico de commits da campanha inteira (58,
  25 deles iteração visual da landing).
- **`e01bf5d` (14/09) — memo de confirmação, dia 64 de 60.** Três dias após o
  fechamento, nada mudou: 0 commits novos, 0 mensagem nova do único produtor
  real (Gaia Tech). O próprio memo recomenda rebaixar a cadência desta
  rotina (mensal ou disparada por evento) até que os founders decidam se a
  campanha recomeça do zero ou fica oficialmente encerrada.

## O que está em voo

- PR #4 (scorecard, 10/ago) segue DRAFT — sem novidade.
- A branch órfã de 76 commits (`origin/claude/xenodochial-moore-9dc540`)
  **segue presente no remoto e sem PR**, confirmada agora via fetch (HEAD
  `a642bb9`). Carrega as três correções que o próprio repo chama de
  críticas (poda de `farmer_alerts` que nunca rodou, alarme de empresa
  morto, vigia que caía junto com o vigiado) — código de confiabilidade
  escrito e nunca deployado, inalterado há semanas.
- **Decisão pendente que esta própria rotina de `/intel` colocou em jogo:**
  o memo de 14/09 propôs rebaixar a cadência do PM do Scorecard; o mesmo
  raciocínio se aplica a este `/intel` — ver "Divergências com o config".

## O que morreu

- **O voo de 60 dias em si.** Encerrado formalmente em 11/set (memo
  `a01212c`). Não é mais "campanha em andamento contra um scorecard" — é
  "campanha julgada, aguardando decisão dos founders sobre o que vem
  depois" (recomeçar do zero na aquisição vouchada, ou declarar encerrado).

## Medição de 21/09 — o que o banco diz agora

Consulta somente-leitura no projeto `ruuflfeqcmxpziernaop`, sem PII.

- **`users`: 30 no total — inalterado desde 07/09.** 20 `empresa`, 9 `teste`,
  **1 `produtor`** (Gaia Tech, inalterado desde 25/jul).
- **Última mensagem em `messages`, qualquer tipo de usuário: 2026-09-03.**
  18 dias corridos sem uma única linha nova na tabela — não é só o produtor
  que está em silêncio, é o sistema inteiro (nem teste, nem empresa
  escreveram desde então).
- **`farmer_alerts`: continua com exatamente 2 linhas**, as mesmas de 14/08,
  ambas `fire`, ambas de teste. Sem mudança há 5 semanas.
- **`applications`: 0**, inalterado — o caderno nunca foi usado.
- **`users.source ilike '%fecon%'`: continua zero.** Confirma o Arquivo de
  07/09 — a Fecon não deixou rastro, e não há evento de campo novo desde
  então para reabrir a pergunta.
- **`farms.municipio`: continua zero linhas preenchidas.**

## Estado do tripwire

| Lado | Número |
|---|---|
| Commits nos últimos 7 dias (14/09–21/09) | **0** |
| Mensagens de produtor (`kind='produtor'`) nos últimos 7 dias | **0** — medido no banco, não estimado |
| Última mensagem de qualquer tipo no sistema | **2026-09-03** (18 dias) |
| `farmer_alerts` | **2 linhas, sem mudança desde 14/08** |
| Dias desde o fechamento do voo (11/09) | **10** |

**Leitura qualitativa: o tripwire não dispara pela fórmula literal (0 > 0 é
falso) — mas isso não é o mesmo que "nos trilhos".** É ausência total de
atividade dos dois lados, não equilíbrio. O padrão das seis rodadas
anteriores era excesso de código sobre zero conversa; esta rodada é zero e
zero, porque a campanha foi formalmente encerrada e ninguém decidiu o
próximo passo. O `/intel` de hoje encontra o mesmo vácuo que o memo de
14/09 já registrava do lado do scorecard.

## Divergências com o config

Nenhuma foi aplicada sozinha. `bets` e `settled` só o Stefano mexe.

1. **A `verdict_note` do `intel.config.json` ficou desatualizada pelo
   próprio calendário que ela cita.** Ela diz "Restam 8 dias até 11/set/2026
   (contado em 03/09)" — essa janela fechou há 10 dias, com veredito
   MATAR/PIVOTAR qualitativo registrado em `a01212c`. A trava que ela impõe
   (PROTOTIPAR/IMPLEMENTAR só se ajudar a CONVERSAR ou ALERTAR) continua
   fazendo sentido enquanto não há decisão de recomeço — mas o texto em si
   não reflete mais o estado real do projeto. Fica como pergunta pro
   Stefano, não como edição minha: atualizar a nota para refletir "pós-voo,
   aguardando decisão de recomeço" (mantendo a mesma trava de fundo), ou
   deixar como está até a decisão de recomeçar/encerrar sair?
2. **A cadência semanal desta própria rotina (`/intel`) e a do PM do
   Scorecard convergem para o mesmo problema.** O memo de 14/09 já propôs
   rebaixar o PM do Scorecard para mensal/por evento; com o mercado externo
   não mudando de forma que force decisão (nenhum candidato desta rodada
   passou de DISCUTIR — ver `INTEL.md`) e o repositório em silêncio total,
   a mesma pergunta vale para o `/intel`: rodar toda semana sem sinal novo
   do lado do produto é o mesmo tipo de ruído que a rubrica pede para evitar
   do lado do mercado. Não mudo a cadência sozinho — só registro o paralelo.
