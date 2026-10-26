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
> **Quinta passada (2026-10-26) — 49 dias de silêncio no `/intel`, e o projeto fechou no
> meio deles.** O voo de 60 dias terminou em 11/set/2026 (dia 60) com veredito qualitativo
> **MATAR/PIVOTAR** (memo de FECHAMENTO do PM do Scorecard, `a01212c`) — a coorte D7 nunca
> saiu de n=1, e todo critério booleano do scorecard (parceiro pagando, indicação espontânea,
> 10 leads pro teste de matar) ficou em zero absoluto pelos 60 dias. Desde então, **44 dias
> sem um commit de engenharia de produto** — só memos semanais de status, todos confirmando
> os mesmos zeros. Feed do resumo matinal veio vazio de novo para este projeto (mesmo
> snapshot de 22/08); cinco scouts, ~43 candidatos brutos, seis lidos a fundo por um analista
> cada. **Dois DISCUTIR, dezenove REGISTRAR, dezoito DESCARTAR — nenhum PROTOTIPAR, nenhum
> IMPLEMENTAR**, nona rodada seguida sem spike. Os cinco itens que estavam em "Em aberto"
> (dois desde 24/08, três desde 07/09) envelheceram além de 21 dias sem decisão do Stefano e
> foram movidos pro Arquivo nesta rodada, por regra mecânica — um deles (a cobrança de
> mensagem de serviço no WhatsApp a partir de 1/out) se confirmou exatamente como previsto,
> mas sem efeito prático hoje porque o sistema não processa tráfego real. **Nota de processo:**
> o PM do Scorecard pede há sete semanas (14/set a 26/out) para reduzir sua própria cadência
> sem resposta; esta rotina nunca tinha essa pergunta em aberto porque rodou quieta — mas,
> com o projeto formalmente parado há 45 dias, a mesma pergunta cabe aqui. Ver corpo do PR.

## Em aberto — precisa de decisão do Stefano

### [DISCUTIR 9/15] O gym da Stevi já simula persona difícil e tem juiz com veto — falta o padrão "desescalonamento por sicofania"?
**Data:** 2026-10-26 · **Eixos:** P3 A1 D2 E1 L2
**Fonte primária:** [SIM-UT: A User Simulation based Evaluation Framework for Medical Triage Chatbots, arXiv](https://arxiv.org/abs/2610.30412)

**O que é:** framework de simulação de usuário (LLM interpretando personas de países de
baixa/média renda — confusas, com erros de digitação, emocionalmente vulneráveis) testado
contra três chatbots reais de triagem médica por WhatsApp (Índia, África do Sul, Quênia),
comparando MedGemma contra ChatGPT e Claude em >5.000 turnos. O achado central: tanto o
modelo médico quanto os de propósito geral caem no mesmo modo de falha — "desescalonamento
por sicofania": o agente reconhece um sinal de alarme no primeiro turno e depois passa a
minimizá-lo quando o usuário simulado minimiza os sintomas sem trazer dado clínico novo.

**Por que toca este projeto:** a Stevi já tem, de forma independente, uma arquitetura quase
idêntica — `api/_lib/gym/sim.ts` (persona LLM vs. brain real) e `api/_lib/gym/judge.ts`
(juiz pareado com veto de segurança para prescrição/invenção/negação de ser IA). Mas
`api/_lib/gym/personas.ts` testa pressão por dose e desconfiança, não o padrão específico de
recuar depois de alertar. O golden set (`knowledge/goldenset/goldenset.jsonl`, 38 casos, 0
`verified_by`) é sobre assinatura de agrônomo em texto, não sobre esse modo de falha
multi-turno.

**Por que isso trava em DISCUTIR:** é capacidade pura de avaliação/qualidade — não ajuda a
CONVERSAR COM PRODUTOR nem a DISPARAR ALERTA, os dois critérios que a `verdict_note` exige
pra passar de DISCUTIR. E mesmo que ajudasse, o projeto está com **44 dias sem nenhum commit
de engenharia** desde o fechamento do voo em MATAR/PIVOTAR — não há onde prototipar hoje.

**A pergunta:** vale adicionar uma persona "desescalona depois de alertar" ao
`gym`/golden set **quando (e se)** o código for retomado, ou isso fica fora de escopo porque
a Stevi nunca emite alerta médico de vida-ou-morte, só agronômico (o custo de um
desescalonamento errado é mais baixo)?

---

### [DISCUTIR 8/15] Café 360 e agora Instacrops: dois agtechs independentes abandonaram app por WhatsApp — é munição suficiente pro README de posicionamento?
**Data:** 2026-10-26 · **Eixos:** P2 A1 D2 E1 L2
**Fonte primária:** [Instacrops amplía su portafolio de agentes de IA que operan por WhatsApp, Diario Financiero](https://www.df.cl/df-lab/innovacion-y-startups/instacrops-ampliara-su-portafolio-de-agentes-de-ia-que-operan-por-whatsapp)

**O que é:** a agtech chilena Instacrops (IoT + satélite, ~3.000 usuários em 6 países
latino-americanos, clientes como Westfalia/Dole/Nestlé) lançou dois agentes de IA só dentro
do app próprio em 2023; um estudo interno achou que só 15% dos usuários usava o app, contra
a afirmação do CEO de que "80% dos produtores da região gerenciam o negócio por WhatsApp" —
os dois números não vêm do mesmo estudo, mas a empresa migrou os agentes pra WhatsApp e
agora promete (meados de 2026, financiada por crédito AWS) uma plataforma onde o produtor
cria os próprios agentes.

**Por que toca este projeto:** é o segundo caso independente (depois do Café 360, já
registrado no Arquivo como "evidência de campo a favor da aposta, não contra") de uma
empresa agtech abandonando app em favor de WhatsApp por adoção medida — corrobora
`bets[0]` ("WhatsApp é a única interface viável — não construir app"), agora em escala muito
maior (3.000 usuários vs. ~100 downloads do Café 360), ainda que com evidência mais fraca
(números autodeclarados, sem auditoria externa como a contagem da Play Store) e zero overlap
geográfico ou de cultura com o beachhead da Stevi (café, Sul de Minas — a Instacrops é
fruticultura/commodities industrial na América Latina hispânica).

**A pergunta:** dois data points externos (Café 360 + Instacrops) já são munição suficiente
pra citar o padrão "app perde pra WhatsApp no agro" como argumento validado no README de
posicionamento, ou o projeto segue dormente em MATAR/PIVOTAR e esse tipo de evidência só
serve pra decisão futura de recomeçar — sem ação nenhuma até lá?

---

## Fila de trabalho

_vazio — nada passou de PROTOTIPAR/IMPLEMENTAR nesta rodada. Nona rodada seguida (24/08,
31/08, 07/09, 26/10) sem spike na campanha — e as três últimas (49 dias) com o voo já
formalmente fechado em MATAR/PIVOTAR._

A `verdict_note` deste projeto exige que PROTOTIPAR e IMPLEMENTAR ajudem a **conversar com
produtor** ou a **disparar alerta**. Dos seis itens lidos a fundo em 07/09, o item de maior
score (OpenRouter ToS, 11/15) bateria PROTOTIPAR pelo score bruto — mas a única ação
possível é checar uma configuração de conta, não mudar código, então trava em DISCUTIR por
regra explícita. Os outros dois DISCUTIR são leitura de mercado (concorrentes), não spike de
produto. Nesta semana em especial isso importa mais que de costume: o `STATE.md` mede 58
commits contra zero mensagens de produtor — o projeto não precisa de mais uma fila de
trabalho de código agora, precisa de conversa.

**Adendo de 01/09:** os quatro itens de 31/08 foram decididos pelo Stefano no mesmo dia e
viraram código — três PRs mesclados (#13, #14, #15). Estão no Arquivo, cada um com o que
aconteceu. Isso NÃO contradiz a `verdict_note`: ela trava a PROMOÇÃO automática de item que
só adiciona capacidade; nenhum destes subiu sozinho de DISCUTIR. Quem decidiu foi o
fundador, que é exatamente o que a seção "Em aberto" existe para provocar. O registro fica
aqui porque a alternativa — apagar a pergunta depois de respondida — perderia o rastro de
por que o código existe.

## Radar

- `2026-10-26` **OpenRouter rebatiza "Pay-as-you-go" para "Standard" e lança tier "Business" (8%, DPA, regional EU/US) — taxa que a Stevi paga (5,5%, nas duas contas) não muda.** Closing da aquisição pela Stripe ainda sem confirmação oficial. [OpenRouter](https://openrouter.ai/pricing) · 7/15
- `2026-10-26` **Anthropic confirma Claude Haiku 4.5 (usado no router da Stevi) segue ativo — só o Sonnet 4.5 foi formalmente depreciado (retirada 30/11/2026, substituído por 5.5, que não afeta a Stevi).** [Anthropic](https://platform.claude.com/docs/en/about-claude/model-deprecations) · 7/15
- `2026-10-26` **Vercel para de cachear respostas com `Vary: Cookie` no CDN e renomeia "Edge Requests" pra "CDN Requests" no billing.** Sem mudança de preço anunciada; vale checar se alguma rota da Stevi seta cookie e dependia desse cache. [Vercel](https://community.vercel.com/t/vercel-weekly-october-5-2026/50269) · 7/15
- `2026-10-26` **Manacá-1B-Instruct-2: segunda geração de um LLM nativo em português brasileiro (1,72B params, treinado do zero), com alinhamento de segurança reproduzível e resultados negativos de DPO documentados.** Ângulo de custo/soberania de dados — a Stevi hoje usa Claude/Gemini via OpenRouter, não um modelo nacional. [arXiv](https://arxiv.org/abs/2610.20570) · 7/15
- `2026-10-26` **Focos de incêndio no Amazonas sobem 116% em 2026 (BDQueimadas/INPE) — confirma que a fonte de dados de queimada que a Stevi já consome (INPE Queimadas) está ativa e com sinal real na safra.** [Poder360](https://www.poder360.com.br/poder-sustentavel/focos-de-incendio-no-amazonas-crescem-116-em-2026/) · 6/15
- `2026-10-26` **Pesquisa Faemg/Senar/UFLA projeta safra de café de MG em 33,4 Mi de sacas em 2026 (+23,6%), mas com 40% da área afetada por evento climático — direto no beachhead (Sul de Minas).** [Diário do Comércio](https://diariodocomercio.com.br/sindijori-mg/safra-de-cafe-em-minas-gerais-deve-alcancar-334-milhoes-de-sacas-em-2026/) · 6/15
- `2026-10-26` **A100: modelo de visão agrícola pré-treinado em 3M de imagens não rotuladas de >100 culturas, mirando o gargalo de dado anotado em diagnóstico por foto.** Toca o known_gap de cobertura (`reason.ts`, só 5 culturas) mas é infraestrutura pesada demais pra replicar — sem peso/código liberado no abstract. [arXiv](https://arxiv.org/abs/2610.22991) · 6/15
- `2026-10-26` **Myca levanta US$1,3M pre-seed pra transformar mensagem/foto/ligação do WhatsApp de equipe de campo agro em dado estruturado — clientes incluem Bayer e Olam.** Categoria adjacente (estruturação de operação B2B, não conselho ao pequeno produtor), mesmo padrão da Tellia. [AgFunderNews](https://agfundernews.com/myca-raises-1-3m-pre-seed-to-put-ai-agents-in-charge-of-agribusiness-field-operations) · 6/15
- `2026-10-26` **Correção de data: o Vertex AI aposentou o `gemini-2.5-flash` em 20/10/2026, não 16/10 como o comentário em `api/_lib/env.ts` registra — e já passou.** Irrelevante na prática: o pin `google-ai-studio` (`transcribeProviderPin()`) protege a Stevi da rota Vertex independente da data exata; vale só corrigir o comentário se o código for tocado de novo. [Google Cloud](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versions) · 6/15
- `2026-10-26` **MAPA prorroga (90→180 dias) o prazo de migração ao SISPA (Portaria 1.676/2026) — confirmado que é instrumento separado da Portaria 1.579/2026 (vazio sanitário) que a Stevi já usa; zero arquivo do repo muda.** [AgriBrasilis](https://agribrasilis.com/?p=38525) · 5/15
- `2026-10-26` **Benchmark australiano mostra LLM genérico errando grosseiramente estimativa de carbono orgânico do solo sem grounding — tema que a Stevi nem processa (`soil.ts` só lê pH/argila/areia), mas reforça a arquitetura já adotada de nunca deixar o LLM calcular número sozinho.** [arXiv](https://arxiv.org/abs/2610.18201) · 5/15
- `2026-10-26` **Tellia (Paris/SF) levanta US$5M pra API de voz que estrutura observação de campo em registro georreferenciado — vendida a cooperativas/agtechs (IFV, KWS Saat), não ao pequeno produtor; não é conselho agronômico.** [StartupRise](https://startuprise.co.uk/tellia-secures-e4-3-mn/) · 5/15
- `2026-10-26` **Anthropic remove `temperature`/`top_p`/`top_k` pra Claude Opus/Sonnet 4.7+ na versão de API 2026-10-21 — não afeta a Stevi, que usa `claude-sonnet-5`/`claude-haiku-4.5`, fora dessa faixa de versão.** [Anthropic](https://platform.claude.com/docs/en/api/migration-2026-10-21) · 5/15
- `2026-10-26` **ElevenLabs lista Eleven v4/v4 Turbo (US$0,08 e US$0,04/1k chars) ao lado dos modelos v3 já usados pela Vitória — sem data de corte dos antigos.** [ElevenLabs](https://elevenlabs.io/pricing/api) · 5/15
- `2026-10-26` **Supabase CLI v2.120.0 ganha logs persistentes por serviço e tracing OpenTelemetry opt-in — útil se algum dia for preciso depurar `cron/monitor.ts` sem reproduzir em produção.** [GitHub](https://github.com/supabase/cli/releases/tag/v2.120.0) · 5/15
- `2026-10-26` **Yara (CVC) entra no segundo closing da Series B da Stenon (sensor de nitrogênio do solo + IA) — concorre conceitualmente com o papel que o SoilGrids cumpre hoje na Stevi, mas é hardware caro, não ameaça direta.** [AgNavigator](https://www.agnavigator.com/Article/2026/10/14/yara-backs-stenon-in-series-b-vote-of-confidence-for-soil-nitrogen-intelligence-platform/) · 5/15
- `2026-10-26` **Cresol passa a notificar assinatura de contrato de crédito agro por WhatsApp (DocuSign) — fluxo de 7 dias pra 1, cooperativa cita baixa familiaridade com e-mail no campo.** Categoria diferente (crédito, não conselho), valida de leve o canal. [Baguete](https://www.baguete.com.br/noticias/cresol-digitaliza-assinaturas-com-docusign) · 5/15
- `2026-10-26` **Paper sincroniza manual de operador de trator via CAN bus (ISO 11783) para manter grounding de LLM embarcado atualizado sem depender de conectividade — mecanismo de grounding offline, known_gap aberto de operação offline do produtor.** [arXiv](https://arxiv.org/abs/2610.31863) · 5/15
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
- `2026-10-26` **[era DISCUTIR 11/15, aberta 07/09] Prompt logging na OpenRouter — envelheceu sem decisão (49 dias).** O Stefano nunca confirmou se as duas contas (principal + reserva do twin-me) têm a opção desligada. Regra mecânica de 21 dias aplicada — nenhuma mudança no repo depende disso.
- `2026-10-26` **[era DISCUTIR 9/15, aberta 07/09] App do Cacau (UESC/Bahia) — envelheceu sem decisão (49 dias).** A pergunta (vale checar se há movimento equivalente nascendo pra café em MG via EPAMIG/Embrapa?) nunca foi respondida. Regra mecânica de 21 dias.
- `2026-10-26` **[era DISCUTIR 8/15, aberta 07/09] Café 360 (100+ downloads, mesma região) — envelheceu sem decisão (49 dias).** A pergunta (citar no README de posicionamento?) nunca foi respondida — mas esta rodada trouxe um segundo data point independente (Instacrops, ver "Em aberto"), o que torna a pergunta mais forte, não obsoleta.
- `2026-10-26` **[era DISCUTIR 10/15, aberta 24/08] Horário único (08:00) pros três tipos de alerta proativo — envelheceu sem decisão (63 dias).** Fica sem efeito prático enquanto `farmer_alerts` continuar em 2 linhas de teste e zero produtor real tiver pin — mas a pergunta (horário por tipo de alerta vs. horário único) volta a valer no dia em que o canal reativar.
- `2026-10-26` **[era DISCUTIR 10/15, aberta 24/08] Cobrança de mensagem de serviço no WhatsApp a partir de 01/10 — confirmada em vigor, envelheceu sem decisão sobre a pergunta original (63 dias).** A Meta passou a cobrar mensagens de serviço após franquia de 1.000/mês por número e voltou a cobrar utility dentro da janela de 24h, exatamente como previsto ([Meta](https://developers.facebook.com/docs/whatsapp/pricing), confirmado 2026-10-01). Efeito prático hoje: **zero** — o sistema está sem tráfego (0 mensagens em 7 dias). A pergunta original ("alguém olha o billing da WABA semanalmente?") nunca foi respondida e fica sem urgência enquanto durar a pausa, mas volta a importar se a campanha for retomada.
