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
> **Quinta passada (2026-11-09) — 63 dias de lacuna, a maior desta rotina.** Nesse
> meio-tempo o voo de 60 dias fechou (11/set) com veredito qualitativo MATAR/PIVOTAR
> (ver `STATE.md`) e o repositório ficou 59 dias sem um commit de engenharia — só memos
> semanais do PM do Scorecard. Feed do resumo matinal veio vazio de novo pra Roça (mesmo
> JSON de 22/08, stale); cinco scouts, ~33 candidatos brutos, onze lidos a fundo por um
> analista cada. **Sete DISCUTIR, treze REGISTRAR, o resto DESCARTAR — de novo zero
> PROTOTIPAR, zero IMPLEMENTAR**, sétima rodada seguida sem spike (a sequência já é mais
> longa que o voo de 60 dias inteiro). Os cinco itens "Em aberto" das rodadas de
> agosto/setembro (horário de alerta, cobrança do WhatsApp em 01/10, App do Cacau, Café
> 360, prompt logging da OpenRouter) passaram de 21 dias sem decisão do Stefano e foram
> pro Arquivo — dois reabrem nesta rodada com evidência nova (ver items 5 e 6 abaixo).
> Achado mais forte: duas dependências de plataforma com relógio correndo e sem pedir
> nenhuma linha de código — a API pública do Gemini 2.5-flash corta sozinha pra outro
> modelo em 01/12/2026 (22 dias), e a API REST do SoilGrids está confirmada fora do ar
> sem ETA (já mitigada por fail-soft + cache, mas pede uma decisão, não um commit).
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

## Em aberto — precisa de decisão do Stefano

### [DISCUTIR 12/15] A API pública do Gemini 2.5-flash corta sozinha em 01/12/2026
**Data:** 2026-11-09 · **Eixos:** P3 A2 D2 E2 L3
**Fonte primária:** [Google AI Studio, changelog oficial](https://aistudio.google.com/docs/changelog)

**O que é:** a entrada de 02/11/2026 do changelog oficial do AI Studio deprecia
`gemini-2.5-flash` — "is deprecated and is no longer available to select". A partir de
**01/12/2026**, toda requisição a esse model string é roteada automaticamente para
`gemini-3.5-flash-lite` e cobrada nesse preço, sem exigir mudança de código do chamador.
Uma entrada anterior do mesmo changelog (18/09) dizia o contrário — que os modelos 2.5
"are not deprecated and will continue to be served until further notice". A de novembro
suplanta a de setembro.

**Por que toca este projeto:** `api/_lib/env.ts:19` (`MODELS.transcribe`, default
`'google/gemini-2.5-flash'`) e `:23-33` (`transcribeProviderPin()`, default
`'google-ai-studio'`) pinam a transcrição exatamente nesse model string e nesse provider
— e o próprio comentário do código, espelhado na decisão arquivada de 2026-09-01 neste
arquivo, justificava o pin dizendo que "a API pública segue sem data de desligamento
anunciada". Essa frase agora é falsa: há data (01/12) e o auto-routing já está
documentado. A premissa que sustentou a decisão de setembro caiu.

**Por que isso não vira código sozinho:** troca de model string é manutenção defensiva
de infraestrutura, não nova capacidade de conversar ou alertar — por isso o score bruto
(12, que cairia em PROTOTIPAR) trava em DISCUTIR pela `verdict_note`. E não há golden
set de transcrição PT-BR de voz de roça contra `gemini-3.5-flash-lite` — ninguém mediu
se o auto-routing silencioso mantém qualidade.

**A pergunta:** restam 22 dias até 01/12. Três caminhos: (a) deixar o auto-routing
acontecer em silêncio e confiar no canário de fallback pra pegar degradação; (b) pinar
`ROCA_TRANSCRIBE_MODEL=gemini-3.5-flash-lite` agora e rodar o golden eval de transcrição
antes do corte; ou (c) revisitar `ROCA_TRANSCRIBE_PROVIDER=any` e olhar outro provider,
já que a premissa de setembro caiu. Qual?

---

### [DISCUTIR 10/15] Nenhum caso de foto no goldenset foi verificado — e dois achados novos quantificam por quê
**Data:** 2026-11-09 · **Eixos:** P2 A2 D2 E3 L2
**Fontes primárias:** [Hallucination Behavior in Multimodal LLMs Across Agricultural Image Tasks, arXiv](https://arxiv.org/abs/2605.27595) · [Configurable Multi-Stage Vision Pipeline for Crop Disease and Pest Diagnosis (FarmerChat/Digital Green), arXiv](https://arxiv.org/abs/2609.21651)

**O que é:** dois achados do mesmo movimento (confiabilidade de diagnóstico por foto em
IA agrícola), fundidos num só item. O primeiro mede VLMs pequenos (Gemma3, LLaVA,
Qwen2.5-VL, MiniCPM) em fotos reais de lavoura: 63-75% de acurácia zero-shot, caindo a
74,7% mesmo em casos difíceis com um exemplo de referência. O segundo é o pipeline de
produção do FarmerChat (Digital Green, 1,16M fotos reais, Etiópia/Índia/Quênia/Nigéria):
numa rota de chamada única com confiança própria e pedido de foto melhor — o padrão mais
parecido com o que a Stevi faz hoje — o modelo **superpede foto em 57,5% dos casos**,
inclusive em 1.288 de 2.452 linhas onde já tinha acertado cultura e problema.

**Por que toca este projeto:** `api/_lib/reason.ts:263-351` (`identifyFromPhoto`) pede
foto melhor condicionado à confiança autorreportada pelo próprio modelo — exatamente o
padrão que o FarmerChat mostra que superpede. E `knowledge/goldenset/goldenset.jsonl`
tem 37 casos, todos com `verified_by=null`; os casos de `pest_triage` (ferrugem,
lagarta) são só pergunta em texto, nenhum com foto real testada contra o pipeline de
visão da Stevi (`claude-sonnet-5`, que nenhum dos dois papers testou diretamente).

**Por que isso não vira código agora:** validar com as poucas fotos reais que a Stevi já
recebeu é um spike de medição, não uma feature — e a `verdict_note` trava risco de
alucinação/validação agronômica em DISCUTIR mesmo com score alto, porque não ajuda
diretamente a CONVERSAR nem a DISPARAR ALERTA.

**A pergunta:** vale abrir casos de foto real (praga/doença) no goldenset, revisados por
um agrônomo, antes de expandir cobertura de cultura — dado que modelos comparáveis erram
25-37% em zero-shot e que o padrão "pede foto melhor por confiança própria" tende a
superpedir? Ou isso é prematuro com 1 produtor real e o voo encerrado há quase dois
meses, sem commit de engenharia há 59 dias?

---

### [DISCUTIR 9/15] A Culttivo já roda crédito a cafeicultor em escala — isso mata a tese do caderno→PRONAF, ou abre uma porta B2B?
**Data:** 2026-11-09 · **Eixos:** P2 A2 D2 E1 L2
**Fontes:** [LetsMoney, 12/09/2026](https://www.letsmoney.com.br/fintech/culttivo-fintech-cafe-acelera-credito/) · [TheAgriBiz (mecanismo, jun/2025)](https://www.theagribiz.com/agtechs/agfintech/culttivo-quer-r-130-milhoes-para-dar-credito-a-produtores-de-cafe)

**O que é:** a Culttivo origina crédito ao cafeicultor via um Fiagro FIDC, combinando
dados do produtor com imagem de satélite e modelo de risco próprio (parceria Serasa
Experian reduz análise de risco de 8h pra 3min), distribuído por 150+ parceiros
(cooperativas, tradings, revendas) e validado por visita mensal de campo. Números à
imprensa (autodeclarados): ~1.000 tomadores ativos numa base de 8.000+, meta de R$500M
desembolsados em 2026 (vs. R$300M em 2025), inadimplência <2%. Não há WhatsApp, chatbot
nem conselho agronômico em nenhuma fonte — é fintech de crédito pura, contato humano via
vendas/parceiros.

**Por que toca este projeto:** `known_gaps` já registra que a tese de monetização
caderno→crédito (PRONAF) nunca saiu do papel; o repo já tem `api/_lib/report/financing.ts`
e `api/report.ts?kind=pronaf` prontos e testados
(`tests/financing-report.test.ts`), sem nenhum parceiro usando.

**O que a fonte não prova:** se o ticket médio (~R$500 mil por tomador, a julgar pela
meta/base) corresponde ao perfil 5-50ha do beachhead Sul de Minas/Caparaó, ou se é
produtor maior.

**A pergunta:** a Culttivo roda crédito a café em escala real, com 150 parceiros fazendo
distribuição e visita de validação de campo — isso mata a ideia de a Stevi tentar ser
credora/intermediária de crédito sozinha, ou abre a janela de posicionar o relatório
PRONAF já pronto como insumo B2B pra lenders como a Culttivo reduzirem o custo da visita
de campo deles?

---

### [DISCUTIR 9/15] A API REST do SoilGrids está confirmada fora do ar, sem ETA — mas o código já absorve isso
**Data:** 2026-11-09 · **Eixos:** P3 A1 D1 E3 L1
**Fonte primária:** [ISRIC, FAQ oficial do SoilGrids](https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html)

**O que é:** a FAQ oficial da ISRIC declara "have decided to temporarily pause the
service" e "we cannot provide an estimated timeline for when the service will be
restored". O analista bateu direto em `rest.isric.org/soilgrids/v2.0/...`: o TLS fecha
normalmente, mas a requisição HTTP nunca responde (timeout de 45s), contra
`soilgrids.org` (o viewer), que devolve 200 OK no mesmo teste — confirma que o serviço
está mesmo fora do ar hoje, não é só um aviso antigo esquecido na página.

**Por que toca este projeto:** SoilGrids é `platform_dep` declarado, chamado em
`api/_lib/tools/soil.ts`, usado tanto no card do WhatsApp (`api/card.ts`) quanto no card
web (`api/_lib/farmcard.ts`).

**Por que isso não é uma emergência:** `soil.ts` já comenta "the public REST API has
known outages — every call here fails soft to null", já cacheia permanentemente por
fazenda, e `api/_lib/canary.ts:123-126` já sonda esse endpoint e só alerta founders em
transição de estado. A engenharia certa já está no código — não há arquivo que este item
mudaria por si só.

**A pergunta:** vale trocar pra WCS/WebDAV (que o próprio ISRIC recomenda como estável)
agora, ou isso fica como os outros `known_gaps` de dado externo — sem prioridade
enquanto não há produtor real sentindo a diferença?

---

### [DISCUTIR 8/15] O horário único de alerta (08:00 pra todo mundo) reabre — com um mecanismo mais caro do que o Stevi pode alimentar hoje
**Data:** 2026-11-09 · **Eixos:** P2 A1 D2 E1 L2
**Fonte primária:** [PRISM: Festina Lente Proactivity, arXiv (v2)](https://arxiv.org/abs/2602.01532)

**O que é:** o PRISM só dispara uma notificação proativa quando a probabilidade
calibrada de aceitação do usuário passa um limiar derivado do custo de alarme falso vs.
ajuda perdida. No benchmark próprio do paper (ProactiveBench, baselines não nomeadas),
reduz falsos alarmes em 22,78% e sobe F1 em 20,14%. Código ainda "Coming Soon" — nada
reproduzível hoje além do modelo no Hugging Face.

**Por que toca este projeto:** é o item de 24/08 sobre `vercel.json`'s `0 11 * * *` (um
cron único de 08:00 BRT pra geada, queimada e vazio sanitário) — esse item envelheceu
sem decisão e foi pro Arquivo nesta rodada, mas o PRISM reabre a mesma pergunta com
evidência adicional.

**Por que isso não vira código:** o mecanismo central do PRISM exige histórico de
aceites/rejeições de alerta pra calibrar a probabilidade — e `farmer_alerts` tem 2
linhas na história inteira, ambas de fixture, `messages.intent` vem NULL, zero
telemetria de abertura. Não há dado pra calibrar nada, e nem o código do paper existe
ainda.

**A pergunta:** antes de cogitar qualquer técnica de calibração (PRISM ou não), vale
decidir a versão mais simples que já estava na mesa em agosto — horário por **tipo** de
alerta (geada na véspera à noite, queimada na hora, vazio em horário comercial) em vez
de um cron único — e, só se isso for implementado, instrumentar abertura/resposta por
alerta para que uma calibração real tenha dado futuro pra trabalhar?

---

### [DISCUTIR 8/15] ~32% da área cafeeira de MG está fora de cobertura 4G/5G — e o known_gap de produtor offline nunca foi medido com número
**Data:** 2026-11-09 · **Eixos:** P2 A1 D2 E2 L1
**Fonte primária:** [Mensuração da conectividade digital nas áreas produtoras de café no Brasil, SIA UFV 2025](https://www3.dti.ufv.br/sia/vicosa/2025/trabalhos/22000/arquivo)

**O que é:** pôster acadêmico (SIA UFV, Ricardo et al.) cruza mapeamento de lavouras de
café por município (MapBiomas), cobertura móvel 4G/5G (Anatel) e área/produtividade
(IBGE/PAM). De 1,27 milhão de ha de café no Brasil, 69% está dentro de polígono de
cobertura — com forte variação estadual: PR 81,8%, ES 79,5%, SP 76,3%, **MG 67,8%**
("limitado pelo relevo e predominância de pequenas propriedades" — nas palavras do
próprio pôster), BA 40,7%, GO 10,5%. É cobertura de sinal declarada, não uso real
medido.

**Por que toca este projeto:** `known_gaps` já diz que "operação offline do lado do
PRODUTOR continua aberta" e que não há fila de retentativa por destinatário nem
detecção de celular sem sinal (`api/_lib/alerts.ts`, `api/cron/monitor.ts` cobrem só o
lado servidor com `orcamento.ts`/`fallbackReply.ts`/`retry.ts`). Este estudo é a primeira
vez que esse gap vem com um número para o estado do beachhead (MG), e relevo é
exatamente o terreno do Sul de Minas.

**O que a fonte não prova:** o número de MG é estadual, não recortado pro Sul de Minas
especificamente — pode ser melhor ou pior localmente.

**A pergunta:** dado que o loop proativo ainda não tem nenhum produtor real como alvo
(medido em 03/09, 07/09 e de novo nesta rodada), vale priorizar fila de
retentativa/detecção de sinal agora, ou é prematuro enquanto não há volume de produtores
reais pra sentir o problema?

---

### [DISCUTIR 8/15] Terceiro agtech com clientes B2B reais aposta em "WhatsApp + agro + gratuito" — fora do Brasil, por ora
**Data:** 2026-11-09 · **Eixos:** P2 A1 D2 E1 L2
**Fonte:** [Diario Financiero Chile, 15/04/2026](https://www.df.cl/df-lab/innovacion-y-startups/instacrops-ampliara-su-portafolio-de-agentes-de-ia-que-operan-por-whatsapp)

**O que é:** a Instacrops (agtech chilena com clientes B2B reais — Westfalia, Copefrut,
Dole, Greenland, Nestlé) lança um agente de IA gratuito por WhatsApp pra poda, geada e
nutrição, usando sensores de campo e satélite. Opera em Chile, Peru, México, Colômbia,
Uruguai, Guatemala e Argentina — sem confirmação de Brasil nem de café. Em paralelo,
lança plataforma pra produtores montarem agentes próprios.

**Por que toca este projeto:** é o terceiro sinal independente (depois de App do Cacau e
Café 360, já arquivados nesta rodada) do mesmo padrão — "WhatsApp + agro + gratuito" —
mas desta vez vindo de um agtech com clientela B2B real, não projeto acadêmico nem app
de nicho pequeno. Toca `bets[0]` ("WhatsApp é a única interface viável").

**Por que a fonte é fraca:** cobertura de imprensa de um anúncio pré-lançamento (produto
sai em maio/2026), números autodeclarados, sem benchmark nem amostra de uso.

**A pergunta:** é o terceiro data point do mesmo padrão regional se formando — vale
manter só como evidência a favor da aposta de canal, ou já é hora de monitorar se a
Instacrops (ou um clone seu) expande pra café/Brasil antes que a Stevi tenha tração
externa real pra defender a posição?

---

## Fila de trabalho

_vazio — nada passou de PROTOTIPAR/IMPLEMENTAR nesta rodada. Sétima rodada seguida
(24/08, 31/08, 07/09, e agora 09/11 depois de 63 dias de lacuna) sem spike na campanha —
a sequência de "zero PROTOTIPAR" já é mais longa que o próprio voo de 60 dias durou._

A `verdict_note` deste projeto exige que PROTOTIPAR e IMPLEMENTAR ajudem a **conversar com
produtor** ou a **disparar alerta**. Dos onze itens lidos a fundo em 09/11, o de maior score
bruto (Gemini 2.5-flash, 12/15) bateria PROTOTIPAR pela tabela — mas troca de pin de modelo
não ajuda nenhum dos dois diretamente, então trava em DISCUTIR por regra explícita, igual ao
item de OpenRouter ToS em 07/09. Esta semana isso importa mais que de costume: o voo fechou
há 59 dias em MATAR/PIVOTAR qualitativo e o repositório inteiro ficou esse tempo sem um
commit de engenharia — o projeto não precisa de mais fila de trabalho de código agora,
precisa de uma decisão dos founders sobre recomeçar, pivotar ou arquivar (ver `STATE.md`).

**Adendo de 01/09:** os quatro itens de 31/08 foram decididos pelo Stefano no mesmo dia e
viraram código — três PRs mesclados (#13, #14, #15). Estão no Arquivo, cada um com o que
aconteceu. Isso NÃO contradiz a `verdict_note`: ela trava a PROMOÇÃO automática de item que
só adiciona capacidade; nenhum destes subiu sozinho de DISCUTIR. Quem decidiu foi o
fundador, que é exatamente o que a seção "Em aberto" existe para provocar. O registro fica
aqui porque a alternativa — apagar a pergunta depois de respondida — perderia o rastro de
por que o código existe.

## Radar

- `2026-11-09` **Vereda capta R$30M para vender insumo agrícola via WhatsApp+IA e estruturar crédito privado — comércio, não conselho.** Braço comercial direto da indústria de insumos (sem estoque, comissão ~4%), agentes de IA conduzem a venda inteira pelo WhatsApp; piloto de crédito pra safrinha 26/27 é financiamento de terceiros, não próprio. Segundo caso recente (depois da Farmtech, 31/08) de capital apostando em WhatsApp+IA como infra comercial no agro. [Startups.com.br](https://startups.com.br/negocios/agtech/vereda-capta-r-30m-para-conectar-industria-de-insumos-direto-ao-produtor/) · 6/15
- `2026-11-09` **Kissan-Dost (IoT+RAG, Paquistão) e Krishi Sathi (RAG multi-turno, Índia) confirmam o padrão "WhatsApp+baixo letramento+IA agro" — em arquitetura que o Stevi decidiu não usar.** Kissan-Dost exige hardware IoT (US$110/nó) fora de escopo da Stevi; Krishi Sathi usa RAG com slot-filling multi-turno, não a extração por chave determinística do Stevi. Evidência fraca nos dois (n=5 piloto qualitativo; métricas autodeclaradas sem baseline). [arXiv (Kissan-Dost)](https://arxiv.org/abs/2602.08593) · [arXiv (Krishi Sathi)](https://arxiv.org/abs/2508.03719) · 6/15
- `2026-11-09` **MAPA institui o SISPA — canal B2B de petição de agrotóxicos, não a base pública que o Agrofit consome.** Portaria 1.631/2026 obriga empresas a migrar dossiês de registro até jun/2027; nenhuma fonte confirma que isso afeta o dataset aberto que `api/_lib/tools/agrofit.ts` lê. Vale revisitar antes do prazo. [Atlas Público](https://atlaspublico.com.br/noticias/mapa-institui-novo-sistema-para-registro-de-agrotoxicos-com-31022) · 6/15
- `2026-11-09` **Agtechs brasileiras captam R$94,7M no 1S26 — queda de 79% YoY (dados Itaú BBA).** 8 operações vs. 17 no mesmo período de 2025. Sinal macro de mercado encolhendo, não ruído de uma rodada isolada. [Forbes Agro](https://forbes.com.br/forbes-agro/2026/10/agtechs-recebem-r-947-milhoes-em-investimentos-no-1o-semestre-de-2026-veja-os-destaques-do-agroround/) · 7/15
- `2026-11-09` **BemAgro capta R$30,3M em Série A liderada pela The Yield Lab Latam.** IA geoespacial para agro (NDVI/safra), com CNH/Atvos/Agroven como investidores estratégicos — adjacente, não concorrente direto (sem WhatsApp, sem triagem conversacional). [Startupi](https://startupi.com.br/bemagro-capta-r-303-milhoes/) · 7/15
- `2026-11-09` **Myca (Índia) capta US$1,3M pré-seed pra virar "centro de comando" de campo via WhatsApp, com mira em expansão pra LatAm.** Agentes de IA transformam mensagem/foto/ligação de equipe de campo em dado estruturado — B2B de operação, não conselho ao produtor final. [AgFunderNews](https://agfundernews.com/myca-raises-1-3m-pre-seed-to-put-ai-agents-in-charge-of-agribusiness-field-operations) · 6/15
- `2026-11-09` **Agri-SCHOLAR: agentes LLM propõem recomendação agronômica validada por simulador de cultura (APSIM) antes de decidir.** Técnica diferente da Stevi (otimização bounded por simulação, não grounding determinístico), mesma classe de problema (recomendação em-safra). [arXiv](https://arxiv.org/abs/2610.31003) · 7/15
- `2026-11-09` **Controlador leve (sem LLM) decide timing de notificação proativa em 11-14ms, até em laptop.** Ataca o mesmo gargalo do horário único de alerta, mas com arquitetura de grafo temporal, não LLM — acompanha o item DISCUTIR sobre PRISM nesta rodada. [arXiv](https://arxiv.org/abs/2605.30152) · 7/15
- `2026-11-09` **Agri-CPJ: diagnóstico de praga sem treino via legenda+dois-candidatos+LLM-juiz.** Técnica adjacente ao pipeline de foto da Stevi, sem benchmark comparativo publicado — evidência fraca. [arXiv](https://arxiv.org/abs/2604.23701) · 5/15
- `2026-11-09` **Paper separa recuperação de fatos (fine-tuning LoRA) da geração de resposta, com avaliação (DG-EVAL) contra verdade curada por especialista.** Ataca o mesmo problema de conselho sem lastro que o goldenset do Stevi tenta resolver, mas por fine-tuning em vez de grounding por prompt. [arXiv](https://arxiv.org/abs/2603.03294) · 7/15
- `2026-11-09` **Confirmado: desde jan/2026 a Meta isenta chatbots de IA em números brasileiros da trava que suspendia bots gerais no WhatsApp Business API.** Contexto regulatório de fundo — é por isso que a Stevi (e qualquer concorrente) pode operar IA conversacional no WhatsApp BR hoje; fato antigo nunca registrado aqui. [MacMagazine](https://macmagazine.com.br/post/2026/01/15/meta-abre-excecao-e-libera-chatbots-de-ia-para-o-whatsapp-no-brasil/) · 7/15
- `2026-11-09` **OpenRouter muda API em ritmo acelerado (14-29/out) pós-rumor Stripe — sem confirmação de closing até hoje.** Vários breaking changes de superfície enterprise (SCIM, Guardrails, External Users); não exige ação porque a diversificação de gateway já foi decidida em 01/09 (ver Arquivo). [OpenRouter changelog](https://openrouter.ai/docs/changelog.md) · 7/15
- `2026-11-09` **Supabase passa a cobrar Log Ingestion de forma medida (US$0,50/GB após 20GB grátis) em Pro/Team.** Projeto dormente não deve se aproximar do limite tão cedo, mas vale saber que existe. [PricingSaaS](https://pricingsaas.com/companies/supabase/diffs/2026W40) · 6/15
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

- `2026-11-09` **[era DISCUTIR 11/15, aberto 07/09] Prompt logging na OpenRouter — envelheceu sem decisão.** 63 dias sem confirmação de que as duas contas (principal e reserva `twin-me`) têm "prompt logging" desligado. Nenhuma evidência no git de que alguém checou o dashboard. Arquivado pela regra dos 21 dias — se a resposta vier, reabrir é mais barato que reescrever.
- `2026-11-09` **[era DISCUTIR 9/15, aberto 07/09] App do Cacau (UESC/cacau, mesmo mecanismo) — envelheceu sem decisão.** 63 dias sem checagem de EPAMIG/Embrapa pra café. Nenhum movimento competitivo detectado nesta rodada que mude a leitura.
- `2026-11-09` **[era DISCUTIR 8/15, aberto 07/09] Café 360 Premium (100+ downloads, mesma região) — envelheceu sem decisão.** 63 dias sem decisão sobre citar ou não no README de posicionamento. Continua sendo evidência de campo a favor de `bets[0]`, agora reforçada por um terceiro caso (Instacrops, nesta rodada) — ver item DISCUTIR 8/15 acima.
- `2026-11-09` **[era DISCUTIR 10/15, aberto 24/08] O horário único de alerta (08:00 pra todo mundo) — envelheceu sem decisão, mas reabre com evidência nova.** 77 dias sem decisão sobre horário por tipo de alerta vs. cron único. O PRISM (arXiv, esta rodada) traz um mecanismo mais sofisticado pra mesma pergunta, mas que exige telemetria de aceite que o Stevi não coleta — ver novo item DISCUTIR 8/15 acima, que substitui este.
- `2026-11-09` **[era DISCUTIR 10/15, aberto 24/08] Cobrança do WhatsApp a partir de 01/10 — envelheceu, e o prazo já passou.** 01/10/2026 chegou e se confirmou (Zenvia/YCloud): service messages e utility em janela de 24h passaram a ser cobrados no Brasil. O cálculo original (`alertSendPlan()` sempre cai em `template`, já pago; delta de custo ≈ zero) segue válido. O risco real identificado — continuidade de cobrança da WABA — nunca foi confirmado como monitorado: os memos do PM do Scorecard registram `403 Forbidden` em pelo menos quatro tentativas de checar `FOUNDER_NOTIFY_TO`/`WHATSAPP_TEMPLATE_ALERT` na Vercel (28/09 a 09/11), sem acesso de founder resolvendo. Arquivado como resultado consumado, não decisão pendente.
- `2026-09-07` **[era DISCUTIR 10/15] A Fecon aconteceu 1–3/09 — e gerou zero cadastros, apesar do kit pronto.** O kit (`64152d6`) e a regra de vouch (`527120b`, token `#fecon` vs. `#fecon-cartaz`) foram shipados dias antes da feira. Medição de 07/09 no banco: `users.source ilike '%fecon%'` retorna **zero linhas**; só 1 usuário novo entrou no banco desde 31/08 (`kind='empresa'`, não produtor). O repositório não registra se o Stefano foi e não usou o kit, ou não foi — mas o resultado é o mesmo: a única janela de campo dentro do voo de 60 dias não converteu ninguém. Movido pro Arquivo como resultado, não como decisão pendente — a pergunta original ("você vai?") não faz mais sentido perguntar, a janela fechou.
- `2026-09-01` **[era DISCUTIR 10/15] A OpenRouter virou parte da Stripe — decidido: diversificar em duas camadas, sem esperar mudança de termos.** O Stefano mandou ir fundo e liberou trocar modelo. Confirmado com as fontes primárias que a aquisição foi anunciada pelas DUAS partes em 19/08 ("same product, same roadmap", closing pendente) — promessa, não contrato. Entraram: fallback direto por chave (`api/_lib/llmDirect.ts`, Anthropic Messages API e endpoint OpenAI-compat do Google AI Studio) em #13, e chave RESERVA do OpenRouter — conta separada, a do projeto twin-me — como camada 1 em #14, já configurada em produção (`OPENROUTER_FALLBACK_API_KEY`) com redeploy feito. O gateway deixou de ser ponto único. [Stripe](https://stripe.com/newsroom/news/stripe-agrees-to-acquire-openrouter) · [OpenRouter](https://openrouter.ai/blog/announcements/openrouter-is-joining-stripe/)
- `2026-09-01` **[era DISCUTIR 10/15] O Google já tem data pra desligar o Gemini 2.5 — decidido: pinar `google-ai-studio` agora, sem esperar a data oficial.** A checagem nas páginas do Google fechou a dúvida das duas datas: 16/10/2026 está confirmado nos release notes do **Vertex**; a página de model-versions cita 20/10 e o Google não resolveu a contradição (planejamos pelo 16). O que decide é outra coisa: a **API pública segue "no shutdown date announced"**, então o pin desacopla a transcrição do prazo do Vertex inteiro. Implementado em #13 (`ROCA_TRANSCRIBE_PROVIDER`, default `google-ai-studio`, `any` desliga), com o canário pingando o tier de transcrição pelo MESMO pin — senão validaria caminho que o produtor não usa. Modelo mantido: `gemini-2.5-flash-lite` seria mais barato em áudio (US$0,30/M vs 1,00) mas ninguém mediu transcrição PT-BR de voz de roça nele; trocar default sem golden de transcrição fica em aberto. [Vertex release notes](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes) · [deprecations da API pública](https://ai.google.dev/gemini-api/docs/deprecations)
- `2026-09-01` **[era DISCUTIR 8/15] O JoIA da CNA — decidido: citar a base pública, e ela ancora uma resposta que saía rasa.** A leitura a fundo confirmou o desenho do concorrente (WhatsApp, gratuito, número (61) 99844-8367, lançado 25/08, rollout na Expointer) e, mais útil, o **status legal da base**: os boletins mensais do Campo Futuro (CNA/Senar; café elaborado pelo CIM/UFLA) trazem impresso "Reprodução permitida desde que citada a fonte". Não é território deles — é fonte pública. Implementado em #13: `api/_lib/tools/custos.ts` detecta pergunta de custo (que não é cotação e caía no caminho `general` sem base nenhuma) e injeta estrutura COE/COT, a citação, e a honestidade de que o número público é da propriedade MODAL da região, não da lavoura dele — com o gancho pro caderno, que é o dado que só a Stevi tem. Nenhum número embutido no código: boletim é mensal. Caso novo no goldenset (`custo-producao-cafe`). Confirmado também que o JoIA é **só reativo** — nenhuma fonte menciona alerta proativo, o que mantém a `bets[1]` de pé. [CNA](https://cnabrasil.org.br/noticias/sistema-cna-senar-leva-joia-projeto-comprador-e-produtos-artesanais-a-expointer) · [boletim Ativos Café](https://www.cnabrasil.org.br/storage/arquivos/icones/Ativos-Cafe-Campo-futuro-Agosto-2024-CNA.pdf)
- `2026-09-01` **[era DISCUTIR 8/15] O estudo da FDC — decidido: citar na CONVERSA, não no template. E o registro de 31/08 estava errado num ponto que mudava a ação.** O título daquele item dizia que o estudo "nomeia, com dirigente e faturamento". Abrindo o PDF: ele **anonimiza** — a Tabela 1 traz perfis (fundação, cidade, nº de associados, faturamento 2024) e o cargo do entrevistado, sem nome de cooperativa nem de dirigente. Dá pra inferir que o perfil de Guaxupé com R$10,7 bi é a Cooxupé, mas isso é inferência nossa, não citação; atribuir número do estudo a uma cooperativa nominal seria inventar fonte. Implementado em #13 com essa trava explícita no prompt da Vitória (`prospect/agent.ts`), junto da munição citável (15 dirigentes de MG, 22 barreiras, recomendação de parceria com startups e IA na interação com o cooperado) e da resposta pronta à objeção de propriedade de dados, que o estudo documenta na voz do cooperado ("eu não vou passar não, porque eu não sei para onde que vai isso"): consentimento LGPD + exclusão a pedido, caso técnico devolvido aos agrônomos da cooperativa, sem venda de dados, contrato escala pro Stefano. O template aprovado `stevi_parceria_coop_v1` **não muda** — bloco de texto em template frio morre no porteiro-robô (medição de 05/ago) e corpo aprovado exige re-submissão à Meta; a citação vive onde há humano lendo. [Zenodo (DOI 10.5281/zenodo.17604355)](https://zenodo.org/records/17604355)
- `2026-09-01` **[achado colateral, virou #15] A rede de resgate era silenciosa — e o alerta de crédito não cobria o caso.** Simulando a queda da chave principal contra a API real (não mock), o OpenRouter devolveu `401 "User not found"`, que **não** é `isCreditError`: a reserva seguraria todo o tráfego sem nenhum alerta, só `log.error` na Vercel, enquanto o saldo do outro projeto escoava. Chave revogada é justamente o cenário de aquisição que motivou a reserva existir. #15 faz as duas camadas de resgate avisarem os fundadores (cooldown de 10 min, `fireAndForget`, texto nomeando camada/modelo/motivo). Não é item de intel — é o que a verificação achou, e fica aqui porque nasceu desta rodada.
- `2026-08-31` **[era DISCUTIR 9/15] Em 30/08 o cron tenta o alerta de vazio de MT sozinho — resolvido por código, não por decisão do Stefano.** No mesmo dia em que o item foi aberto (24/08), `def021c` filtrou `listSojaFarmersByUf`/`listFarmsWithCoords` por `kind='produtor'`, e `7e891f5` completou a cobertura de UF. Medição de 31/08 no banco confirma: a única farm com soja em MT é `kind='teste'` e o filtro a exclui — o cron de 30/08 não vai contaminar `farmer_alerts`. Movido pra cá porque a pergunta original (disparar pra teste ou filtrar antes?) já tem resposta no código, não porque o Stefano decidiu.
