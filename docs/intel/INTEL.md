# Intel — Stevi (repo: roca)

> Atualizado por `/intel`. Config em `intel.config.json`, rubrica em
> `.claude/skills/intel/references/rubric.md`.
> Índice de dedup: `docs/intel/seen.jsonl`. Estado do repo: `docs/intel/STATE.md`.
>
> **Primeira passada (2026-08-24), com o repositório aberto.** O feed do resumo matinal
> veio **vazio** para este projeto, então tudo abaixo saiu de busca própria: cinco scouts,
> ~55 candidatos brutos, seis lidos a fundo por um analista cada.
>
> **Nada virou spike.** Zero PROTOTIPAR, zero IMPLEMENTAR. Isso não é falha da varredura —
> é a `verdict_note` funcionando: este projeto está sob flight plan com tripwire, e item
> que só adiciona capacidade tem teto em DISCUTIR. Restam **18 dias** até 11/set.

## Em aberto — precisa de decisão do Stefano

### [DISCUTIR 10/15] Você vai à Fecon, de 1 a 3 de setembro?
**Data:** 2026-08-24 · **Eixos:** P3 A2 D1 E1 L3
**Fonte:** [21ª Feira Cocatrel de Negócios](https://equipepositiva.com/21a-feira-cocatrel-de-negocios-sera-de-1o-a-3-de-setembro/)

**O que é:** a Cocatrel — 2ª maior cooperativa de café do Brasil, atendendo cafeicultores
em 125 municípios do Sul de Minas — roda a 21ª Fecon de 1 a 3/09 no Espaço Cocatrel em
Três Pontas e, simultaneamente, em todas as filiais. O formato não é palco, é **balcão**:
agrônomos e técnicos da própria cooperativa fazendo atendimento um a um, ao lado de
atualização cadastral, compra de máquina com condição especial e estandes de banco.

**Por que toca este projeto:** é o beachhead declarado — café, Sul de Minas — e a Cocatrel
já é fixture nominal de ICP no repo (`tests/prospect-icp.test.ts` usa a cooperativa como
caso que **não** se descarta). E o `STATE.md` registra 190 commits em 30 dias contra zero
conversas de produtor externo. É o único encontro do beachhead dentro da janela de decisão,
e o último capaz de gerar leitura D7 — uma coorte de 1–3/09 fecha D7 em 8–10/09.

**Por que NÃO virou spike, e isso importa:** o kit de aquisição já está inteiro e sem uso.
`api/qr.ts` gera pôster com `?text=` customizável, `api/_lib/growth.ts` já lê `#fecon` de
material impresso, `api/vcard.ts` entrega o cartão, `users.kind` já nasce `produtor`. O
único ajuste de código concebível é cosmético: `fecon` não está em `ORIGEM_SEM_NOME`, então
a saudação sairia "Que bom que o Fecon te mandou aqui". Uma linha. **Escrever essa linha e
chamar de progresso seria o tripwire exatamente de novo.**

**O que a fonte não prova:** `cocatrel.com.br/fecon` devolveu 403 em duas tentativas —
programação, horário, credenciamento e abertura a não-cooperado **não estão confirmados**.
Zero público declarado, zero número auditável.

**A pergunta:** você vai? E antes disso, duas travas de porta que só se resolvem por
telefone hoje:
1. Ligar na Cocatrel e confirmar se não-cooperado entra e se dá pra circular com cartão e
   QR sem ser expositor.
2. Decidir se entrega cartão com o **+1** — `api/_lib/waNumber.ts` ainda tem
   `DEFAULT_PUBLIC_WA_NUMBER = '19705509125'`, e o pós-mortem de 04/ago culpou
   "+1 desconhecido" pelo padrão de golpe. Cartão com número americano para cafeicultor de
   60 anos é a fricção que o próprio repo nomeou.

E a pergunta de fundo, que muda o que o memo do dia 60 tem direito de afirmar: um produtor
que escaneia o QR no seu estande conta como **vouchado** na coorte do gate (que precisa de
n≥15 e hoje tem n=1), ou como a "população separada de cartão/armazém" que o flight plan
pré-registrou em 13/jul? Se for população separada, a Fecon não move o número que decide.

---

### [DISCUTIR 10/15] O primeiro alerta sai às 08:00 para todo mundo?
**Data:** 2026-08-24 · **Eixos:** P2 A2 D2 E2 L2
**Fontes:** [STEPS — push auto-disparado, Douyin](https://arxiv.org/abs/2608.01949) · [Just-in-time adaptive interventions, OzCHI](https://arxiv.org/abs/2608.09294)

**O que é:** o STEPS troca o paradigma de push por auto-disparo — dois agentes decidem
*se* enviar e *quando* se reinvocar, com recompensa que penaliza explicitamente o usuário
**desligar a permissão de push**. A/B online de 14 dias, aleatorizado por dispositivo,
contra duas baselines nomeadas, sobre logs de 6+ meses de mais de 1 bilhão de usuários:
+0,28% em dias ativos e **−1,91% na taxa de desativação da permissão**. O paper de OzCHI
ataca o mesmo movimento pelo lado qualitativo e nomeia o "descompasso ecológico": slot
vazio na agenda não é receptividade — participantes recusaram janelas algoritmicamente
válidas por cansaço. Donde a heurística de pegar carona numa rotina existente em vez de
criar horário próprio.

**Por que toca este projeto:** a `bets[1]` diz que notificação proativa no momento certo
vale mais que resposta boa sob demanda. Hoje o `vercel.json` tem `0 11 * * *` — que em UTC
é **08:00 BRT para todo mundo**, os três tipos de alerta no mesmo horário. E a disciplina
de horário **já existe neste repo, do lado errado do funil**:
`api/_lib/prospect/core.ts` tem `BRT_OFFSET_MIN`, `HOURS_START = 9`, `HOURS_END = 18` e
gate de dia útil — para falar com **empresa**. O produtor recebe geada e queimada às oito
da manhã.

**O que a fonte não prova:** o Douyin otimiza timing sobre trajetória de bilhões; a Stevi
tem 1 usuário externo real que mandou 1 mensagem em 17/jul. O OzCHI é 16 participantes em
laboratório, sem desfecho, em atividade física. **Nenhum dos dois mecanismos roda com esse
n** — a transferência é um salto, não uma extensão.

**A pergunta:** quando o canal destravar, o primeiro alerta de geada sai às 08:00 para
todo mundo, ou você segura até saber a que hora **este** produtor lê o WhatsApp? Com n=1 e
`messages.intent` vindo NULL — o que zera o cálculo de hábito em `api/_lib/cohort.ts` —
aprender o horário é impossível. A escolha real é entre um horário **argumentado por tipo
de alerta** (geada na véspera à noite, quando ainda dá pra cobrir o café; queimada na hora,
sem janela; vazio sanitário em horário comercial) e continuar com um horário único para os
três. Qual dos dois — e você aceita tomar essa decisão sem dado?

---

### [DISCUTIR 10/15] A partir de 01/10 não sobra caminho gratuito no WhatsApp
**Data:** 2026-08-24 · **Eixos:** P3 A2 D3 E2 L2
**Fonte primária:** [Meta, "Pricing for non-template messages"](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages)

**O que é:** a doc da Meta afirma verbatim que *"Effective October 1, 2026, Meta will
charge for service messages, which have not been charged since November 2024"* e que
passará a cobrar utility enviada dentro da janela aberta de 24h. Tarifas por país saem até
**01/09/2026**.

**Nota de método:** dois scouts se contradisseram sobre isto. A explicação é que a
**doc da Meta se contradiz em duas páginas vivas** — a página-mãe `/whatsapp/pricing` não
foi atualizada e ainda diz que utility em janela aberta é grátis. Quem ler só ela conclui o
oposto. Os fornecedores de BSP estão certos.

**O que a exposição realmente é, calculada no código:** o alerta **não encarece**.
`alertSendPlan()` em `api/_lib/alerts.ts` só devolve `freeform` se o produtor falou nas
últimas 24h; todo alerta proativo real cai em `template`, que já é pago hoje. Delta: zero.
O que encarece é o caminho conversacional — `api/_lib/pipeline.ts` emite um `adapter.send`
por turno. Pelo desenho, ~20 mensagens por produtor por mês; à tarifa utility BR corrente
reportada por BSP, ~R$ 0,75 por produtor por mês. **Irrelevante como custo.**

**O risco real não é preço, é continuidade de cobrança.** O `STATE.md` registra que o canal
inteiro morreu por **billing** (#131042) em julho, não por engajamento. A partir de 01/10
uma falha de pagamento deixa de silenciar só o alerta e passa a silenciar **toda** resposta
da Stevi.

**A pergunta:** a conta de billing da WABA está com método de pagamento válido e fundeado
hoje, e alguém olha isso semanalmente? A tarifa BR que dimensiona tudo sai em 01/09, dentro
dos 18 dias que restam. *(Rebaixado de PROTOTIPAR pela `verdict_note`: 01/10 cai vinte dias
**depois** do fim do voo.)*

---

### [DISCUTIR 9/15] Em 30/08 o cron tenta o alerta de vazio de MT sozinho
**Data:** 2026-08-24 · **Eixos:** P3 A2 D1 E2 L1
**Fonte:** [Embrapa — calendário do vazio sanitário](https://www.embrapa.br/soja/ferrugem/vaziosanitariocalendarizacaosemeadura) (Portaria SDA/MAPA 1.579/2026)

**O que é:** não é notícia — é o **gatilho vencendo**. O vazio de MT termina em 06/09 e a
semeadura abre em 07/09. `upcomingTransitions(now, 7)` em `api/_lib/tools/calendar.ts`
emite a transição quando faltam ≤7 dias, o cron das 11h passa isso a `runVazioAlerts`, e
**nada muda no código**: a partir de 30/08 o loop dispara sozinho, quatro dias antes do fim
do flight plan.

**Por que o veredito é baixo mesmo assim:** é capacidade apontando para um público que a
base não tem. `listSojaFarmersByUf` exige `users.state = 'MT'` **e** `farms.crop` contendo
soja. O beachhead é café, são 3 farms com pin e nenhuma de produtor externo ativo. Se o
funil para antes, o bloqueio de billing nem chega a ser testado.

**A pergunta, e ela tem prazo de seis dias:** existe hoje alguma linha em `farms` com
cultura soja cujo `users.state` seja MT ou MS? Se o único candidato for fazenda de teste de
vocês — e `listSojaFarmersByUf` **não filtra `users.kind`** — você quer que dispare e entre
em `farmer_alerts` como envio, ou prefere um filtro `kind='produtor'` antes de 30/08 para
não contaminar o primeiro número não-zero da métrica que o scorecard mede?

## Fila de trabalho

_vazio — nada passou de DISCUTIR nesta rodada, e isso é o esperado._

A `verdict_note` deste projeto exige que PROTOTIPAR e IMPLEMENTAR ajudem a **conversar com
produtor** ou a **disparar alerta**. Dos seis itens lidos a fundo, os que tocavam essas duas
coisas não precisavam de código (a Fecon), ou não tinham destinatário na base (o vazio de
MT), ou exigiam um n que não existe (o timing de push). O resto era capacidade.

## Radar

- `2026-08-24` **RAG denso desaba em fala de produtor — e a Stevi não usa RAG denso.** Recuperação densa cai a R@10 = 0,093 em pergunta coloquial contra 0,970 em pergunta formal (bengali, 1.000 consultas, 2.882 nós de 284 publicações oficiais); BM25 híbrido lidera com 0,539. A Stevi já busca por **chave**: `extractPestTarget` normaliza a fala em `{cultura, praga}` canônico com o tier barato antes da busca, e `lookupPest` casa por token — zero embeddings no repo inteiro. Fica registrado como razão documentada para **não** trocar o grounding por embeddings. E o goldenset já está em linguagem de roça ("manchas alaranjadas na parte de baixo, tipo um pó"), então não há o que reescrever. [arXiv](https://arxiv.org/abs/2608.14886) · 7/15
- `2026-08-24` **RAImundo (Embrapa/MAPA/MDA/AZap.AI) segue sem sinal público desde out/2025.** Versão definitiva prometida para o 2º semestre de 2025 nunca teve lançamento evidenciado, nenhum número além de 2.900 interações em beta, nenhuma página oficial em embrapa.br ou gov.br. **Descartado pelo gate G3** — o repo já registrou a mesma leitura em 25/jul (`.claude/plans/2026-07-25-curadoria-loop/README.md`), com a ação já decidida (monitorar trimestralmente, não tratar como bloqueador de GTM). A varredura de hoje reforça a conclusão sem alterá-la. · 8/15, descartado por dedup

## Arquivo

_vazio_
