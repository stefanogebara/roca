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
>
> **Segunda passada (2026-08-31).** Feed veio vazio de novo (`roca: candidates: []`,
> gerado em 22/08 — mais um sinal de que o feed republicado não está atualizado pra este
> projeto); cinco scouts, oito candidatos lidos a fundo. **De novo zero PROTOTIPAR/IMPLEMENTAR**
> — quatro DISCUTIR, quatro REGISTRAR. O achado mais forte não veio da busca: a **CNA lançou
> nacionalmente um concorrente direto (JoIA)** em 25/08. E o `STATE.md` desta rodada registra
> que os 15 commits da semana inteira nasceram do `/intel` anterior — achado virou PR no
> mesmo dia, inclusive um recurso de 2.552 linhas que ninguém pediu. Restam **11 dias**.
>
> **Fechamento de ciclo (2026-09-01).** Não é varredura nova: zero scout, zero candidato
> novo. O Stefano decidiu os QUATRO itens de 31/08 no mesmo dia e todos viraram código
> mesclado (#13, #14, #15) — foram movidos para o Arquivo com o que aconteceu em cada um.
> Um deles saiu com **correção factual**: o registro de 31/08 dizia que o estudo da FDC
> "nomeia, com dirigente e faturamento", e o PDF mostra que ele anonimiza — a diferença
> mudava o que a Vitória pode dizer, então virou trava no prompt. Restam **10 dias**.
>
> **Quarta passada (2026-09-07) — restam 4 dias.** Feed veio vazio de novo (mesmo JSON
> de 22/08, `roca: candidates: []`); cinco scouts, ~35 candidatos brutos, seis lidos a
> fundo. **Três DISCUTIR, quatro REGISTRAR, dezenove DESCARTAR** — nenhum PROTOTIPAR,
> nenhum IMPLEMENTAR, sexta semana seguida sem spike. O achado mais forte não veio da
> busca: o `STATE.md` desta rodada mede a semana de **58 commits** (a mais commitada da
> campanha) contra **zero mensagens do único produtor da base** — e 25 desses commits são
> vinte e três iterações visuais da mesma landing page (v9→v30). O tripwire dispara pela
> quarta rodada seguida, agora na forma mais literal do "conserto nunca é mais código": o
> excesso não é nem feature, é design. A pergunta da Fecon (aberta 24/08) fechou sozinha —
> a feira aconteceu 1–3/09 e gerou zero cadastros via `#fecon`/`#fecon-cartaz` — e foi
> movida pro Arquivo como resultado, não como decisão.
>
> **Quinta passada (2026-09-21) — primeira depois do fechamento do voo de 60
> dias.** O voo fechou em 11/set com veredito qualitativo MATAR/PIVOTAR (memo
> `a01212c`); desde então o repositório ficou em silêncio quase total — zero
> commits nos últimos 7 dias, última mensagem de qualquer usuário no sistema
> em 03/set (18 dias). Feed do resumo matinal veio vazio de novo (mesmo JSON
> de 22/08, `roca: candidates: []`); cinco scouts, ~40 candidatos brutos
> depois de dedup contra `seen.jsonl`, nove lidos a fundo por um analista
> cada. **Cinco DISCUTIR (quatro novos + um item de 24/08 atualizado com
> achado novo), nove REGISTRAR, dezoito DESCARTAR — zero PROTOTIPAR, zero
> IMPLEMENTAR, quinta rodada seguida sem spike.** Dois achados de leitura
> mais forte: um estudo (mesmo que simulado, não de campo) que ecoa
> a leitura que o próprio memo de fechamento já tinha sozinho — adoção,
> não acurácia de algoritmo, é o gargalo — e um concorrente institucional
> (Sicoob SuperApp com IA generativa) que ataca uma premissa do próprio
> README de posicionamento: "o produtor não tem app". Dois itens abertos
> desde 24/08 passaram dos 21 dias sem decisão; um foi mantido aberto por
> ter recebido achado novo (opt-out de alerta), o outro foi mantido aberto
> por decisão editorial — o prazo que ele descreve (01/10) vence em 10 dias
> e arquivá-lo sem resposta do founder pareceu pior que quebrar a regra de
> hygiene. Ver nota na própria entrada.

## Em aberto — precisa de decisão do Stefano

### [DISCUTIR 8/15] O Sicoob acabou de rachar a premissa "o produtor não tem app"?
**Data:** 2026-09-21 · **Eixos:** P1 A1 D2 E2 L2
**Fonte primária:** [Sicoob — lançamento do Assistente Inteligente no SuperApp](https://www.sicoob.com.br/web/sicoob/noticias/-/asset_publisher/xAioIawpOI5S/content/id/199170100) · [cobertura](https://cooperativismodecredito.coop.br/2026/09/sicoob-lanca-nova-geracao-do-superapp-com-open-finance-e-inteligencia-artificial/)

**O que é:** em 01/09/2026 o Sicoob (8-10,3 milhões de cooperados, 85% das
transações do banco, 7 milhões de acessos diários ao app) lançou um
Assistente Inteligente por IA generativa dentro do próprio SuperApp —
aceita texto/áudio/imagem para Pix, boleto e Open Finance. Rollout gradual,
interface clássica ainda coexiste. Nenhuma menção a crédito rural,
agronegócio ou Funcafé no anúncio — é 100% bancário, o Sicoob mantém uma
seção "Para o Agronegócio" separada e sem relação com este lançamento.

**Por que toca este projeto:** o README do flight-plan (`.claude/plans/2026-07-13-flight-plan/README.md`,
linhas 18-48) argumenta "vs. apps de agro" partindo de uma premissa
factual: o produtor "não tem" app — todo app de agro faz ele trabalhar
(download, cadastro, dashboard vazio), por isso WhatsApp vence. Mas se o
produtor-alvo (5-50ha de café, Caparaó/Sul de Minas) É cooperado de banco
cooperativo, ele provavelmente JÁ tem um app — só que bancário, não
agronômico — e agora esse app está ganhando IA conversacional embutida.
A premissa "ele não tem app" e a premissa "esse app específico não faz o
que a Stevi faz" são duas afirmações diferentes; só a segunda é
defensável, e o README hoje usa a primeira.

**O que a fonte não prova:** que o produtor do beachhead da Stevi de fato
abre o app do Sicoob/Sicredi/Cresol pra além de checar saldo, nem qual
fração dele é cooperado versus cliente de banco tradicional. Sem esse
dado, a pergunta é hipótese, não fato estabelecido.

**A pergunta:** do universo de produtores-alvo do beachhead, quantos são
cooperados de banco cooperativo (Sicoob/Sicredi/Cresol) vs. clientes de
banco tradicional — e, entre os cooperados, eles abrem o app pra algo além
de Pix/saldo? Isso decide se "o produtor não tem app" (linha 24 do README)
ainda é a formulação certa, ou se precisa virar "o produtor tem um app
bancário, e a Stevi não compete com ele — se pluga onde o banco não
chega" (mesma lógica que já se aplica ao técnico/vizinho/rádio).

---

### [DISCUTIR 10/15] A verificação por rubrica em VLM ataca o gap de cobertura do goldenset?
**Data:** 2026-09-21 · **Eixos:** P2 A2 D2 E2 L2
**Fonte primária:** [arXiv 2609.09417](https://arxiv.org/abs/2609.09417)

**O que é:** benchmark de 116 datasets / 8.324 imagens mostra que VLMs
(ex. Gemma 4 E4B-it) já codificam features agrícolas quase tão separáveis
quanto embeddings DINOv3, mas falham em conectar isso a conhecimento de
domínio quando perguntados direto. Um verificador com rubrica de
diagnóstico fixa por tarefa leva o F1 de identificação de doença de um
teto single-shot de 0,60 para 0,71 — mas o próprio paper admite que a
maior parte do ganho vem de a rubrica já estar embutida no PROMPT de
geração, não da comparação par-a-par mais cara que dá nome ao método.

**Por que toca este projeto:** ataca de frente o `known_gap` já registrado
no config — "os 37 casos do `knowledge/goldenset/goldenset.jsonl` têm
`verified_by=null`, e o grounding cobre só cinco culturas" — e mira
`api/_lib/reason.ts` (identificação por foto), não RAG denso (que o
projeto já decidiu não usar). Dá pra rodar um spike real e barato: colocar
uma rubrica fixa no prompt de identificação e medir F1 contra os 37 casos
existentes, sem construir o torneio completo do paper.

**O que a fonte não prova:** que o ganho (0,60→0,71) generaliza das cinco
tarefas do benchmark pras culturas específicas do Stevi, nem que o
componente caro (K candidatos + torneio) vale o custo de latência frente a
só colocar a rubrica no prompt único.

**A pergunta:** o gargalo real hoje não é a arquitetura de verificação —
é que ninguém revisou os 37 casos do goldenset e a cobertura para em cinco
culturas. Vale gastar um spike de prompt (rubrica fixa, sem torneio) pra
melhorar F1 de diagnóstico visual, ou isso é exatamente "mais código"
enquanto zero produtor conversa há 18 dias e o voo de 60 dias já fechou
com veredito MATAR/PIVOTAR?

---

### [DISCUTIR 11/15] A transcrição de voz cai até 41 pontos com fala real — o Stevi tem golden set disso?
**Data:** 2026-09-21 · **Eixos:** P3 A2 D2 E2 L2
**Fonte primária:** [arXiv 2608.06027 — FormBharo](https://arxiv.org/abs/2608.06027)

**O que é:** agente de voz por telefone que combina LLM com validação
determinística pra preencher formulários com mães de baixa renda na
Índia rural — mesmo padrão arquitetural que `api/_lib/compliance.ts` já
aplica (LLM + camada determinística de controle). Benchmark de 3.760
testes/960 ligações com áudio real em hindi, mais piloto de campo com a
ONG ARMMAN: a acurácia de preenchimento cai até **41 pontos percentuais**
entre transcrição ideal e transcrição de fala real — e performance de
componente isolado não prediz performance fim-a-fim.

**Por que toca este projeto:** o `known_gap` já registrado no config diz
"trocar o default de transcrição [gemini-2.5-flash] sem golden de
transcrição fica em aberto" — ninguém mediu a qualidade real de
transcrição PT-BR de voz de roça. `api/_lib/transcribe.ts` alimenta
`api/_lib/tools/applicationParse.ts` sob o mesmo padrão que este paper
descreve. A queda de 41pp é em hindi/população específica — não
transfere direto — mas o MECANISMO (erro de transcrição se propaga e só
validação determinística recupera parte) é genérico o bastante pra valer
a pena verificar se o Stevi tem a mesma vulnerabilidade sem saber.

**O que a fonte não prova:** que a mesma curva de degradação se aplica ao
padrão de ruído de campo brasileiro nem ao tipo de campo que a Stevi
extrai (cultura, praga, dose — diferente de formulário de saúde materna).

**A pergunta:** vale montar agora um golden set de transcrição PT-BR
(mesmo que com áudio sintético/degradado, já que não há voz real de
produtor pra calibrar — zero mensagem há 18 dias), ou isso é trabalho de
engenharia adiantado sem sinal de campo, exatamente o tipo que o tripwire
do voo de 60 dias — encerrado com veredito MATAR/PIVOTAR — pede pra
evitar até a decisão de recomeço sair?

---

### [DISCUTIR 9/15] Captação de agtech caiu 33% globalmente — isso muda o cálculo pós-voo?
**Data:** 2026-09-21 · **Eixos:** P2 A1 D2 E2 L2
**Fonte:** [PitchBook — Q2 2026 Agtech Report](https://pitchbook.brightspotcdn.com/5e/08/bfa17cb444059c50d7a96539baa7/q2-2026-agtech-report-embedded-ai-draws-capital-and-delivers-roi-preview.pdf) (via [The Shift](https://theshift.info/hot/tecnologia-precisao-agro-venture-capital-ia-2026/))

**O que é:** investimento global em agtech caiu de US$3,7bi (H1/2025, 484
deals) para US$2,4bi (H1/2026, 359 deals) — -33% em valor, -26% em número
de deals — segundo a PitchBook. Dentro do H1/2026, Agricultura de Precisão
é a fatia mais fraca por número de deals (US$338,6M/38 deals) entre as
categorias medidas; o relatório descreve migração de capital de hardware
pra dados/biologia/IA embarcada.

**Por que toca este projeto:** o voo de 60 dias fechou em 11/set com
veredito qualitativo MATAR/PIVOTAR, e a decisão que os founders enfrentam
agora — segundo o próprio README do flight-plan — é "venture vs. negócio
próprio vs. matar/pivotar". Captação mais difícil é dado direto de
contexto pra essa decisão, embora não invalide nem confirme sozinho
nenhuma aposta específica.

**O que a fonte não prova:** o PDF completo não abriu pra leitura (só o
texto da cobertura secundária foi lido); não há segmentação por estágio
(seed vs. late-stage) nem por Brasil/LatAm/agtech-conversacional
especificamente — "Agricultura de Precisão" na taxonomia da PitchBook é
categoria ampla de hardware/sensor, que pode nem corresponder ao nicho do
Stevi.

**A pergunta:** com captação agtech em queda e a fatia de precisão sendo a
mais fraca do trimestre, isso reforça manter a tese B2B2C bootstrapped em
vez de buscar rodada — ou o pivot que está em cima da mesa já não depende
de fundraising de qualquer forma, e o dado é só contexto sem ação clara?

---

### [DISCUTIR ~10/15, atualizado] O primeiro alerta sai às 08:00 para todo mundo — e agora falta um segundo mecanismo: opt-out
**Data original:** 2026-08-24 · **Atualizado:** 2026-09-21 · **Eixos:** P2 A2 D2 E2 L2
**Fontes:** [STEPS](https://arxiv.org/abs/2608.01949) · [JITAI/OzCHI](https://arxiv.org/abs/2608.09294) · **novo:** [Proactive Service Agents — unified decision framework](https://arxiv.org/abs/2609.03727)

*Nota de processo: este item está aberto há 28 dias — passou dos 21 dias
que normalmente mandam um item pro Arquivo. Mantido aberto porque recebeu
achado novo nesta rodada (abaixo), não porque a regra de hygiene foi
ignorada sem razão.*

**O que já estava registrado (24/08):** `bets[1]` diz que notificação
proativa no momento certo vale mais que resposta sob demanda; hoje o cron
dispara `0 11 * * *` (08:00 BRT) pra todo mundo, mesmo horário pros três
tipos de alerta, enquanto `api/_lib/prospect/core.ts` já tem disciplina de
horário comercial pro lado empresa. A pergunta original: o primeiro alerta
de geada sai às 08:00 pra todo mundo, ou o horário é argumentado por tipo
de alerta (geada na véspera à noite, queimada na hora, vazio em horário
comercial)?

**O que é novo (21/09):** um survey formaliza proatividade como decisão
restrita por um ledger de autorização verificável e um teto de risco —
não é experimento próprio (síntese de ~100 papers/13 benchmarks, nenhum
combina realismo de implantação alto + desenho causal + horizonte longo ao
mesmo tempo). O achado que interessa: `api/_lib/prospect/inbound.ts` **já
implementa**, do lado empresa, exatamente o padrão de "autorização
verificável + execução recuperável" que este framework descreve —
`prospect_optouts`, checado antes de reenvio, com o comentário do próprio
time ("suprimido-e-não-apagado é recuperável"). **`api/_lib/alerts.ts` e
`api/cron/monitor.ts`, do lado produtor, não têm equivalente** — nenhuma
referência a optout/consent/blocklist nesses dois arquivos.

**O que as fontes não provam:** nenhum dos mecanismos citados (STEPS,
JITAI, este framework) roda com n perto de 1, que é o n real do Stevi.

**A pergunta (duas cláusulas agora):** (1) o horário do alerta é único ou
por tipo, como já perguntado em 24/08; e (2) — novo — hoje um alerta de
geada/queimada/vazio dispara pra qualquer produtor com pin sem nenhum
mecanismo de opt-out, ao contrário do lado prospect. Vale portar o padrão
de `prospect_optouts` pro lado produtor antes ou depois de haver um alvo
real pra testar (hoje há zero, com as 4 farms com pin todas `kind='teste'`),
dado que o voo de 60 dias já fechou?

---

### [DISCUTIR 10/15 — mantido aberto, prazo em 10 dias] A partir de 01/10 não sobra caminho gratuito no WhatsApp
**Data:** 2026-08-24 · **Eixos:** P3 A2 D3 E2 L2

*Nota de processo: este item também está aberto há 28 dias — passaria pro
Arquivo pela regra dos 21 dias. Não movido: o prazo que ele descreve
(01/10) vence em **10 dias** a partir de hoje, e nenhuma das duas rodadas
de scout desta semana (funding, plataforma) trouxe evidência de que a
forma de pagamento da WABA foi confirmada. Arquivar um risco de
continuidade financeira não resolvido, dias antes do prazo valer, pareceu
pior que quebrar a regra de hygiene uma vez — fica registrado como decisão
consciente, não omissão.*

**Fonte primária:** [Meta, "Pricing for non-template messages"](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages)
— confirmado de novo nesta rodada (14/09, via scout de plataforma): sem
forma de pagamento cadastrada até 30/09/2026, a entrega de service
messages simplesmente **para** a partir de 01/10 — o detalhe operacional
exato que faltava na rodada de 24/08.

**O que já estava registrado:** o alerta proativo em si não encarece
(`alertSendPlan()` já cai em `template`, que já é pago hoje) — o risco é
continuidade de cobrança, não preço. O canal inteiro já morreu uma vez por
billing (#131042, julho) — não por engajamento.

**A pergunta, sem mudança:** a conta de billing da WABA está com método de
pagamento válido e fundeado hoje? Faltam 10 dias. Isso é 5 minutos de
quem tem acesso ao Meta Business Manager — e continua sem resposta
registrada no repositório há 28 dias.

---

### [DISCUTIR 11/15] Prompt logging na OpenRouter está desligado nas duas contas?
**Data:** 2026-09-07 · **Eixos:** P3 A1 D2 E3 L2
**Fonte primária:** [OpenRouter Terms of Service, Seção 6.1–6.5](https://openrouter.ai/terms)

**O que é:** a Seção 6.2 do ToS, atualizada em 31/08, diz — citação literal — que **se**
"prompt logging" estiver habilitado nas configurações da conta, a OpenRouter ganha
licença mundial, perpétua e irrevogável para hospedar, reproduzir, adaptar e distribuir
o conteúdo do usuário; a 6.1 estende isso a **venda em forma anonimizada**. É opt-in e
desligado por padrão — não é uma reivindicação automática, ao contrário do que a
manchete sugere.

**Por que toca este projeto:** o único ponto de chamada do gateway principal de LLM
(`api/_lib/llm.ts`) não tem nenhum controle de política de dados — nenhuma referência a
`logging`/`privacy`/`retention` no repo inteiro. E desde #14 existem **duas** contas
OpenRouter em produção: a principal e a chave reserva (`OPENROUTER_FALLBACK_API_KEY`,
do projeto twin-me), cada uma com sua própria configuração de conta. Mensagens reais de
produtor passam por aqui — texto, foto descrita, dúvida agronômica.

**Por que isso não vira código:** a mitigação inteira é entrar no dashboard de duas
contas e confirmar (ou desligar) uma opção. Nenhuma linha de `api/_lib/llm.ts` muda por
causa disso — por isso o veredito trava em DISCUTIR mesmo com score bruto de 11 (que
cairia em PROTOTIPAR): a `verdict_note` exige que PROTOTIPAR/IMPLEMENTAR ajudem a
CONVERSAR ou ALERTAR via mudança no repositório, e aqui não há o que mudar no repositório.

**A pergunta:** as duas contas OpenRouter (a principal do projeto e a reserva do
twin-me usada como `OPENROUTER_FALLBACK_API_KEY`) têm "prompt logging" desligado? Se sim
— que é o padrão — o risco já está mitigado e este item pode ir pro Arquivo na próxima
rodada. Se não, foi checado quando a chave reserva foi configurada em #14, ou fica em
aberto até alguém confirmar manualmente?

---

### [DISCUTIR 9/15] Um projeto universitário gratuito já roda o mesmo mecanismo do Stevi — em cacau
**Data:** 2026-09-07 · **Eixos:** P3 A1 D2 E1 L2
**Fonte:** [App do Cacau — Revista Cacau & Chocolate](https://www.cacauechocolate.com.br/v1/2026/08/26/app-do-cacau-a-inteligencia-artificial-aplicada-a-lavoura/)

**O que é:** a UESC (Bahia), com parceiros do Peru e da Holanda e financiamento do
Instituto Arapyaú, lançou na ExpoCacau 2026 um serviço gratuito por WhatsApp que recebe
texto, áudio ou foto da lavoura de cacau e devolve diagnóstico preliminar de 8 doenças,
11 pragas e deficiências nutricionais — com a mesma postura de triagem-não-prescrição da
Stevi, no mesmo texto: "não substitui o trabalho do agrônomo ou técnico agrícola, mas
ajuda a identificar problemas que exigem um profissional qualificado".

**Por que toca este projeto:** é literalmente o mesmo mecanismo (`api/_lib/pipeline.ts`,
`api/_lib/compliance.ts`, `api/_lib/reason.ts`) — WhatsApp, multimodal, triagem, sem dose
— só que como projeto universitário gratuito financiado por fundação, hoje em cacau na
Bahia. Nenhum número de usuários foi divulgado.

**O que a fonte não prova:** se esse padrão institucional (universidade + fundação, sem
necessidade de monetizar) já está se movendo para café em Minas.

**A pergunta:** vale checar se algum programa estadual, EPAMIG ou a própria Embrapa tem
um movimento equivalente nascendo para café? Se esse modelo (universidade financiada,
gratuito pra sempre) se replicar no beachhead, muda como a Stevi precisa se posicionar
ou monetizar — não é ameaça hoje, mas é o tipo de concorrente que nenhuma rodada
`prospect/*` está olhando.

---

### [DISCUTIR 8/15] Um app pago com IA agronômica no seu beachhead tem 100 downloads — vale citar isso?
**Data:** 2026-09-07 · **Eixos:** P2 A1 D1 E2 L2
**Fonte:** [Café 360 Premium — Zavarise Apps](https://www.zavarise.com.br/cafe360/)

**O que é:** app pago (R$19,90/mês) de gestão de lavoura de café com "consultor
agrônomo com IA" (manuais EPAMIG/EMATER, diagnóstico por foto de folha), cobrindo
explicitamente Sul de Minas, Cerrado Mineiro, Matas de Minas, Mogiana — sobreposição
geográfica direta com o beachhead. Confirmado na Play Store: **100+ downloads**. O
desenvolvedor (Zavarise Apps) também publica "Fazenda 360", "Pecuária 360" e um app de
áudio de conteúdo religioso — perfil de fábrica de apps de nicho pequena, não agtech
financiada.

**Por que toca este projeto:** o `README.md` do flight plan argumenta que apps de agro
falham porque pedem que o produtor trabalhe (download, cadastro, dashboard vazio) — essa
é exatamente a tese de `bets[0]` ("WhatsApp é a única interface viável — não construir
app"). O Café 360 é esse padrão exato — e com IA embutida, cobertura geográfica idêntica
e mensalidade baixa, ainda assim tração desprezível. É evidência de campo a favor da
aposta, não contra.

**A pergunta:** vale citar o Café 360 (app pago, mesma região, IA embutida, 100+
downloads) como exemplo concreto no README de posicionamento — ou n=1 concorrente
pequeno é fraco demais pra virar argumento citável, e a melhor ação é só arquivar como
mais um data point?

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

## Fila de trabalho

_vazio — nada passou de PROTOTIPAR/IMPLEMENTAR nesta rodada. Quinta rodada seguida (24/08,
31/08, 07/09, 21/09) sem spike na campanha._

A `verdict_note` deste projeto exige que PROTOTIPAR e IMPLEMENTAR ajudem a **conversar com
produtor** ou a **disparar alerta**. Nesta rodada, dois itens (VLM rubric-grounded, FormBharo)
bateriam PROTOTIPAR pelo score bruto (10 e 11) — ambos travam em DISCUTIR pela mesma regra:
capacidade pura (acurácia de diagnóstico visual, qualidade de transcrição) não é conversa nem
alerta, mesmo quando ataca um `known_gap` real e nomeado. Isso importa mais que de costume
agora: o voo de 60 dias fechou em 11/set com veredito qualitativo MATAR/PIVOTAR, e o
`STATE.md` desta rodada mede zero commits e zero mensagem de qualquer tipo de usuário há 18
dias — não é hora de abrir fila de trabalho de código, é hora de decisão de founder (Gaia
Tech, CNPJ, golden set, e agora também: recomeçar ou encerrar).

**Adendo de 01/09:** os quatro itens de 31/08 foram decididos pelo Stefano no mesmo dia e
viraram código — três PRs mesclados (#13, #14, #15). Estão no Arquivo, cada um com o que
aconteceu. Isso NÃO contradiz a `verdict_note`: ela trava a PROMOÇÃO automática de item que
só adiciona capacidade; nenhum destes subiu sozinho de DISCUTIR. Quem decidiu foi o
fundador, que é exatamente o que a seção "Em aberto" existe para provocar. O registro fica
aqui porque a alternativa — apagar a pergunta depois de respondida — perderia o rastro de
por que o código existe.

## Radar

- `2026-09-21` **Xerelia (Colômbia) diagnostica café/cacau/palma em <10s citando as fontes exatas que consultou.** Corpus fechado e datado (Biblioteca Agropecuária Colombiana + Agrosavia), resposta adaptada ao letramento do usuário — mesmo padrão de "triagem com fonte verificável" já visto no App do Cacau (UESC), agora fora do Brasil. Zero métrica de uso divulgada. [Datos Abiertos Colombia](https://herramientas.datos.gov.co/usos/xerelia-asistente-inteligente-para-agricultores-de-colombia) · 7/15
- `2026-09-21` **Simulação Monte Carlo (não dado de campo) confirma numericamente o que o memo de fechamento do Stevi já tinha sozinho: adoção do produtor, não acurácia do algoritmo, é o gargalo.** Redução de pesticida vai de 20,7% a 49% de probabilidade só variando adoção de baseline a 0,85 — eco quantificado de um achado que o repositório já chegou por conta própria (58 commits numa semana, zero mensagem de produtor). Domínio de IoT em Hainan, sem sobreposição de stack. [arXiv](https://arxiv.org/abs/2609.06740) · 6/15
- `2026-09-21` **GaIA (Espanha): assistente fitossanitário por WhatsApp que expõe dose — o oposto da postura settled do Stevi.** Lê o vademecum oficial do MAPAMA e devolve dose/período de segurança direto, sem diagnosticar sintoma. Contrasta com `api/_lib/compliance.ts`, que bloqueia exposição de dose mesmo tendo os dados do Agrofit disponíveis. PR de empresa pequena, sem métrica, sem sinal de expansão pro Brasil confirmado (checado e descartado). [Phytoma](https://www.phytoma.com/noticias/noticias-de-empresas/gaia-primer-asistente-fitosanitario-con-inteligencia-artificial-a-traves-de-whatsapp) · 6/15
- `2026-09-21` **AgrodatAi/"Don Tulio" (Colômbia) alega 318 mil produtores via WhatsApp/SMS — número autodeclarado sem auditoria.** Chatbot desde 2019 com preço, clima, crédito e seguro. Um case da OCDE de 2022 registrava só 57 mil dois anos antes — gap sem reconciliação entre fonte "neutra" e fonte de vendas. Fonte primária designada (Google Cloud) não abriu pra verificação direta. [Google Cloud (case)](https://cloud.google.com/customers/agrodatai) · 7/15, teto por G1 (fonte não verificada)
- `2026-09-21` **John Deere lança "JD", assistente de IA generativa no Operations Center.** Early access, responde perguntas sobre dados de talhão/máquina; expansão pra web/mobile/cabine ainda em 2026. Concorrente adjacente global — agricultura mecanizada de grande escala, não WhatsApp, não smallholder. [DTN Progressive Farmer](https://www.dtnpf.com/agriculture/web/ag/equipment/article/2026/09/01/john-deere-launches-jd-ai-assistant) · 6/15
- `2026-09-21` **Pipeline de voz agnóstico a idioma reduz WER 16-23% em ASR agrícola (hindi/telugu/odia) sem retreinar o modelo base.** Realce de áudio + correção com léxico ponderado + quality gate — mesmo tipo de problema que `api/_lib/transcribe.ts` enfrentaria pra vocabulário técnico PT-BR, mas sem golden set de transcrição pra medir se ajudaria aqui. [arXiv](https://arxiv.org/abs/2609.20504) · 6/15
- `2026-09-21` **Solinftec relançou "Alice" (IA multiagente) com alertas via WhatsApp — achado de abril, nunca triado.** Meta de R$500mi em 2026; foco em operações grandes (clima, manutenção, logística), não triagem conversacional smallholder. [Forbes Brasil](https://forbes.com.br/forbes-agro/2026/04/solinftec-lanca-ia-multiagente-na-agrishow-e-mira-r-500-milhoes-em-2026/) · 5/15
- `2026-09-21` **Meta Business Agent começa a cobrar por token (US$2/milhão, ~4-5 centavos/conversa) desde 01/08.** Benchmark de custo pra qualquer bot de atendimento no WhatsApp, incluindo o piloto da Agro Amazônia já mapeado. [Enterprise DNA](https://enterprisedna.co/resources/news/meta-business-agent-billing-august-1-token-pricing-2026/) · 5/15
- `2026-09-21` **Google lança Gemini 3.8 Flash com preço introdutório até dez/2026 ($0,75/$3,75 por milhão de tokens).** Dobra em jan/2027. O Stevi usa `gemini-2.5-flash` pinado pra transcrição — modelo novo não é o default hoje, mas é opção futura se o preço atual do 2.5 mudar. [eesel AI](https://www.eesel.ai/blog/gemini-3-8-flash) · 5/15
- `2026-09-21` **Anthropic já captou US$130 bi rumo a possível IPO.** Contexto de risco de fornecedor — o LLM de raciocínio do Stevi (via OpenRouter e fallback direto) vem de uma empresa em transição pra capital aberto. Sem ação hoje. [The Motley Fool](https://www.fool.com/investing/2026/09/04/anthropic-has-already-raised-130-billion-ahead-of/) · 5/15
- `2026-09-21` **OpenRouter lança roteamento de dados in-region (US/EU) — sem opção de Brasil, sem mudança de termos confirmada pós-Stripe.** Relevante como precedente de residência de dados (LGPD), mas nenhuma ação hoje. [OpenRouter](https://openrouter.ai/announcements) · 5/15
- `2026-09-21` **Semana Internacional do Café 2026 (BH, 11-13/nov) — maior evento de café do Brasil.** Janela de campo futura, se a campanha recomeçar; fora de qualquer decisão imediata com o voo de 60 dias encerrado. [SIC](https://semanainternacionaldocafe.com.br/en/home/) · 4/15
- `2026-09-07` **DigiFarmz relançou "Daz" — mas é feature dentro de SaaS B2B de soja/trigo, não concorrente direto.** A data original parecia 22/09/2026 (futura); confirmada no HTML: é notícia de **set/2025**, republicada. O Daz é a camada WhatsApp de uma plataforma paga (Cropper/Linkage) de uma agtech de Champaign-IL com operação BR/EUA/Paraguai, focada em manejo fitossanitário de soja/trigo em fazendas comerciais grandes — sem café, sem gratuidade, sem sobreposição de segmento com o beachhead. Valida que "alerta proativo por WhatsApp" é padrão de indústria, não ensina mecanismo novo. [Global Crop Protection](https://globalcropprotection.com/noticias/novas-tecnologias/digifarmz-apresenta-daz-assistente-virtual-que-leva-inteligencia-artificial-ao-dia-a-dia-do-produtor-rural/) · 7/15
- `2026-09-07` **Agro Amazônia triplica conversas com o Meta Business Agent (via Zenvia) em uma semana.** Distribuidora de insumos (subsidiária Sumitomo) roda piloto do agente nativo da Meta no WhatsApp — de 420 para 1.400+ conversas/semana. É SDR de vendas, não conselho agronômico, mas mostra a velocidade com que fornecedores de insumo estão automatizando o mesmo canal — e que a Meta já oferece agente nativo, baixando a barreira para qualquer revenda/cooperativa montar o próprio bot. [RBTV](https://rbtv.com.br/noticia/7058/agroamazonia-triplica-conversas-com-agente-de-ia) · 5/15
- `2026-09-07` **FAIRY: motor agentic orientado a evento para soja full-season, implantado numa fazenda real.** Orquestra maquinário/drone/sensor/clima sob paradigma "tudo é evento", avaliado com 9 controladores sobre 100 safras simuladas (SIGSPATIAL 2026). Não fala de timing de notificação a humano (não duplica o item já aberto sobre horário de alerta) e exige hardware que o Stevi não tem e não vai ter neste voo. [arXiv](https://arxiv.org/abs/2609.00106) · 6/15
- `2026-09-07` **EGT-KG: grafo de conhecimento tipado melhora QA científico em modelo pequeno — mas em domínio distante e sem transferência clara.** +12-15% sobre RAG denso em corpus de 30 papers de materiais de construção (não agronomia), ganho inconsistente entre modelos, sem código liberado. O grounding do Stevi (`api/_lib/tools/agrofit.ts`) não tem o problema que este paper resolve — é lookup determinístico sobre registro estruturado, não retrieval fragmentado. O gap real de cobertura (`reason.ts:253`, só 5 culturas) fecha com curadoria de dados, não arquitetura de retrieval. [arXiv](https://arxiv.org/abs/2609.00479) · 5/15
- `2026-08-31` **CooperRita já tem vendor de IA (Crawly) — e é prospect nomeado do ICP do Stevi.** O iUai, lançado em jan/2026, é chatbot de marca sobre café e queijo regional, não conselho agronômico — mas mostra que uma cooperativa de café do Sul de Minas, dentro do beachhead, já assinou com um fornecedor de IA. Gancho de prospecção, não ameaça de produto. [Itatiaia](https://www.itatiaia.com.br/agro/ia-mineira-cooperativa-lanca-ferramenta-que-entende-de-queijo-e-cafe) · 6/15
- `2026-08-31` **Preço do Claude Sonnet 5 não sobe.** A Anthropic tornou permanente o preço introdutório ($2/$10 por MTok) e cancelou o aumento pra $3/$15 que estava marcado pra 01/09 — custo do modelo de raciocínio da Stevi via OpenRouter fica igual. [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing) · 6/15
- `2026-08-31` **AgriRegion confirma a tese, mas o Stevi já resolveu melhor.** Paper de RAG geoespacial (Carolina do Norte, sem código liberado) valida "conselho agrícola precisa ser regional" — mas o vazio sanitário de SP, o bug real da semana, foi fechado com lookup determinístico de município (`vazioRegiao.ts`), não com retrieval. Generalizar pro método do paper seria trocar solução exata por probabilística sem necessidade. [arXiv](https://arxiv.org/abs/2512.10114) · 5/15
- `2026-08-31` **Farmtech contrata crédito agrícola dentro do WhatsApp da revenda.** "Jornada ao Produtor" formaliza CPR-f digital na mesma conversa que já existe entre revenda e produtor; projeção de R$500-700mi na safra 26/27. Categoria diferente (crédito, não conselho), mas valida de leve a aposta de canal. [AgFeed](https://agfeed.com.br/grande-slam-do-agro/andav/farmtech-aposta-no-whatsapp-para-destravar-a-ultima-milha-do-credito-agro/) · 5/15
- `2026-08-24` **RAG denso desaba em fala de produtor — e a Stevi não usa RAG denso.** Recuperação densa cai a R@10 = 0,093 em pergunta coloquial contra 0,970 em pergunta formal (bengali, 1.000 consultas, 2.882 nós de 284 publicações oficiais); BM25 híbrido lidera com 0,539. A Stevi já busca por **chave**: `extractPestTarget` normaliza a fala em `{cultura, praga}` canônico com o tier barato antes da busca, e `lookupPest` casa por token — zero embeddings no repo inteiro. Fica registrado como razão documentada para **não** trocar o grounding por embeddings. E o goldenset já está em linguagem de roça ("manchas alaranjadas na parte de baixo, tipo um pó"), então não há o que reescrever. [arXiv](https://arxiv.org/abs/2608.14886) · 7/15
- `2026-08-24` **RAImundo (Embrapa/MAPA/MDA/AZap.AI) segue sem sinal público desde out/2025.** Versão definitiva prometida para o 2º semestre de 2025 nunca teve lançamento evidenciado, nenhum número além de 2.900 interações em beta, nenhuma página oficial em embrapa.br ou gov.br. **Descartado pelo gate G3** — o repo já registrou a mesma leitura em 25/jul (`.claude/plans/2026-07-25-curadoria-loop/README.md`), com a ação já decidida (monitorar trimestralmente, não tratar como bloqueador de GTM). A varredura de hoje reforça a conclusão sem alterá-la. · 8/15, descartado por dedup

## Arquivo

- `2026-09-07` **[era DISCUTIR 10/15] A Fecon aconteceu 1–3/09 — e gerou zero cadastros, apesar do kit pronto.** O kit (`64152d6`) e a regra de vouch (`527120b`, token `#fecon` vs. `#fecon-cartaz`) foram shipados dias antes da feira. Medição de 07/09 no banco: `users.source ilike '%fecon%'` retorna **zero linhas**; só 1 usuário novo entrou no banco desde 31/08 (`kind='empresa'`, não produtor). O repositório não registra se o Stefano foi e não usou o kit, ou não foi — mas o resultado é o mesmo: a única janela de campo dentro do voo de 60 dias não converteu ninguém. Movido pro Arquivo como resultado, não como decisão pendente — a pergunta original ("você vai?") não faz mais sentido perguntar, a janela fechou.
- `2026-09-01` **[era DISCUTIR 10/15] A OpenRouter virou parte da Stripe — decidido: diversificar em duas camadas, sem esperar mudança de termos.** O Stefano mandou ir fundo e liberou trocar modelo. Confirmado com as fontes primárias que a aquisição foi anunciada pelas DUAS partes em 19/08 ("same product, same roadmap", closing pendente) — promessa, não contrato. Entraram: fallback direto por chave (`api/_lib/llmDirect.ts`, Anthropic Messages API e endpoint OpenAI-compat do Google AI Studio) em #13, e chave RESERVA do OpenRouter — conta separada, a do projeto twin-me — como camada 1 em #14, já configurada em produção (`OPENROUTER_FALLBACK_API_KEY`) com redeploy feito. O gateway deixou de ser ponto único. [Stripe](https://stripe.com/newsroom/news/stripe-agrees-to-acquire-openrouter) · [OpenRouter](https://openrouter.ai/blog/announcements/openrouter-is-joining-stripe/)
- `2026-09-01` **[era DISCUTIR 10/15] O Google já tem data pra desligar o Gemini 2.5 — decidido: pinar `google-ai-studio` agora, sem esperar a data oficial.** A checagem nas páginas do Google fechou a dúvida das duas datas: 16/10/2026 está confirmado nos release notes do **Vertex**; a página de model-versions cita 20/10 e o Google não resolveu a contradição (planejamos pelo 16). O que decide é outra coisa: a **API pública segue "no shutdown date announced"**, então o pin desacopla a transcrição do prazo do Vertex inteiro. Implementado em #13 (`ROCA_TRANSCRIBE_PROVIDER`, default `google-ai-studio`, `any` desliga), com o canário pingando o tier de transcrição pelo MESMO pin — senão validaria caminho que o produtor não usa. Modelo mantido: `gemini-2.5-flash-lite` seria mais barato em áudio (US$0,30/M vs 1,00) mas ninguém mediu transcrição PT-BR de voz de roça nele; trocar default sem golden de transcrição fica em aberto. [Vertex release notes](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes) · [deprecations da API pública](https://ai.google.dev/gemini-api/docs/deprecations)
- `2026-09-01` **[era DISCUTIR 8/15] O JoIA da CNA — decidido: citar a base pública, e ela ancora uma resposta que saía rasa.** A leitura a fundo confirmou o desenho do concorrente (WhatsApp, gratuito, número (61) 99844-8367, lançado 25/08, rollout na Expointer) e, mais útil, o **status legal da base**: os boletins mensais do Campo Futuro (CNA/Senar; café elaborado pelo CIM/UFLA) trazem impresso "Reprodução permitida desde que citada a fonte". Não é território deles — é fonte pública. Implementado em #13: `api/_lib/tools/custos.ts` detecta pergunta de custo (que não é cotação e caía no caminho `general` sem base nenhuma) e injeta estrutura COE/COT, a citação, e a honestidade de que o número público é da propriedade MODAL da região, não da lavoura dele — com o gancho pro caderno, que é o dado que só a Stevi tem. Nenhum número embutido no código: boletim é mensal. Caso novo no goldenset (`custo-producao-cafe`). Confirmado também que o JoIA é **só reativo** — nenhuma fonte menciona alerta proativo, o que mantém a `bets[1]` de pé. [CNA](https://cnabrasil.org.br/noticias/sistema-cna-senar-leva-joia-projeto-comprador-e-produtos-artesanais-a-expointer) · [boletim Ativos Café](https://www.cnabrasil.org.br/storage/arquivos/icones/Ativos-Cafe-Campo-futuro-Agosto-2024-CNA.pdf)
- `2026-09-01` **[era DISCUTIR 8/15] O estudo da FDC — decidido: citar na CONVERSA, não no template. E o registro de 31/08 estava errado num ponto que mudava a ação.** O título daquele item dizia que o estudo "nomeia, com dirigente e faturamento". Abrindo o PDF: ele **anonimiza** — a Tabela 1 traz perfis (fundação, cidade, nº de associados, faturamento 2024) e o cargo do entrevistado, sem nome de cooperativa nem de dirigente. Dá pra inferir que o perfil de Guaxupé com R$10,7 bi é a Cooxupé, mas isso é inferência nossa, não citação; atribuir número do estudo a uma cooperativa nominal seria inventar fonte. Implementado em #13 com essa trava explícita no prompt da Vitória (`prospect/agent.ts`), junto da munição citável (15 dirigentes de MG, 22 barreiras, recomendação de parceria com startups e IA na interação com o cooperado) e da resposta pronta à objeção de propriedade de dados, que o estudo documenta na voz do cooperado ("eu não vou passar não, porque eu não sei para onde que vai isso"): consentimento LGPD + exclusão a pedido, caso técnico devolvido aos agrônomos da cooperativa, sem venda de dados, contrato escala pro Stefano. O template aprovado `stevi_parceria_coop_v1` **não muda** — bloco de texto em template frio morre no porteiro-robô (medição de 05/ago) e corpo aprovado exige re-submissão à Meta; a citação vive onde há humano lendo. [Zenodo (DOI 10.5281/zenodo.17604355)](https://zenodo.org/records/17604355)
- `2026-09-01` **[achado colateral, virou #15] A rede de resgate era silenciosa — e o alerta de crédito não cobria o caso.** Simulando a queda da chave principal contra a API real (não mock), o OpenRouter devolveu `401 "User not found"`, que **não** é `isCreditError`: a reserva seguraria todo o tráfego sem nenhum alerta, só `log.error` na Vercel, enquanto o saldo do outro projeto escoava. Chave revogada é justamente o cenário de aquisição que motivou a reserva existir. #15 faz as duas camadas de resgate avisarem os fundadores (cooldown de 10 min, `fireAndForget`, texto nomeando camada/modelo/motivo). Não é item de intel — é o que a verificação achou, e fica aqui porque nasceu desta rodada.
- `2026-08-31` **[era DISCUTIR 9/15] Em 30/08 o cron tenta o alerta de vazio de MT sozinho — resolvido por código, não por decisão do Stefano.** No mesmo dia em que o item foi aberto (24/08), `def021c` filtrou `listSojaFarmersByUf`/`listFarmsWithCoords` por `kind='produtor'`, e `7e891f5` completou a cobertura de UF. Medição de 31/08 no banco confirma: a única farm com soja em MT é `kind='teste'` e o filtro a exclui — o cron de 30/08 não vai contaminar `farmer_alerts`. Movido pra cá porque a pergunta original (disparar pra teste ou filtrar antes?) já tem resposta no código, não porque o Stefano decidiu.
