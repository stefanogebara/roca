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
> **Quinta passada (2026-09-28) — o voo de 60 dias fechou há 17 dias.** O `/intel` não
> rodou em 14/09 nem 21/09 — só os memos do PM do Scorecard, que mediram silêncio total
> (0 commits × 0 conversas de produtor nas últimas duas semanas). O voo fechou em 11/09
> com veredito qualitativo **MATAR/PIVOTAR** (critérios booleanos do scorecard — parceiros
> pagantes, indicação espontânea — todos zerados em 60 dias) e recomendação explícita de
> não fazer mais engenharia até 3 decisões humanas saírem do papel (Gaia Tech/Michel,
> CNPJ, assinatura do golden set — todas paradas há 65+ dias). Mesmo assim o `/intel`
> rodou o pipeline inteiro: feed vazio de novo, cinco scouts, **43 candidatos brutos** (o
> acúmulo de três semanas sem varredura), 25 descartados por gate barato (dedup/escopo/
> fonte inacessível) e **18 lidos a fundo**, um analista por item. **Zero PROTOTIPAR, zero
> IMPLEMENTAR — nona rodada seguida sem spike** — mas **9 DISCUTIR**, o maior volume de
> perguntas em aberto de uma única rodada até aqui, reflexo do acúmulo de três semanas e
> não de generosidade na rubrica: cada um foi rebaixado de PROTOTIPAR por capacidade pura
> não tocar CONVERSAR ou ALERTAR, exatamente como a `verdict_note` prevê. O achado mais
> afiado: um concorrente direto (JÃO iAGRO) tem 10 mil usuários pagantes dando **dose e
> princípio ativo** por WhatsApp — o oposto exato da aposta settled de triagem-não-
> prescrição da Stevi. Dois itens vencidos (>21 dias sem decisão) foram arquivados.

## Em aberto — precisa de decisão do Stefano

### [DISCUTIR 12/15] Léxico agrícola pós-transcrição reduz erro de voz sem trocar modelo — vale medir se a Stevi tem esse problema?
**Data:** 2026-09-28 · **Fonte:** [arXiv 2609.20504](https://arxiv.org/abs/2609.20504) · **Eixos:** P3 A2 D2 E3 L2

**O que é:** pipeline modular pós-ASR (realce de áudio, diarização, correção por léxico
agrícola ponderado, quality gate) que reduz WER 16-23% em nuvem e até 42% em multi-falante
**sem retreinar o modelo de transcrição** — testado em ~2.700 gravações reais do FarmerChat
(hindi/telugu/odia), com artefatos parcialmente abertos (léxico, eval set, código).

**Por que toca este projeto:** toda nota de voz de produtor passa por `transcribeVoice`
(`api/_lib/pipeline.ts`, chamado de `fetchInboundMedia`) usando gemini-2.5-flash puro, sem
correção de léxico agrícola pós-processamento. O `INTEL.md` já registra (2026-09-01) que
"ninguém mediu transcrição PT-BR de voz de roça" — essa lacuna de medição é o que bloqueia
até a decisão, já em aberto, de trocar para o modelo de transcrição mais barato.

**O que a fonte não prova:** o léxico e as regras fonéticas do paper são 100% para línguas
índicas — zero artefato reaproveitável para português; e o repo não tem hoje nenhum dado
de quanto tráfego real é nota de voz (o único produtor ativo tem histórico majoritariamente
de texto).

**A pergunta:** vale, antes das três decisões humanas paradas (Gaia Tech, CNPJ, assinatura
do golden set), abrir uma frente nova de qualidade de voz — léxico PT-BR + golden set de
transcrição — quando ainda não sabemos se o único produtor ativo usa nota de voz? Ou isso
fica arquivado junto da decisão já aberta sobre trocar para gemini-2.5-flash-lite, até o
voo reabrir?

---

### [DISCUTIR 11/15] Diagnóstico de foto por VLM: confiança autodeclarada não serve de filtro — o goldenset já tem a rubrica pronta
**Data:** 2026-09-28 · **Fonte:** [arXiv 2609.09417](https://arxiv.org/abs/2609.09417) · **Eixos:** P3 A2 D2 E2 L2

**O que é:** benchmark com 116 datasets/834 classes/8.324 imagens agrícolas mostra que
VLMs sabem mais de agro do que mostram; um verificador de torneio contra rubrica de
diagnóstico quase dobra o F1 julgado. Mas os próprios autores encontram que a confiança do
verificador **correlaciona negativamente** com o acerto — filtrar pelas respostas mais
confiantes piora, não melhora, a precisão.

**Por que toca este projeto:** `identifyFromPhoto` (`api/_lib/reason.ts:264-296`) faz
exatamente o que o paper endereça — uma única chamada de visão com confiança autodeclarada
pelo próprio modelo, usada em `reason.ts:340,355` para decidir se hedgeia a resposta. É o
padrão frágil que o paper mostra que não funciona como filtro. `api/_lib/gym/goldeneval.ts`
já tem estrutura `must`/`must_not` tipo rubrica, mas só roda em CI, nunca em produção.

**O que a fonte não prova:** é benchmark de classificação (rótulo certo/errado), não
diagnóstico conversacional em PT-BR com produtor leigo descrevendo sintoma por texto+foto.

**A pergunta:** se o voo for PIVOTAR e a triagem por foto continuar no núcleo do produto —
vale abrir spike pra trocar a confiança autodeclarada de `identifyFromPhoto` por um segundo
passo de verificação contra o goldenset, sabendo que confiança de verificador **não** serve
como filtro simples de "só responde se confiante" (o próprio paper avisa disso)?

---

### [DISCUTIR 10/15] JÃO iAGRO: concorrente com 10 mil usuários pagantes dá dose por WhatsApp — o oposto exato da nossa aposta settled
**Data:** 2026-09-28 · **Fonte:** [jaoiagro.com](https://jaoiagro.com/) · **Eixos:** P3 A1 D2 E1 L3

**O que é:** assistente por WhatsApp criado por agrônomos + os influenciadores Primos Agro
(1,4mi seguidores), ativo desde mai/2025, com app companheiro "Gestor" e assinatura
(R$59,90/mês). Mais de 10.000 usuários declarados (42% produtores, 26% agrônomos). Ao
contrário da Stevi, **prescreve explicitamente**: o próprio site mostra "glifosato 480
g/L: 2 a 4 L/ha conforme infestação — fonte: bula oficial" — marca, dose e fonte, sem gate
de responsabilidade visível.

**Por que toca este projeto:** ataca de frente a aposta `settled` de triagem-não-prescrição
(`api/_lib/compliance.ts`, `api/_lib/prompts/system.ts`, README.md). Um concorrente com
tração real de 10k usuários é evidência de que existe demanda por resposta direta com dose
— o oposto do que o portão anti-prescrição da Stevi defende.

**O que a fonte não prova:** os números (10k usuários, breakdown por perfil) são
autodeclarados pelo site do produto, sem D7/D30 divulgado nem qualquer incidente legal ou
glosa de seguro documentado ligado à dose que ele fornece — a tese de risco jurídico é
inferência, não fato observado.

**A pergunta:** o JÃO iAGRO prova que o gate anti-prescrição da Stevi é fricção que custa
adoção, ou é o tipo de risco jurídico que, se explodir num incidente, vira o argumento de
venda da postura de triagem? Vale citar esse contraste como diferencial no README, ou é
cedo demais dado que o voo fechou sem produtor real conversando?

---

### [DISCUTIR 10/15] Google restringe acesso a Gemini 2.5 pra projetos novos — o pin em google-ai-studio ainda protege a Stevi?
**Data:** 2026-09-28 · **Fonte:** [Google AI for Developers, changelog](https://ai.google.dev/gemini-api/docs/changelog) · **Eixos:** P3 A2 D2 E2 L1

**O que é:** changelog oficial do Google (18/09) diz que o acesso aos modelos Gemini 2.5
foi restrito a "usuários que já os usaram ativamente no passado"; projetos novos são
direcionados para 3.5 Flash-Lite ou 3.8 Flash. Sem data de desligamento — os modelos
seguem servidos "until further notice" para quem já é usuário ativo.

**Por que toca este projeto:** é o mesmo assunto já arquivado em 01/09 (decisão de pinar
`google-ai-studio` por causa do desligamento do Vertex em 16/10) — mas é um fato **novo e
diferente**: não é data de desligamento, é gating de acesso a quem ainda não usa. A Stevi
é usuário ativo via OpenRouter, então o pin segue protegido — MAS o fallback de terceira
camada (`GEMINI_API_KEY` direto, `api/_lib/llmDirect.ts`, adicionado 31/08) quase nunca é
exercido em produção, e o canário (`api/_lib/canary.ts`) não pinga essa rota
especificamente.

**A pergunta:** vale um spike de ~2h pra fazer o canário também pingar o `GEMINI_API_KEY`
direto, só pra não descobrir em produção — no dia em que o OpenRouter falhar de verdade —
que o fallback de fallback perdeu acesso ao 2.5 por "inatividade"? Ou isso é engenharia de
mais pro momento pós-voo, dado que esse canal nunca disparou incidente real?

---

### [DISCUTIR 9/15] Claude Opus 5.5 lançou — vale trocar o modelo de raciocínio quando (se) houver volume de novo?
**Data:** 2026-09-28 · **Fonte:** [anthropic.com/claude-opus-5-5](https://www.anthropic.com/claude-opus-5-5) · **Eixos:** P3 A3 D1 E1 L1

**O que é:** Anthropic lançou o Opus 5.5 em 22/09: $4/MTok input, $20/MTok output (cache
read $0.20). Ganhos citados são só contra o Opus 5 anterior (Terminal-Bench 66.4% vs
52.3%, OSWorld 81.8% vs 74.0%) — nenhum benchmark compara direto com claude-sonnet-5, que
é o modelo de raciocínio hoje em produção (`api/_lib/env.ts`, `MODELS.reasoning()`).

**Por que toca este projeto:** trocar de modelo é trivial nesta stack — `ROCA_REASONING_MODEL`
já existe como env override, sem mudar código.

**A pergunta:** vale trocar `ROCA_REASONING_MODEL` para `claude-opus-5.5` quando (se)
houver produtor real gerando volume — dado que o preço é ~o dobro por token de output, o
ganho medido é só Opus-vs-Opus (não Sonnet-vs-Opus), e hoje o gargalo do Stevi é tração de
campo, não qualidade de resposta?

---

### [DISCUTIR 9/15] Capital de risco em agtech cai 33% e premia IA que age, não que aconselha — isso é argumento pra pivotar, ou é ruído dado que a decisão já não depende de VC?
**Data:** 2026-09-28 · **Fonte:** [The Shift, citando PitchBook](https://theshift.info/hot/tecnologia-precisao-agro-venture-capital-ia-2026/) · **Eixos:** P2 A1 D2 E1 L3

**O que é:** relatório da PitchBook (via The Shift) mostra US$2,4bi em 359 negócios de
agtech no 1S2026 vs US$3,7bi/484 no 1S2025 — queda de 33% em valor. A frase central citada
do relatório: "capital recompensa a IA que age, mais do que a IA que aconselha".

**Por que toca este projeto:** ataca direto a `bet` de que a Stevi "age pouco, aconselha/
alerta principalmente" — no exato momento em que os founders decidem entre matar, pivotar
ou recomeçar pós-voo.

**O que a fonte não prova:** a frase central é citação isolada do relatório, sem
comparação quantitativa; a leitura não confirma nenhuma empresa nomeada especificamente
como "IA que age vence" com dado brasileiro ou de conselho agronômico.

**A pergunta:** o memo de FECHAMENTO (11/09) já cravou MATAR/PIVOTAR qualitativo por
critérios de tração zero, independente de tese de mercado. Este dado é argumento a favor
de um pivot específico — de triagem/alerta passivo para algo com ação/resultado mensurável
— ou é ruído porque a decisão de matar/pivotar já não depende de captação de VC, e sim de
tração com produtor?

---

### [DISCUTIR 8/15] OpenRouter lança tier Business com roteamento US/EU-only — não resolve o risco de prompt logging já em aberto
**Data:** 2026-09-28 · **Fonte:** [OpenRouter, US In-Region Routing](https://openrouter.ai/blog/announcements/us-in-region-routing/) · **Eixos:** P2 A1 D2 E2 L1

**O que é:** tiers Business (fee 8% sobre créditos, vs 5,5% Standard) e Enterprise ganham
roteamento que processa a requisição inteiramente dentro da região (US ou EU), sem
fallback cross-region quando ativado.

**Por que toca este projeto:** é o mesmo fornecedor do item já aberto (`[DISCUTIR 11/15]`,
07/09, sobre prompt logging no ToS) — mas resolve um problema **diferente**: onde o dado é
processado, não o que a OpenRouter pode fazer com ele depois (a Seção 6.1-6.5 do ToS
continua valendo dentro de qualquer região). Volume do Stevi (~20 msgs/produtor/mês, 1
produtor real) torna o fee irrelevante; mais relevante é que region-lock sem fallback
cross-region vai na direção contrária da diversificação recém-feita em #14.

**A pergunta:** vale registrar como contexto de mercado (OpenRouter formalizando tiers de
compliance pós-Stripe) sem ação, já que não resolve o risco de ToS já em aberto e o
projeto está sem recomendação de mais engenharia? Ou existe motivo de LGPD/cliente
institucional que tornaria residência de dados relevante antes do que o volume atual
sugere?

---

### [DISCUTIR 8/15] Um framework acadêmico nomeia a "irresponsabilização constitutiva" de IA — munição pro impasse do goldenset com o Michel?
**Data:** 2026-09-28 · **Fonte:** [arXiv 2608.12104](https://arxiv.org/abs/2608.12104) · **Eixos:** P2 A1 D2 E1 L2

**O que é:** framework de 9 categorias/20 temas (revisão de literatura + 27 entrevistas)
sobre como configurações de atores/sistemas tornam a responsabilização por dano de IA
inviável na prática, não só difícil de reformar. Inclui instrumento diagnóstico de 20
perguntas para localizar vazios de accountability.

**Por que toca este projeto:** nomeia com precisão acadêmica o `known_gap` já registrado —
o goldenset (`knowledge/goldenset/goldenset.jsonl`) tem **38/38 casos com `verified_by`
nulo**, confirmado de novo nesta rodada. A assinatura com o Michel é uma das três decisões
humanas paradas há 65+ dias.

**O que a fonte não prova:** é estudo qualitativo (entrevistas + um caso ilustrativo não-
agro, OpenClaw), sem métrica quantitativa nem recomendação prescritiva de ação para quem
opera o sistema.

**A pergunta:** vale levar esse framework ao Michel como argumento final para destravar a
assinatura antes do encerramento formal — ou a própria paralisia de 65 dias já É a prova
empírica do argumento do paper (a estrutura torna a responsabilização inviável), e por
isso deveria entrar no memo de encerramento como explicação do fracasso, não como tarefa
pendente?

---

### [DISCUTIR 8/15] "GOLDEN FACTS" curados por especialista + fine-tuning — o nome ecoa o goldenset, mas falta a curadoria de base antes de cogitar isso
**Data:** 2026-09-28 · **Fonte:** [arXiv 2603.03294](https://arxiv.org/abs/2603.03294) · **Eixos:** P2 A0 D2 E2 L2

**O que é:** arquitetura híbrida que separa fine-tuning LoRA sobre "GOLDEN FACTS" — fatos
atômicos curados por especialista (dados de Bihar, Índia) — de uma camada de "stitching"
conversacional. Mede recall/precisão/detecção de contradição contra LLMs de fronteira sem
grounding.

**Por que toca este projeto:** o Stevi não tem pipeline de treino nem GPU dedicada — só
chama APIs de terceiros (`api/_lib/llm.ts`, `llmDirect.ts`) — então fine-tuning LoRA está
fora de alcance. Mas o pré-requisito do paper (fatos "GOLDEN" já curados/verificados) é
exatamente o que falta: `knowledge/goldenset/goldenset.jsonl` tem 0/38 casos com
`verified_by`.

**A pergunta:** o nome "GOLDEN FACTS" é coincidência, ou você quer tratar este paper como
o desenho-alvo de como a curadoria do goldenset deveria ficar (fatos atômicos verificados
por agrônomo) antes de sequer cogitar fine-tuning — ou fechar a verificação dos 38 casos
com o método atual (lookup + prompt) já resolve o que importa, sem migrar pra LoRA?

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
aberto até alguém confirmar manualmente? *(Ver também o item de 28/09 sobre o tier
Business/roteamento regional da OpenRouter — mesmo fornecedor, risco diferente.)*

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
aposta, não contra. *(Ver também o item de 28/09 sobre IAgro.ai no Radar — segundo
exemplo do mesmo padrão, mais fraco: zero avaliações na App Store.)*

**A pergunta:** vale citar o Café 360 (app pago, mesma região, IA embutida, 100+
downloads) como exemplo concreto no README de posicionamento — ou n=1 concorrente
pequeno é fraco demais pra virar argumento citável, e a melhor ação é só arquivar como
mais um data point?

## Fila de trabalho

_vazio — nona rodada seguida sem PROTOTIPAR/IMPLEMENTAR. O projeto fechou o voo de 60 dias
em 11/09 com recomendação explícita de não fazer mais engenharia até 3 decisões humanas
saírem do papel; mesmo os itens desta rodada com score bruto de PROTOTIPAR (voice pipeline
12/15, VLM rubric 11/15) foram travados em DISCUTIR pela `verdict_note` — melhorar
qualidade de transcrição/diagnóstico é capacidade pura, não CONVERSAR nem ALERTAR. A
rubrica está fazendo exatamente o que deveria: numa semana em que o próprio projeto pede
menos código, o `/intel` não empurra mais código._

## Radar

- `2026-09-28` **Tellia (SF/Paris) levanta $5M pré-seed para voz+WhatsApp virarem registros estruturados de campo.** 80% DAU autodeclarado entre equipes de campo em até 2 meses; vende B2B/API para fazendas comerciais e vinícolas nos EUA/Europa, sem tocar café ou Brasil. Mais uma validação externa de `bets[0]` (WhatsApp/voz sem app), no mesmo padrão do Café 360 e do App do Cacau já registrados. [Vestbee](https://www.vestbee.com/insights/articles/tellia-lands-5-m) · 7/15
- `2026-09-28` **Raízes Digitais (LAPIS/CEFET-MG) mira o mesmo beachhead — café, Sul de Minas — mas via Telegram e RAG denso.** Projeto acadêmico, 1 autor, 14 commits em 3 rajadas, zero evidência de uso real. Confirma que o nicho geográfico específico já atraiu atenção acadêmica, mesmo sem tração; stack (RAG+pgvector+Telegram) é exatamente o que o Roça já avaliou e rejeitou (ver item de 31/08 sobre AgriRegion). [GitHub](https://github.com/RogerinDev/raizes-digitais) · 6/15
- `2026-09-28` **IAgro.ai — mais um assistente de IA agro que exige baixar app, sem qualquer evidência de tração.** Cobertura nacional genérica (maçã como único exemplo, não café), App Store sem avaliações suficientes para mostrar nota. Segundo data point (mais fraco que o Café 360, 8/15 em aberto) para a mesma pergunta: apps de IA no agro falham por atrito de instalação. [iagro.ai](https://iagro.ai/) · 5/15
- `2026-09-28` **Survey de composição de notificação por LLM cita caso DoorDash (+1,8% engajamento por linguagem) — mas o mesmo paper diz que guarda de factualidade é arquiteturalmente essencial.** É sobre O QUÊ dizer no alerta (complementar, não o mesmo movimento do item já aberto sobre QUANDO disparar). Trocar o template fixo de geada/queimada por LLM dinâmico sem guarda de alucinação é risco real de campo — fica registrado, não vira spike. [arXiv](https://arxiv.org/abs/2605.16264) · 7/15
- `2026-09-28` **Grounding curado/determinístico bate RAG denso e self-hosted em baixo recurso — segundo paper convergente, zero em português.** Assistente agronômico grego (ilha, MCP + interface de dados curada) argumenta, sem medir, que arquitetura gerenciada+curada é mais confiável que self-hosted — mesma tese do item já registrado em 24/08 ("RAG denso desaba em fala de produtor"). Vindicação da escolha arquitetural já `settled` do Roça (lookup determinístico, zero RAG denso, zero self-host), não achado novo. [arXiv](https://arxiv.org/abs/2606.25647) · 6/15
- `2026-09-07` **DigiFarmz relançou "Daz" — mas é feature dentro de SaaS B2B de soja/trigo, não concorrente direto.** A data original parecia 22/09/2026 (futura); confirmada no HTML: é notícia de **set/2025**, republicada. O Daz é a camada WhatsApp de uma plataforma paga (Cropper/Linkage) de uma agtech de Champaign-IL com operação BR/EUA/Paraguai, focada em manejo fitossanitário de soja/trigo em fazendas comerciais grandes — sem café, sem gratuidade, sem sobreposição de segmento com o beachhead. Valida que "alerta proativo por WhatsApp" é padrão de indústria, não ensina mecanismo novo. [Global Crop Protection](https://globalcropprotection.com/noticias/novas-tecnologias/digifarmz-apresenta-daz-assistente-virtual-que-leva-inteligencia-artificial-ao-dia-a-dia-do-produtor-rural/) · 7/15
- `2026-09-07` **Agro Amazônia triplica conversas com o Meta Business Agent (via Zenvia) em uma semana.** Distribuidora de insumos (subsidiária Sumitomo) roda piloto do agente nativo da Meta no WhatsApp — de 420 para 1.400+ conversas/semana. É SDR de vendas, não conselho agronômico, mas mostra a velocidade com que fornecedores de insumo estão automatizando o mesmo canal — e que a Meta já oferece agente nativo, baixando a barreira para qualquer revenda/cooperativa montar o próprio bot. [RBTV](https://rbtv.com.br/noticia/7058/agroamazonia-triplica-conversas-com-agente-de-ia) · 5/15
- `2026-09-07` **FAIRY: motor agentic orientado a evento para soja full-season, implantado numa fazenda real.** Orquestra maquinário/drone/sensor/clima sob paradigma "tudo é evento", avaliado com 9 controladores sobre 100 safras simuladas (SIGSPATIAL 2026). Não fala de timing de notificação a humano (não duplica o item já aberto sobre horário de alerta) e exige hardware que o Stevi não tem e não vai ter neste voo. [arXiv](https://arxiv.org/abs/2609.00106) · 6/15
- `2026-09-07` **EGT-KG: grafo de conhecimento tipado melhora QA científico em modelo pequeno — mas em domínio distante e sem transferência clara.** +12-15% sobre RAG denso em corpus de 30 papers de materiais de construção (não agronomia), ganho inconsistente entre modelos, sem código liberado. O grounding do Stevi (`api/_lib/tools/agrofit.ts`) não tem o problema que este paper resolve — é lookup determinístico sobre registro estruturado, não retrieval fragmentado. O gap real de cobertura (`reason.ts:253`, só 5 culturas) fecha com curadoria de dados, não arquitetura de retrieval. [arXiv](https://arxiv.org/abs/2609.00479) · 5/15
- `2026-08-31` **CooperRita já tem vendor de IA (Crawly) — e é prospect nomeado do ICP do Stevi.** O iUai, lançado em jan/2026, é chatbot de marca sobre café e queijo regional, não conselho agronômico — mas mostra que uma cooperativa de café do Sul de Minas, dentro do beachhead, já assinou com um fornecedor de IA. Gancho de prospecção, não ameaça de produto. [Itatiaia](https://www.itatiaia.com.br/agro/ia-mineira-cooperativa-lanca-ferramenta-que-entende-de-queijo-e-cafe) · 6/15
- `2026-08-31` **Preço do Claude Sonnet 5 não sobe.** A Anthropic tornou permanente o preço introdutório ($2/$10 por MTok) e cancelou o aumento pra $3/$15 que estava marcado pra 01/09 — custo do modelo de raciocínio da Stevi via OpenRouter fica igual. *(Ver item de 28/09: Opus 5.5 lançado com preço $4/$20 — comparação direta contra Sonnet 5 ainda não publicada pela Anthropic.)* [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing) · 6/15
- `2026-08-31` **AgriRegion confirma a tese, mas o Stevi já resolveu melhor.** Paper de RAG geoespacial (Carolina do Norte, sem código liberado) valida "conselho agrícola precisa ser regional" — mas o vazio sanitário de SP, o bug real da semana, foi fechado com lookup determinístico de município (`vazioRegiao.ts`), não com retrieval. Generalizar pro método do paper seria trocar solução exata por probabilística sem necessidade. [arXiv](https://arxiv.org/abs/2512.10114) · 5/15
- `2026-08-31` **Farmtech contrata crédito agrícola dentro do WhatsApp da revenda.** "Jornada ao Produtor" formaliza CPR-f digital na mesma conversa que já existe entre revenda e produtor; projeção de R$500-700mi na safra 26/27. Categoria diferente (crédito, não conselho), mas valida de leve a aposta de canal. [AgFeed](https://agfeed.com.br/grande-slam-do-agro/andav/farmtech-aposta-no-whatsapp-para-destravar-a-ultima-milha-do-credito-agro/) · 5/15
- `2026-08-24` **RAG denso desaba em fala de produtor — e a Stevi não usa RAG denso.** Recuperação densa cai a R@10 = 0,093 em pergunta coloquial contra 0,970 em pergunta formal (bengali, 1.000 consultas, 2.882 nós de 284 publicações oficiais); BM25 híbrido lidera com 0,539. A Stevi já busca por **chave**: `extractPestTarget` normaliza a fala em `{cultura, praga}` canônico com o tier barato antes da busca, e `lookupPest` casa por token — zero embeddings no repo inteiro. Fica registrado como razão documentada para **não** trocar o grounding por embeddings. E o goldenset já está em linguagem de roça ("manchas alaranjadas na parte de baixo, tipo um pó"), então não há o que reescrever. *(Segunda vindicação da mesma escolha em 28/09 — ver acima.)* [arXiv](https://arxiv.org/abs/2608.14886) · 7/15
- `2026-08-24` **RAImundo (Embrapa/MAPA/MDA/AZap.AI) segue sem sinal público desde out/2025.** Versão definitiva prometida para o 2º semestre de 2025 nunca teve lançamento evidenciado, nenhum número além de 2.900 interações em beta, nenhuma página oficial em embrapa.br ou gov.br. **Descartado pelo gate G3** — o repo já registrou a mesma leitura em 25/jul (`.claude/plans/2026-07-25-curadoria-loop/README.md`), com a ação já decidida (monitorar trimestralmente, não tratar como bloqueador de GTM). A varredura de hoje reforça a conclusão sem alterá-la. *(Confirmado de novo em 28/09 — segue sem sinal.)* · 8/15, descartado por dedup

## Arquivo

- `2026-09-28` **[era DISCUTIR 10/15] O primeiro alerta sai às 08:00 para todo mundo? — envelheceu sem decisão.** Aberto em 24/08 (35 dias atrás), nunca respondido pelo Stefano. Nesta rodada chegaram dois papers relacionados (framework de proatividade genérico, arXiv 2609.03727, e composição de notificação por LLM, arXiv 2605.16264) que reforçam a pergunta original sem resolvê-la — nenhum muda o fato de que o cron continua em `0 11 * * *` para os três tipos de alerta. Arquivado por regra de manutenção (>21 dias sem decisão), não porque a pergunta perdeu relevância — ela segue de pé para quando o canal reabrir.
- `2026-09-28` **[era DISCUTIR 10/15] A partir de 01/10 não sobra caminho gratuito no WhatsApp — envelheceu sem decisão, e 01/10 é em 3 dias.** Aberto em 24/08, nunca respondido. A análise original mostrava que o alerta não encarece (`alertSendPlan` já cai em `template`, que já é pago), mas que o risco real é **continuidade de cobrança**: falha de pagamento na WABA passa a silenciar toda resposta da Stevi, não só o alerta. Arquivado por regra de manutenção, mas com aviso: **01/10/2026 é daqui a 3 dias** — vale confirmar rapidamente se o método de pagamento da WABA está válido e fundeado, independente do arquivamento formal.
- `2026-09-07` **[era DISCUTIR 10/15] A Fecon aconteceu 1–3/09 — e gerou zero cadastros, apesar do kit pronto.** O kit (`64152d6`) e a regra de vouch (`527120b`, token `#fecon` vs. `#fecon-cartaz`) foram shipados dias antes da feira. Medição de 07/09 no banco: `users.source ilike '%fecon%'` retorna **zero linhas**; só 1 usuário novo entrou no banco desde 31/08 (`kind='empresa'`, não produtor). O repositório não registra se o Stefano foi e não usou o kit, ou não foi — mas o resultado é o mesmo: a única janela de campo dentro do voo de 60 dias não converteu ninguém. Movido pro Arquivo como resultado, não como decisão pendente — a pergunta original ("você vai?") não faz mais sentido perguntar, a janela fechou.
- `2026-09-01` **[era DISCUTIR 10/15] A OpenRouter virou parte da Stripe — decidido: diversificar em duas camadas, sem esperar mudança de termos.** O Stefano mandou ir fundo e liberou trocar modelo. Confirmado com as fontes primárias que a aquisição foi anunciada pelas DUAS partes em 19/08 ("same product, same roadmap", closing pendente) — promessa, não contrato. Entraram: fallback direto por chave (`api/_lib/llmDirect.ts`, Anthropic Messages API e endpoint OpenAI-compat do Google AI Studio) em #13, e chave RESERVA do OpenRouter — conta separada, a do projeto twin-me — como camada 1 em #14, já configurada em produção (`OPENROUTER_FALLBACK_API_KEY`) com redeploy feito. O gateway deixou de ser ponto único. [Stripe](https://stripe.com/newsroom/news/stripe-agrees-to-acquire-openrouter) · [OpenRouter](https://openrouter.ai/blog/announcements/openrouter-is-joining-stripe/)
- `2026-09-01` **[era DISCUTIR 10/15] O Google já tem data pra desligar o Gemini 2.5 — decidido: pinar `google-ai-studio` agora, sem esperar a data oficial.** A checagem nas páginas do Google fechou a dúvida das duas datas: 16/10/2026 está confirmado nos release notes do **Vertex**; a página de model-versions cita 20/10 e o Google não resolveu a contradição (planejamos pelo 16). O que decide é outra coisa: a **API pública segue "no shutdown date announced"**, então o pin desacopla a transcrição do prazo do Vertex inteiro. Implementado em #13 (`ROCA_TRANSCRIBE_PROVIDER`, default `google-ai-studio`, `any` desliga), com o canário pingando o tier de transcrição pelo MESMO pin — senão validaria caminho que o produtor não usa. Modelo mantido: `gemini-2.5-flash-lite` seria mais barato em áudio (US$0,30/M vs 1,00) mas ninguém mediu transcrição PT-BR de voz de roça nele; trocar default sem golden de transcrição fica em aberto. **Adendo 28/09:** Google restringiu acesso aos modelos 2.5 na API pública a partir de 18/09 (só usuários já ativos) — ver item novo em "Em aberto" com a pergunta específica sobre o fallback de terceira camada. [Vertex release notes](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes) · [deprecations da API pública](https://ai.google.dev/gemini-api/docs/deprecations)
- `2026-09-01` **[era DISCUTIR 8/15] O JoIA da CNA — decidido: citar a base pública, e ela ancora uma resposta que saía rasa.** A leitura a fundo confirmou o desenho do concorrente (WhatsApp, gratuito, número (61) 99844-8367, lançado 25/08, rollout na Expointer) e, mais útil, o **status legal da base**: os boletins mensais do Campo Futuro (CNA/Senar; café elaborado pelo CIM/UFLA) trazem impresso "Reprodução permitida desde que citada a fonte". Não é território deles — é fonte pública. Implementado em #13: `api/_lib/tools/custos.ts` detecta pergunta de custo (que não é cotação e caía no caminho `general` sem base nenhuma) e injeta estrutura COE/COT, a citação, e a honestidade de que o número público é da propriedade MODAL da região, não da lavoura dele — com o gancho pro caderno, que é o dado que só a Stevi tem. Nenhum número embutido no código: boletim é mensal. Caso novo no goldenset (`custo-producao-cafe`). Confirmado também que o JoIA é **só reativo** — nenhuma fonte menciona alerta proativo, o que mantém a `bets[1]` de pé. **Nota 28/09:** a Stevi rodou estande na Expofeira (BA, 06-07/09) dando continuidade ao mesmo lançamento — sem fato novo relevante à decisão já tomada. [CNA](https://cnabrasil.org.br/noticias/sistema-cna-senar-leva-joia-projeto-comprador-e-produtos-artesanais-a-expointer) · [boletim Ativos Café](https://www.cnabrasil.org.br/storage/arquivos/icones/Ativos-Cafe-Campo-futuro-Agosto-2024-CNA.pdf)
- `2026-09-01` **[era DISCUTIR 8/15] O estudo da FDC — decidido: citar na CONVERSA, não no template. E o registro de 31/08 estava errado num ponto que mudava a ação.** O título daquele item dizia que o estudo "nomeia, com dirigente e faturamento". Abrindo o PDF: ele **anonimiza** — a Tabela 1 traz perfis (fundação, cidade, nº de associados, faturamento 2024) e o cargo do entrevistado, sem nome de cooperativa nem de dirigente. Dá pra inferir que o perfil de Guaxupé com R$10,7 bi é a Cooxupé, mas isso é inferência nossa, não citação; atribuir número do estudo a uma cooperativa nominal seria inventar fonte. Implementado em #13 com essa trava explícita no prompt da Vitória (`prospect/agent.ts`), junto da munição citável (15 dirigentes de MG, 22 barreiras, recomendação de parceria com startups e IA na interação com o cooperado) e da resposta pronta à objeção de propriedade de dados, que o estudo documenta na voz do cooperado ("eu não vou passar não, porque eu não sei para onde que vai isso"): consentimento LGPD + exclusão a pedido, caso técnico devolvido aos agrônomos da cooperativa, sem venda de dados, contrato escala pro Stefano. O template aprovado `stevi_parceria_coop_v1` **não muda** — bloco de texto em template frio morre no porteiro-robô (medição de 05/ago) e corpo aprovado exige re-submissão à Meta; a citação vive onde há humano lendo. [Zenodo (DOI 10.5281/zenodo.17604355)](https://zenodo.org/records/17604355)
- `2026-09-01` **[achado colateral, virou #15] A rede de resgate era silenciosa — e o alerta de crédito não cobria o caso.** Simulando a queda da chave principal contra a API real (não mock), o OpenRouter devolveu `401 "User not found"`, que **não** é `isCreditError`: a reserva seguraria todo o tráfego sem nenhum alerta, só `log.error` na Vercel, enquanto o saldo do outro projeto escoava. Chave revogada é justamente o cenário de aquisição que motivou a reserva existir. #15 faz as duas camadas de resgate avisarem os fundadores (cooldown de 10 min, `fireAndForget`, texto nomeando camada/modelo/motivo). Não é item de intel — é o que a verificação achou, e fica aqui porque nasceu desta rodada.
- `2026-08-31` **[era DISCUTIR 9/15] Em 30/08 o cron tenta o alerta de vazio de MT sozinho — resolvido por código, não por decisão do Stefano.** No mesmo dia em que o item foi aberto (24/08), `def021c` filtrou `listSojaFarmersByUf`/`listFarmsWithCoords` por `kind='produtor'`, e `7e891f5` completou a cobertura de UF. Medição de 31/08 no banco confirma: a única farm com soja em MT é `kind='teste'` e o filtro a exclui — o cron de 30/08 não vai contaminar `farmer_alerts`. Movido pra cá porque a pergunta original (disparar pra teste ou filtrar antes?) já tem resposta no código, não porque o Stefano decidiu.
