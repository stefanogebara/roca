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
> **Quinta passada (2026-10-05) — o voo fechou, e o `/intel` não rodava há 28 dias.**
> Nesse intervalo o voo de 60 dias **terminou** (11/09, veredito qualitativo MATAR/PIVOTAR,
> `.claude/plans/memos-scorecard/README.md`) e três memos pós-fechamento confirmaram zero
> movimento desde então — zero commit de produto, zero conversa de produtor, 24 dias de
> silêncio total (ver `STATE.md`). Feed do resumo matinal veio vazio de novo para este
> projeto (mesmo JSON de 22/08, nunca atualizado para `roca` desde então); cinco scouts,
> ~50 candidatos brutos depois de filtrar duplicatas óbvias, sete lidos a fundo por um
> analista cada. **Todos os quatro itens que estavam em "Em aberto" envelheceram além dos
> 21 dias sem decisão do Stefano** (o mais novo tinha 28 dias) e foram movidos pro Arquivo
> nesta rodada — um deles (preço do WhatsApp em outubro) como resultado confirmado, não
> como esquecimento. Isso não é falha do dedup: é o reflexo direto do projeto ter ficado
> um mês sem ninguém olhar para o próprio `/intel`, não só sem produtor conversando.

## Em aberto — precisa de decisão do Stefano

### [DISCUTIR 11/15] Trocar o modelo de raciocínio pro Sonnet 5.5 — mas isso quebra a moratória de engenharia?
**Data:** 2026-10-05 · **Eixos:** P3 A3 D2 E2 L1
**Fonte primária:** [Anthropic — Claude Sonnet 5.5](https://www.anthropic.com/claude-sonnet-5-5) · [MarkTechPost](https://www.marktechpost.com/2026/09/28/anthropic-releases-claude-sonnet-5-5-70-6-on-terminal-bench-4-0-at-the-same-2-10-price/)

**O que é:** lançado 28/09/2026, mesmo preço do Sonnet 5 ($2/$10 por milhão de tokens),
mais de 30% mais rápido e até 30% mais barato por tarefa por usar menos tokens pro mesmo
resultado (exemplo citado: tarefa financeira caiu de ~497k para ~121k tokens).
Benchmarks públicos corroborados por cobertura independente: Terminal-Bench 4.0 70,6%
vs 10,3% do Sonnet 5; primeiro Sonnet com "cyber safeguards" equivalentes ao Opus 5.5.

**Por que toca este projeto:** é literalmente `MODELS.reasoning()` em `api/_lib/env.ts:18`
— o modelo que faz o diagnóstico agronômico de fato, consumido por `api/_lib/llm.ts` e
`api/_lib/llmDirect.ts`. A troca é uma linha ou uma env var, sem migração de schema.

**Por que a trava aperta aqui:** score bruto 11 cairia em PROTOTIPAR, mas a `verdict_note`
rebaixa pra DISCUTIR (item de pura capacidade, não ajuda a CONVERSAR nem a ALERTAR) — e
os três memos pós-fechamento do PM do Scorecard (14/09, 28/09, 05/10) pedem explicitamente
**zero linhas de código** até os founders decidirem se a campanha recomeça. Mesmo DISCUTIR
já é generoso.

**A pergunta:** quando (e se) a moratória de engenharia for levantada, essa troca é o
primeiro item "barato" do próximo ciclo — vale só registrar a intenção agora, sem abrir
exceção à moratória? Ou nem vale registrar, já que nenhum memo recente sinaliza intenção
de retomar?

---

### [DISCUTIR 8/15] Google restringe acesso ao Gemini 2.5 na API que o Stevi usa — mas só pra projeto novo
**Data:** 2026-10-05 · **Eixos:** P3 A2 D1 E1 L1
**Fonte primária:** [Google AI — changelog, 18/09/2026](https://ai.google.dev/gemini-api/docs/changelog) · [Vertex/Gemini Enterprise Agent Platform](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/2-5-flash)

**O que é:** citação literal confirmada no HTML bruto: "we are limiting access to the 2.5
models to users who have actively used them in the past [...] For any new projects, use
our latest models: 3.5 Flash-Lite or 3.8 Flash." Isso é na API PÚBLICA do Google AI Studio
— a superfície exata que `ROCA_TRANSCRIBE_PROVIDER=google-ai-studio` usa (`api/_lib/env.ts`,
`api/_lib/llmDirect.ts`, `api/_lib/voice/elAgent.ts`) — não o Vertex (cuja data de retirada,
aliás, mudou de 16/10 pra **20/10/2026** nesta leitura, com nota explícita de que é só
retirada de suporte enterprise, API pública continua à parte).

**Por que não é urgente:** a restrição atinge projetos NOVOS, não uso histórico ativo — e
a Stevi usa `gemini-2.5-flash` em produção desde antes de 01/09. Isso confirma, com texto
mais direto, a aposta do pin `google-ai-studio` feita em 01/09 (Arquivo). Fraqueza real: o
anúncio não define a janela de "uso ativo no passado" nem se pausa longa reclassifica o
projeto — e a Stevi está sem chamada de produção desde 11/09.

**A pergunta:** vale um check de 10-15 min (dashboard do Google AI Studio, não é código)
pra confirmar que a chave/projeto da Stevi ainda conta como "uso ativo", dado que o
projeto está pausado desde 11/09 e a definição de janela é ambígua? Se sim, repetir
periodicamente enquanto pausado, ou só quando (se) o voo for retomado?

---

### [DISCUTIR 9/15] Rubrica fixa quase dobra F1 de doença em VLM — mas o gargalo do Stevi não é acurácia
**Data:** 2026-10-05 · **Eixos:** P2 A2 D2 E2 L1
**Fonte primária:** [arXiv 2609.09417](https://arxiv.org/abs/2609.09417)

**O que é:** o modelo gera K=4-8 candidatos de diagnóstico respondendo a uma cadeia fixa
de critérios (espécie, doença/praga/dano, qualidade) antes do rótulo final — CoT
estruturado de passe único, não few-shot. Um verificador "Probabilistic Pivot Tournament"
(Kwok et al. 2026) compara os candidatos lendo logits do modelo-juiz. No benchmark AgML
(116 datasets, 834 classes), isso quase dobra o F1 julgado, e pra Gemma 4 E4B-it em doença
supera o teto "oráculo" (0.60→0.71 com K=8) — mas o próprio paper admite que o ganho vem
majoritariamente da rubrica fixa, não do torneio: a confiança do verificador correlaciona
negativamente com acerto em toda configuração.

**Por que toca este projeto:** mesmo problema que `identifyFromPhoto` em
`api/_lib/reason.ts:264-296` resolve. A parte que o paper credita pelo ganho (cadeia de
critérios fixa) é portátil sem precisar de logits nem K candidatos — testável num spike
de prompt em menos de um dia. Mas café tem 9 imagens em 8.324 no benchmark (0,1%) — zero
evidência específica de doença de café, Sul de Minas ou Caparaó.

**Por que a trava aperta aqui:** item de pura capacidade de classificação (não ajuda a
CONVERSAR nem a ALERTAR) — a `verdict_note` trava em DISCUTIR mesmo com score 9 batendo
PROTOTIPAR. E o voo fechou MATAR/PIVOTAR por falta de tração (n=1), não por qualidade do
diagnóstico por foto.

**A pergunta:** mesmo que rubric-grounded prompting elevasse a acurácia de
`identifyFromPhoto`, isso mudaria alguma decisão sobre reabrir ou pivotar o Stevi? Ou é
exatamente o tipo de item que deve esperar existir conversa real de produtor antes de
justificar o esforço?

---

### [DISCUTIR 8/15] Pipeline de 3 estágios filtra 46,8% das fotos antes do diagnóstico — débito técnico sem produtor pra expor
**Data:** 2026-10-05 · **Eixos:** P2 A1 D2 E2 L1
**Fonte primária:** [arXiv 2609.21651](https://arxiv.org/abs/2609.21651)

**O que é:** análise de ~1,16M fotos reais enviadas ao FarmerChat (Digital Green, 4 países
africanos/asiáticos, celulares básicos, luz ruim): um quality-gate de produção rejeita
46,8% das imagens, e 35,8% dos casos rotulados "doença" são na verdade pragas
identificáveis sem ver a cultura. Proposta: pipeline configurável M0 (qualidade) → M1
(detector de cultura) → M2 (doença/praga), com modelos leves (MobileNetV3: 86,9% F1 em
12ms) ou pesados (DaViT-Base: 95,41% vs 91,46% baseline), avaliado sobre tráfego real de
produção — evidência mais forte que o normal do gênero, mas sem release de código
confirmado.

**Por que toca este projeto:** hoje toda foto de produtor (nítida ou não) vai direto pro
vision LLM em `identifyFromPhoto` (`api/_lib/reason.ts:264`) sem filtro de qualidade — a
única rede de segurança é reativa (`PHOTO_RETRY_MSG` quando o próprio modelo falha). Não
há `known_gap` registrado sobre isso — é um gargalo novo, não um que já bloqueia alguma
aposta.

**Por que a trava aperta aqui:** reproduzir M0/M1/M2 exigiria hospedar modelos de visão
dedicados fora da stack atual (Vercel serverless + OpenRouter) — não é spike de ≤2
semanas, e hoje não há foto de produtor chegando pra justificar o esforço. "O conserto
nunca é mais código" se aplica em cheio: construir um quality-gate sem ninguém mandando
foto é código resolvendo o problema errado (campo, não produto).

**A pergunta:** isso fica só registrado como débito técnico pra quando (se) o fluxo
reativar, ou vale medir agora, nas poucas fotos de teste/empresa que ainda chegam, se há
sinal de diagnóstico errado por foto ruim — ou isso também seria código antes de
conversa, contra o tripwire?

---

## Fila de trabalho

_vazio — nada passou de PROTOTIPAR/IMPLEMENTAR nesta rodada. Quarta rodada seguida (24/08,
31/08, 07/09, 05/10) e sétimo veredito sem spike na campanha._

A `verdict_note` deste projeto exige que PROTOTIPAR e IMPLEMENTAR ajudem a **conversar com
produtor** ou a **disparar alerta**. Nesta rodada (05/10) isso importa mais do que nunca: o
voo de 60 dias **fechou em 11/09 com veredito MATAR/PIVOTAR**, e os três memos pós-fechamento
pedem explicitamente zero linhas de código até os founders decidirem se a campanha recomeça.
Dos quatro DISCUTIR desta rodada, o de maior score bruto (Sonnet 5.5, 11/15) bateria
PROTOTIPAR pelo número — mas é pura troca de capacidade/custo num projeto em moratória
explícita de engenharia, então a trava nem precisa do score pra justificar o teto. Os outros
três (VLM rubric verifier 9/15, pipeline de 3 estágios 8/15, restrição de acesso Gemini 2.5
8/15) são a mesma história: capacidade ou risco de plataforma, nenhum ajuda a conversar ou
alertar via código. O projeto não precisa de mais fila de trabalho — precisa da decisão dos
founders sobre recomeçar ou encerrar, que já está formulada no fechamento do voo.

**Adendo de 01/09:** os quatro itens de 31/08 foram decididos pelo Stefano no mesmo dia e
viraram código — três PRs mesclados (#13, #14, #15). Estão no Arquivo, cada um com o que
aconteceu. Isso NÃO contradiz a `verdict_note`: ela trava a PROMOÇÃO automática de item que
só adiciona capacidade; nenhum destes subiu sozinho de DISCUTIR. Quem decidiu foi o
fundador, que é exatamente o que a seção "Em aberto" existe para provocar. O registro fica
aqui porque a alternativa — apagar a pergunta depois de respondida — perderia o rastro de
por que o código existe.

## Radar

- `2026-10-05` **ADAMA Alvo (100 mil+ downloads, cobre café) reforça a mesma leitura do Café 360: app nativo estabelecido, tração modesta.** App de identificação de praga/doença existente desde 2014-15, remodernizado com apoio de IA generativa, cobre soja/milho/algodão/cana/café. Mais um data point de campo a favor de `bets[0]` (apps de agro não vencem o canal) — concorrente de longa data, não ameaça nova. [Agrolink/App Store](https://apps.apple.com/br/app/adama-alvo/id904718051) · 7/15
- `2026-10-05` **Pesquisa ABMRA (9ª edição, 3.100 produtores, 16 estados): 98% têm internet, 96% usam WhatsApp pra decisão de negócio.** Confirma a tese de canal já `settled`, mas não testa a parte contestável (que o produtor rejeita apps) — é retrato nacional agregado, sem recorte café/MG, publicado por associação de marketing com interesse na narrativa. Munição de radar pra quando/se o posicionamento for reaberto. [RuralZap/ABMRA](https://www.ruralzap.com.br/blog/conectividade-campo-whatsapp-decisoes-negocios) · 8/15, rebaixado de DISCUTIR pelo próprio analista (evidência autodeclarada, sem ação pendente)
- `2026-10-05` **Dois papers de set/2026 formalizam quando agentes devem agir proativamente — mas resolvem um problema que o loop do Stevi não tem.** Framework 3T/Proactivity-Gym (confiança cai 1,86pt após intervenção desalinhada, n=30) e POMDP com autorização/risco; o loop determinístico do Stevi (`api/_lib/alerts.ts`) já decide por limiar simples (geada, fogo, vazio), e o gargalo documentado é zero produtor-alvo, não a lógica de quando alertar. [arXiv 2609.37267](https://arxiv.org/abs/2609.37267) · [arXiv 2609.03727](https://arxiv.org/abs/2609.03727) · 7/15
- `2026-10-05` **Tellia capta US$5M pra voz→registro estruturado agrícola — mesmo mecanismo do caderno de aplicações do Stevi, público diferente.** B2B enterprise (Campos Brothers Farms, Duckhorn), equipe de campo remunerada com obrigação de registro — não produtor voluntário respondendo bot de WhatsApp. O caderno do Stevi (`api/_lib/tools/applicationParse.ts`) já tem o mecanismo pronto; zero registros em 60 dias é problema de adoção, não de capacidade. [Fertilizer Daily](https://www.fertilizerdaily.com/20260909-tellia-raises-5-million-to-bring-voice-ai-to-farm-fields/) · 6/15
- `2026-10-05` **Benchmark real (4.500 chamadas) mostra pt-BR quase em paridade com inglês em voice agents full-duplex.** Gap ≤3,2 pontos vs -14,7 coreano e -8,4 mandarim — mas o único agente de voz do Stevi (ElevenLabs, Vitória/prospecção B2B) está parado há 2 meses e nunca atende produtor; achado sem gargalo ativo pra resolver. [arXiv 2609.35820](https://arxiv.org/abs/2609.35820) · 6/15
- `2026-10-05` **Meta cobra o Business Agent nativo por token desde 01/08/2026.** US$2,00/milhão de tokens, ~4-5 centavos de dólar por mensagem típica — mais um dado de custo do concorrente nativo da Meta (Zenvia/Agro Amazônia já registrado 31/08), confirma que a barreira de automatizar o canal continua baixando para qualquer revenda/cooperativa. [Meta for Developers](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages) · 5/15
- `2026-10-05` **Cooxupé vai rejeitar café com alta umidade na safra 2026 — dor de pós-colheita ativa no beachhead.** Maior cooperativa cafeeira do país (Sul de Minas, ~20 mil cooperados) recusará lotes com micotoxinas por chuva acima da média. Ângulo de dado/moat futuro (secagem, manejo pós-colheita) se a campanha recomeçar — não ação hoje. [Forbes Agro](https://forbes.com.br/forbes-agro/2026/09/cooxupe-rejeitara-cafe-com-problema-de-umidade-na-safra-2026/) · 6/15
- `2026-10-05` **iRancho (BR, pecuária) volta ao breakeven e mira virar provedora de crédito usando dados de IA on-device.** Padrão "agtech BR usa dados operacionais pra virar fintech" — ecoa Farmtech (crédito no WhatsApp, já registrado 31/08). Pecuária, não café; sinal de categoria, não concorrente direto. [AgFeed](https://agfeed.com.br/agtech/irancho-volta-ao-breakeven-abre-rodada-de-r-10-milhoes-e-sonha-em-virar-banco/) · 5/15
- `2026-10-05` **Safra de café 2026 estimada em 67,6 milhões de sacas — recorde histórico, MG com ~35 milhões.** Contexto macro de alta oferta na região do beachhead; sem ação direta. [O Tempo/Conab](https://www.otempo.com.br/agro/2026/9/25/safra-do-cafe-em-2026-e-estimada-em-67-6-milhoes-de-sacas-a-maior-da-serie-historica) · 5/15
- `2026-10-05` **Cocatrel (Sul de Minas, 2ª maior coop de café do Brasil) sobe 144 posições no ranking Valor 1000.** Reforça o peso econômico das cooperativas do beachhead como canal de distribuição potencial — contexto, não novidade de produto. [O Tempo](https://www.otempo.com.br/minas-sa/2026/9/22/cooperativa-dos-cafeicultores-da-zona-de-tres-pontas-cocatrel-esta-entre-as-maiores-do-brasil) · 5/15
- `2026-10-05` **Café especial do Caparaó (uma das duas regiões-beachhead) vale ~4x o café comum e atrai gente jovem de volta ao campo.** Contexto de persona/economia do beachhead — produtor-alvo mais sofisticado do que a média nacional. [Diário do Comércio](https://diariodocomercio.com.br/agronegocio/cafes-especiais-caparao-ancestralidade-nova-economia/) · 5/15
- `2026-10-05` **AgroVoz (17 módulos, voz+WhatsApp) é mais um entrante generalista no mesmo canal — fonte fraca, sem cobertura de imprensa.** Produto ativo no ar, mas sem data confirmada por fonte independente; registrado como sinal de competição crescente no canal WhatsApp, não como ameaça concreta. [agrovoz.app](https://agrovoz.app/) · 5/15
- `2026-10-05` **FieldData chega ao Brasil — WhatsApp+IA pra pecuária, startup argentina com 1.700 fazendas fora do BR.** Mesmo padrão de produto do Stevi, foco em gado não lavoura/café; expansão regional do mecanismo "WhatsApp+IA pra produtor", categoria diferente. [CompreRural](https://www.comprerural.com/fielddata-chega-ao-brasil-ia-ajuda-a-gerenciar-fazenda-direto-do-whatsapp/) · 5/15
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

- `2026-10-05` **[era DISCUTIR 10/15] A partir de 01/10 não sobra caminho gratuito no WhatsApp — resolvido por fato, não por decisão.** A mudança entrou em vigor: confirmado por duas fontes de BSP (AiSensy, Nexe) que desde 01/10/2026 a Meta cobra R$0,0350 por mensagem de serviço/utilidade (após 1.000 grátis/número/mês) e R$0,3217 por marketing no Brasil — mesmo dentro da janela aberta de 24h. A leitura de 24/08 já tinha calculado que o alerta proativo não encarece (`alertSendPlan()` já caía em `template` pago) e que o risco real era continuidade de billing, não preço. Como o projeto está pausado desde 11/09 (zero mensagem saindo, de qualquer tipo), a pergunta original ("a conta de billing está fundeada?") perdeu urgência prática — mas fica registrado que a tarifa agora é fato, não previsão, pra quando a campanha (se) recomeçar. [AiSensy](https://m.aisensy.com/blog/pt/atualizacao-preco-whatsapp-api-outubro-2026/) · [Nexe](https://nexe.com.br/whatsapp-api-em-reais-brasil/)
- `2026-10-05` **[era DISCUTIR 11/15] Prompt logging na OpenRouter — envelheceu sem decisão.** Aberto em 07/09, 28 dias sem resposta do Stefano sobre se as duas contas (principal e reserva `OPENROUTER_FALLBACK_API_KEY`) têm a opção desligada. Nenhuma evidência de verificação no período. Movido pro Arquivo pela regra dos 21 dias — se o risco ainda importa quando a campanha for revisitada, reabrir como item novo.
- `2026-10-05` **[era DISCUTIR 9/15] App do Cacau (UESC/Bahia) — envelheceu sem decisão.** Aberto em 07/09 perguntando se vale checar movimento equivalente nascendo para café (EPAMIG/Embrapa). 28 dias sem resposta; nenhuma varredura nova desta rodada encontrou esse movimento para café. Movido pro Arquivo pela regra dos 21 dias.
- `2026-10-05` **[era DISCUTIR 8/15] Café 360 (app pago, mesma região, 100+ downloads) — envelheceu sem decisão, e o padrão se repetiu.** Aberto em 07/09 perguntando se valia citar no README de posicionamento. 28 dias sem resposta — movido pro Arquivo pela regra dos 21 dias. Esta mesma rodada (05/10) encontrou outro data point do mesmo padrão (ADAMA Alvo, app estabelecido com 100k+ downloads e tração modesta, ver Radar) — reforça a leitura original (evidência de campo a favor de `bets[0]`, não ameaça), sem precisar reabrir a pergunta.
- `2026-10-05` **[era DISCUTIR 10/15] O primeiro alerta sai às 08:00 para todo mundo? — envelheceu sem decisão, e a pergunta ficou ainda mais hipotética.** Aberto em 24/08 (42 dias). Zero alerta disparado pra produtor real desde então (`farmer_alerts` continua em 2 linhas de teste desde 14/08) — a pergunta sobre horário por tipo de alerta só tem sentido prático quando existir produtor recebendo alerta. Movido pro Arquivo pela regra dos 21 dias; reabrir quando (se) o loop proativo tiver um alvo real.
- `2026-09-07` **[era DISCUTIR 10/15] A Fecon aconteceu 1–3/09 — e gerou zero cadastros, apesar do kit pronto.** O kit (`64152d6`) e a regra de vouch (`527120b`, token `#fecon` vs. `#fecon-cartaz`) foram shipados dias antes da feira. Medição de 07/09 no banco: `users.source ilike '%fecon%'` retorna **zero linhas**; só 1 usuário novo entrou no banco desde 31/08 (`kind='empresa'`, não produtor). O repositório não registra se o Stefano foi e não usou o kit, ou não foi — mas o resultado é o mesmo: a única janela de campo dentro do voo de 60 dias não converteu ninguém. Movido pro Arquivo como resultado, não como decisão pendente — a pergunta original ("você vai?") não faz mais sentido perguntar, a janela fechou.
- `2026-09-01` **[era DISCUTIR 10/15] A OpenRouter virou parte da Stripe — decidido: diversificar em duas camadas, sem esperar mudança de termos.** O Stefano mandou ir fundo e liberou trocar modelo. Confirmado com as fontes primárias que a aquisição foi anunciada pelas DUAS partes em 19/08 ("same product, same roadmap", closing pendente) — promessa, não contrato. Entraram: fallback direto por chave (`api/_lib/llmDirect.ts`, Anthropic Messages API e endpoint OpenAI-compat do Google AI Studio) em #13, e chave RESERVA do OpenRouter — conta separada, a do projeto twin-me — como camada 1 em #14, já configurada em produção (`OPENROUTER_FALLBACK_API_KEY`) com redeploy feito. O gateway deixou de ser ponto único. [Stripe](https://stripe.com/newsroom/news/stripe-agrees-to-acquire-openrouter) · [OpenRouter](https://openrouter.ai/blog/announcements/openrouter-is-joining-stripe/)
- `2026-09-01` **[era DISCUTIR 10/15] O Google já tem data pra desligar o Gemini 2.5 — decidido: pinar `google-ai-studio` agora, sem esperar a data oficial.** A checagem nas páginas do Google fechou a dúvida das duas datas: 16/10/2026 está confirmado nos release notes do **Vertex**; a página de model-versions cita 20/10 e o Google não resolveu a contradição (planejamos pelo 16). O que decide é outra coisa: a **API pública segue "no shutdown date announced"**, então o pin desacopla a transcrição do prazo do Vertex inteiro. Implementado em #13 (`ROCA_TRANSCRIBE_PROVIDER`, default `google-ai-studio`, `any` desliga), com o canário pingando o tier de transcrição pelo MESMO pin — senão validaria caminho que o produtor não usa. Modelo mantido: `gemini-2.5-flash-lite` seria mais barato em áudio (US$0,30/M vs 1,00) mas ninguém mediu transcrição PT-BR de voz de roça nele; trocar default sem golden de transcrição fica em aberto. [Vertex release notes](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes) · [deprecations da API pública](https://ai.google.dev/gemini-api/docs/deprecations)
- `2026-09-01` **[era DISCUTIR 8/15] O JoIA da CNA — decidido: citar a base pública, e ela ancora uma resposta que saía rasa.** A leitura a fundo confirmou o desenho do concorrente (WhatsApp, gratuito, número (61) 99844-8367, lançado 25/08, rollout na Expointer) e, mais útil, o **status legal da base**: os boletins mensais do Campo Futuro (CNA/Senar; café elaborado pelo CIM/UFLA) trazem impresso "Reprodução permitida desde que citada a fonte". Não é território deles — é fonte pública. Implementado em #13: `api/_lib/tools/custos.ts` detecta pergunta de custo (que não é cotação e caía no caminho `general` sem base nenhuma) e injeta estrutura COE/COT, a citação, e a honestidade de que o número público é da propriedade MODAL da região, não da lavoura dele — com o gancho pro caderno, que é o dado que só a Stevi tem. Nenhum número embutido no código: boletim é mensal. Caso novo no goldenset (`custo-producao-cafe`). Confirmado também que o JoIA é **só reativo** — nenhuma fonte menciona alerta proativo, o que mantém a `bets[1]` de pé. [CNA](https://cnabrasil.org.br/noticias/sistema-cna-senar-leva-joia-projeto-comprador-e-produtos-artesanais-a-expointer) · [boletim Ativos Café](https://www.cnabrasil.org.br/storage/arquivos/icones/Ativos-Cafe-Campo-futuro-Agosto-2024-CNA.pdf)
- `2026-09-01` **[era DISCUTIR 8/15] O estudo da FDC — decidido: citar na CONVERSA, não no template. E o registro de 31/08 estava errado num ponto que mudava a ação.** O título daquele item dizia que o estudo "nomeia, com dirigente e faturamento". Abrindo o PDF: ele **anonimiza** — a Tabela 1 traz perfis (fundação, cidade, nº de associados, faturamento 2024) e o cargo do entrevistado, sem nome de cooperativa nem de dirigente. Dá pra inferir que o perfil de Guaxupé com R$10,7 bi é a Cooxupé, mas isso é inferência nossa, não citação; atribuir número do estudo a uma cooperativa nominal seria inventar fonte. Implementado em #13 com essa trava explícita no prompt da Vitória (`prospect/agent.ts`), junto da munição citável (15 dirigentes de MG, 22 barreiras, recomendação de parceria com startups e IA na interação com o cooperado) e da resposta pronta à objeção de propriedade de dados, que o estudo documenta na voz do cooperado ("eu não vou passar não, porque eu não sei para onde que vai isso"): consentimento LGPD + exclusão a pedido, caso técnico devolvido aos agrônomos da cooperativa, sem venda de dados, contrato escala pro Stefano. O template aprovado `stevi_parceria_coop_v1` **não muda** — bloco de texto em template frio morre no porteiro-robô (medição de 05/ago) e corpo aprovado exige re-submissão à Meta; a citação vive onde há humano lendo. [Zenodo (DOI 10.5281/zenodo.17604355)](https://zenodo.org/records/17604355)
- `2026-09-01` **[achado colateral, virou #15] A rede de resgate era silenciosa — e o alerta de crédito não cobria o caso.** Simulando a queda da chave principal contra a API real (não mock), o OpenRouter devolveu `401 "User not found"`, que **não** é `isCreditError`: a reserva seguraria todo o tráfego sem nenhum alerta, só `log.error` na Vercel, enquanto o saldo do outro projeto escoava. Chave revogada é justamente o cenário de aquisição que motivou a reserva existir. #15 faz as duas camadas de resgate avisarem os fundadores (cooldown de 10 min, `fireAndForget`, texto nomeando camada/modelo/motivo). Não é item de intel — é o que a verificação achou, e fica aqui porque nasceu desta rodada.
- `2026-08-31` **[era DISCUTIR 9/15] Em 30/08 o cron tenta o alerta de vazio de MT sozinho — resolvido por código, não por decisão do Stefano.** No mesmo dia em que o item foi aberto (24/08), `def021c` filtrou `listSojaFarmersByUf`/`listFarmsWithCoords` por `kind='produtor'`, e `7e891f5` completou a cobertura de UF. Medição de 31/08 no banco confirma: a única farm com soja em MT é `kind='teste'` e o filtro a exclui — o cron de 30/08 não vai contaminar `farmer_alerts`. Movido pra cá porque a pergunta original (disparar pra teste ou filtrar antes?) já tem resposta no código, não porque o Stefano decidiu.
