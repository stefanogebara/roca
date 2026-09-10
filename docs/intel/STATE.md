# Estado do repositório — Stevi (roca)

> Escrito pela terceira passada do `/intel` em 2026-09-07. Janela: desde 31/08.
> HEAD `96482cf`, branch `master`.
> Reescrito a cada `/intel`. Fonte: o git e o banco, não o config.

## O parágrafo

**Restam 4 dias até 11/set — o voo de 60 dias termina nesta semana — e a
semana com mais commits da campanha inteira (58) teve zero mensagens de
produtor.** 40 dos 58 commits não tocam `web/`; os outros 25 são iterações
de uma única página (landing v9 → v30, mais dois checkpoints `wip`) — mais
de vinte rodadas de crítica visual num único arquivo, na mesma semana em
que a Fecon (1–3/09, o único evento de campo dentro da janela de decisão)
gerou **zero** usuários novos com token `#fecon` ou `#fecon-cartaz`, apesar
do kit ter sido enviado dias antes (`64152d6`, `527120b`). Um único usuário
novo entrou no banco desde 31/08 — e é `kind='empresa'`, não produtor. O
tripwire (commits > conversas com produtor) dispara pela quarta rodada
seguida, e desta vez o excesso não é nem código de produto: é design.

## O que shipou (31/08–07/09)

- **Diversificação de gateway fechada (PRs #13–15, já registrada na rodada
  anterior; mesclada nesta janela).** `#13` pin `google-ai-studio` +
  fallback direto; `#14` chave reserva do OpenRouter; `#15` alerta aos
  fundadores quando o resgate dispara — motivado por achado da própria
  verificação (`401 "User not found"` não contava como erro de crédito).
- **`ce1590c` + `58a9393` — Vitória ganha munição citável.** Pergunta de
  custo de produção ancora no boletim público do Campo Futuro (CNA/Senar);
  estudo da FDC vira citação na conversa (não no template) com trava contra
  atribuir número a cooperativa nominal.
- **`64152d6` + `527120b` — kit e regra de vouch da Fecon.** Token
  `#fecon` (houve conversa) separado de `#fecon-cartaz` (cartaz sozinho),
  saudação que reconhece quem veio da feira. Shipado ANTES da feira
  (1–3/09). **Resultado: zero linhas em `users.source ilike '%fecon%'`.**
  Não há como saber pelo repo se o fundador foi e não usou o kit, ou não
  foi — mas o código ficou sem uso na única janela em que serviria.
- **`09ed2ce` + `fa24c86` — onboarding mais curto.** Botão nativo de
  localização substitui pedir coordenada por texto; cultura em três toques;
  saudação enxuta. Ajuda diretamente CONVERSAR COM PRODUTOR — mas ainda sem
  produtor novo para testar.
- **`0c4719b` → `232a929` (25 commits) — refação completa da landing.**
  Sistema de design do zero, sete fotos novas, OG image, páginas
  `/verificar` e painel, cards de WhatsApp, card "quem responde", e então
  **v9 a v30**: vinte e três iterações visuais da mesma home em cerca de
  quatro dias, sem que nenhuma tenha ido a um produtor. Landing não move
  D7 nem alerta — é a categoria que o `verdict_note` teto em DISCUTIR, e
  aqui ela consumiu mais commits do que qualquer feature da campanha.
- **`ff679d9` — o `/intel` de 03/09** mediu o denominador real (29 usuários,
  1 produtor, 3 farms com pin, todas `kind='teste'`) direto no
  `intel.config.json` (`known_gaps`), sem passar pelo `STATE.md` — por isso
  este arquivo ficou defasado seis dias até agora.

## O que está em voo

- Nada novo além do que já estava: PR #4 (scorecard 10/ago) segue DRAFT; a
  branch órfã de 76 commits (`claude/xenodochial-moore-9dc540`) segue sem
  PR, confirmada ainda presente no remoto (`a642bb9`).

## O que morreu

Nada nesta janela.

## Medição de 07/09 — o que o banco diz agora

Consulta somente-leitura no projeto `ruuflfeqcmxpziernaop`, sem PII.

- **`users`: 30 no total (29 em 03/09 → 30 agora) — o único novo é
  `kind='empresa'`.** Zero produtor novo, zero teste novo. `produtor` segue
  em **1** desde o início de agosto.
- **Mensagens desde 31/08, por `kind`: `empresa` 1 mensagem (03/09),
  `teste` 8 mensagens (03/09). `produtor`: ZERO.** O único produtor da base
  não mandou uma mensagem sequer na semana com mais commits da campanha.
- **`farmer_alerts` continua com exatamente 2 linhas**, as mesmas de 14/08,
  ambas `fire`, ambas de teste. Nenhum alerta novo, para ninguém, desde a
  medição de 24/08.
- **`farms.municipio`: continua zero linhas preenchidas.** O recurso de
  1.836 municípios (`d86a8a2`, rodada anterior) segue sem nenhum alvo real
  para resolver.
- **`users.source ilike '%fecon%'`: zero linhas.** A Fecon aconteceu
  (1–3/09) dentro da janela e não deixou rastro no banco.

## Estado do tripwire

| Lado | Número |
|---|---|
| Commits nos últimos 7 dias | **58** (40 fora de `web/`, 25 só de iteração de landing) |
| Mensagens de produtor (`kind='produtor'`) desde 31/08 | **0** — medido no banco, não estimado |
| Usuários novos desde 31/08 | **1**, e é `kind='empresa'` |
| `farmer_alerts` | **2 linhas, sem mudança desde 14/08** |
| Novos usuários via `#fecon`/`#fecon-cartaz` | **0**, apesar do kit shipado e da feira ter ocorrido na janela |
| Dias restantes até 11/set | **4** |

**Leitura qualitativa: o tripwire não só disparou — ele mudou de forma.**
Nas rodadas anteriores o excesso era código de produto motivado por bug
real (vazio sanitário, filtro de kind). Nesta janela, 25 dos 58 commits
são retrabalho estético de uma página que não move nenhuma das duas
métricas do scorecard (D7 vouchado, parceiro pagando). É "o conserto nunca
é mais código" na sua forma mais literal: a página já funcionava em v9.

## Divergências com o config

Nenhuma foi aplicada sozinha. `bets` e `settled` só o Stefano mexe.

1. **A pergunta da Fecon (`INTEL.md`, aberta 24/08) nunca foi respondida no
   repo, e a janela em que fazia diferença já fechou.** A feira era
   1–3/09; hoje é 07/09. Não há decisão registrada em `settled` nem
   qualquer commit que confirme presença. O banco diz que, presença ou
   não, **zero pessoas escanearam** com token de Fecon. Isso não é mais
   uma pergunta em aberto — é um resultado, e vira Arquivo nesta rodada.
2. **A deriva de migration segue sem entrada nova no `known_gaps`,** mas
   também sem repetição nesta janela — nenhum commit de migration na
   janela mexeu em `farms.municipio` ou schema. Sem novidade a registrar
   aqui além do que já está no config.
