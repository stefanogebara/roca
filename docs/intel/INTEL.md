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
> **Quinta passada (2026-11-16) — o voo acabou há 66 dias, veredito MATAR/PIVOTAR (11/09),
> e esta é a primeira varredura desde então.** O feed do resumo matinal veio vazio de novo
> (mesmo snapshot de 22/08/2026 — agora com quase 3 meses de idade). Cinco scouts cobrindo
> ~60-90 dias (não os 7-21 dias usuais, porque o repo ficou mudo entre 08/09 e hoje), ~41
> candidatos brutos depois de dedup óbvio, sete lidos a fundo por um analista cada. **Dois
> DISCUTIR, seis REGISTRAR, o resto DESCARTAR — de novo nenhum PROTOTIPAR, nenhum
> IMPLEMENTAR**, sétima rodada seguida sem spike. Os cinco itens "Em aberto" das rodadas
> anteriores (24/08 e 07/09) passaram dos 21 dias sem decisão do Stefano e foram movidos
> pro Arquivo por idade — um deles (a cobrança de 01/10 da Meta) fechou com resposta real:
> entrou em vigor exatamente como previsto, sem atraso, e o cálculo de 24/08 (impacto ~zero
> porque alerta já era template pago) se confirma. Os dois achados novos que ficam: a Meta
> tentou (e um tribunal a impediu, por ora) restringir/cobrar bots de IA de terceiro na API
> oficial do WhatsApp Business — ameaça direta a `bets[0]`, nunca testada contra um bot de
> nicho como o Stevi; e o Google já depreciou `gemini-2.5-flash` (o modelo de transcrição do
> Stevi) com reroteamento forçado para `gemini-3.5-flash-lite` em 01/12/2026 — mais barato
> em áudio, mas nunca testado em qualidade de voz de roça em PT-BR. **Contexto que pesa mais
> que qualquer achado de mercado: o repositório não recebeu uma linha de engenharia desde
> 08/09/2026, e a base não recebe mensagem de produtor desde 30/09/2026 (47 dias de silêncio
> total na leitura mais recente do `stevi-pm-scorecard`, `.claude/plans/memos-scorecard/README.md`).
> Ver `docs/intel/STATE.md` para o estado completo.
>
> **Sexta passada (2026-11-23) — 73 dias desde o fechamento, décima rodada consecutiva sem
> spike.** Feed do resumo matinal veio vazio de novo para o roca (mesmo snapshot de 22/08/2026).
> Cinco scouts cobrindo a janela 07/09–23/11 (mais larga que o padrão, porque entre rodadas
> mescladas o repo ficou mudo), ~45 candidatos brutos, seis lidos a fundo por um analista cada
> depois de uma passada de G4 que descartou direto ~30 itens claramente fora de escopo ou
> fracos demais pra justificar leitura completa (ver `seen.jsonl`). **Dois DISCUTIR, nove
> REGISTRAR, o resto DESCARTAR — de novo zero PROTOTIPAR, zero IMPLEMENTAR.** Os dois DISCUTIR
> novos são técnicos, não de mercado: a OpenRouter confirmou um incidente real de tratamento de
> dados em provedores de inferência da sua rede (não autodeclaração de ToS como o item já
> arquivado de 07/09 — um fato novo), e um paper (AgroGround) mede que fine-tuning de grounding
> em VLM agrícola troca localização por reconhecimento/recusa, com um número que acende direto o
> known_gap do goldenset sem `verified_by`: 28,6% de concordância indevida quando o produtor
> sugere um nome de praga errado numa foto doente. Os dois itens "Em aberto" de 16/11 (Meta×CADE,
> depreciação do Gemini) ainda não chegam a 21 dias — continuam abertos. **O achado que mais
> importa de novo não é nenhum destes: é que esta rodada escolheu não abrir uma PR nova.** Em
> vez da décima quarta PR de `/intel`/memo sem revisão, o incremento de hoje foi empilhado em
> cima da PR #42 (16/11) — a recomendação nº2 do próprio corpo daquela PR. Ver `docs/intel/STATE.md`
> para a tabela completa das treze PRs abertas e o motivo de cada uma estar parada.

## Em aberto — precisa de decisão do Stefano

### [DISCUTIR 10/15] Um paper mede que o fine-tuning de grounding em VLM agrícola troca localização por recusa — e a Stevi não testa esse risco no goldenset
**Data:** 2026-11-23 · **Eixos:** P2 A2 D2 E2 L2
**Fonte primária:** [AgroGround (arXiv)](https://arxiv.org/abs/2610.04425)

**O que é:** benchmark de 1.478 imagens agrícolas verificadas por humanos (F1 inter-anotador
0,789) mais um dataset de 794.850 instruções com grounding automático, usado para testar o que
muda quando um VLM agrícola é fine-tunado só para apontar ONDE está o problema na imagem.
Achados com número: fine-tuning só-de-grounding derruba reconhecimento de 4 alternativas de
51,7% para 29,2%; corrigir o formato da instrução recupera para 72,7% sem perder grounding;
treinar com negativos de imagem saudável dá 94,1% de recusa correta numa foto sadia, mas só
**28,6% de recusa quando o nome da praga sugerido pelo usuário está errado numa imagem doente**
(ou seja, 71,4% das vezes o modelo concorda com o nome errado que o usuário propôs). RL ganha
localização às custas de reconhecimento e recusa. Conclusão central: grounding redistribui erro
entre localizar/nomear/recusar, não melhora os três juntos.

**Por que toca este projeto:** `api/_lib/reason.ts:264` (`identifyFromPhoto`) manda a foto do
produtor direto para `MODELS.reasoning()` (claude-sonnet-5 via OpenRouter) em zero-shot, sem
grounding visual, sem bounding box, sem dataset de treino próprio — e sem teste explícito hoje
de "o Stevi recusa corretamente numa foto saudável?" nem "o Stevi confirma um nome de praga
errado que o produtor sugeriu?". O goldenset (`knowledge/goldenset/goldenset.jsonl`, 38 casos,
`verified_by=null` em todos) não tem essas duas categorias. O número de 28,6% do paper é
evidência externa — não prova direta sobre o modelo do Stevi — de que essa classe de erro
(concordância indevida com sugestão do usuário) é real em VLMs de diagnóstico visual.

**Por que isso não sobe de DISCUTIR:** um spike de ~4h adicionando casos de folha saudável e de
nome sugerido errado ao goldenset, e medindo a taxa de concordância indevida do
`identifyFromPhoto` atual, é exatamente o tipo de PROTOTIPAR que a `verdict_note` travaria —
melhora capacidade de diagnóstico, não ajuda a CONVERSAR COM PRODUTOR nem a DISPARAR ALERTA. E
com o canal sem produtor real há 54 dias, não há quem usaria esse diagnóstico mais seguro hoje.

**A pergunta:** vale o spike de ~4h mesmo assim — testar se o Stevi confirma um nome de praga
errado que o produtor sugere, hoje, enquanto o projeto está pausado e é barato verificar — ou
isso é "capacidade" demais pro momento do voo (tripwire disparado, literal, há onze semanas) e
deve esperar o Stevi ter alvo real de novo?

---

### [DISCUTIR 9/15] A OpenRouter confirmou um incidente real de tratamento de dados em provedores da sua rede — diferente do risco de ToS já arquivado
**Data:** 2026-11-23 · **Eixos:** P3 A2 D2 E1 L1
**Fonte primária:** [OpenRouter — Data Processing Incidents on Inference Providers](https://openrouter.ai/blog/announcements/data-processing-incidents-on-inference-providers/)

**O que é:** pesquisadores de segurança externos encontraram provedores de inferência na rede
da OpenRouter que não cumpriam as políticas de dados declaradas (a OpenRouter afirma não ter
havido breach nela própria). Resposta: desligou 3 provedores não-nomeados, removeu 125
endpoints da elegibilidade Zero Data Retention. Quatro provedores confirmaram publicamente o
problema (Atlas Cloud, Novita, Phala, Together) — todos servem modelos open-weight de terceiros,
não Claude nem Gemini. Isto é um FATO (incidente real, confirmado pela própria OpenRouter), não
uma leitura de cláusula de ToS como o item já arquivado em 07/09 sobre prompt logging.

**Por que toca este projeto:** OpenRouter é o gateway principal de LLM do Stevi
(`api/_lib/llm.ts`). O mecanismo de pin de provider (`ProviderPrefs`, `api/_lib/llm.ts:33-37`)
já existe e já é usado para a transcrição (`transcribeProviderPin()`, `api/_lib/env.ts:29-32`),
mas **nenhuma chamada aos modelos Anthropic (`router()`/`reasoning()`) usa esse pin hoje** —
roteamento livre, confirmado por grep em todos os call-sites. É o segundo evento de confiança na
OpenRouter em três meses, depois da aquisição pela Stripe (19/08) que já motivou a
diversificação em `api/_lib/llmDirect.ts`.

**Por que isso trava em DISCUTIR:** é risco de vendor/infra, não conversa ou alerta — a
`verdict_note` travaria de qualquer forma mesmo que o score batesse PROTOTIPAR.

**A pergunta:** vale fechar `only: ['anthropic']` no router/reasoning (reaproveitando o
`ProviderPrefs` que já existe, defesa preventiva barata) — ou é esforço num risco que a própria
OpenRouter já mitigou, e que, pelos nomes públicos confirmados até agora, não bate nos modelos
que o Stevi usa?

---

### [DISCUTIR 11/15] A Meta tentou restringir bots de IA de terceiro no WhatsApp — e um bot de nicho como o Stevi nunca foi testado contra essa linha
**Data:** 2026-11-16 · **Eixos:** P3 A1 D2 E2 L3
**Fontes primárias:** [Tecnoblog](https://tecnoblog.net/noticias/cade-mantem-multa-diaria-de-r-250-mil-contra-meta/) · [Canaltech](https://canaltech.com.br/apps/whatsapp-justica-mantem-liminar-do-cade-sobre-uso-de-ia-de-terceiros/)

**O que é:** em out/2025 a Meta mudou os termos do WhatsApp Business API (efetivos 15/01/2026)
proibindo "provedores de IA" cujo produto é um assistente de propósito geral/open-ended
(ChatGPT, Perplexity, Copilot, Luzia, Zapia) de operar na plataforma — e tentou cobrar
~US$0,0625 por mensagem de chatbot fora do padrão de template, reclassificando-as como
"mensagem de marketing". O CADE concedeu liminar obrigando a Meta a manter acesso de
Luzia/Zapia; o Tribunal do CADE negou recurso da Meta por unanimidade em 04/03/2026 e manteve
multa diária de R$250 mil, mas a Justiça Federal de SP suspendeu essa multa em 04/05/2026. O
mérito (abuso de posição dominante) segue aberto na Superintendência-Geral do CADE — nenhum
desenvolvimento confirmado entre maio e novembro/2026 apesar de busca direcionada.

**Por que toca este projeto:** é o mesmo transporte que `api/_lib/transport/cloud.ts` usa em
produção, e ameaça `bets[0]` ("WhatsApp é a única interface viável — não construir app") na
raiz: a Meta demonstrou que pode, por decisão unilateral, restringir ou cobrar extra de bots
de IA de terceiro na API oficial — sujeita só a litígio incerto. A política da Meta distingue
"IA como produto central/open-ended" (banido) de "IA acessória a um serviço de negócio
legítimo" (permitido) — mas essa linha nunca foi testada publicamente contra um assistente
vertical de nicho (triagem agronômica, sem chat aberto) como o Stevi. Nem Luzia/Zapia nem
nenhuma fonte aberta resolve em qual categoria a Stevi cairia.

**Por que isso não vira código agora:** não há arquivo de produto a mudar — é risco
regulatório externo, não um gap de implementação. A `verdict_note` trava em DISCUTIR mesmo
com score 11 (que bateria PROTOTIPAR): o item só adiciona risco/contexto, não ajuda a
CONVERSAR com produtor nem a DISPARAR alerta.

**A pergunta:** dado que o projeto já está em pausa MATAR/PIVOTAR desde 11/09 (sem volume
real de mensagem de produtor para a Meta restringir hoje), isso muda algo na decisão agora —
ou é só uma linha a vigiar para quando/se o Stevi for revivido? Se for revivido, vale pedir à
Meta ou a um BSP parceiro uma confirmação explícita de categoria antes de reescalar volume?

---

### [DISCUTIR 11/15] O Google já depreciou o modelo de transcrição do Stevi — reroteamento forçado em 01/12/2026, sem teste de qualidade em PT-BR
**Data:** 2026-11-16 · **Eixos:** P3 A2 D2 E2 L2
**Fonte primária:** [Google AI Studio — pricing](https://aistudio.google.com/docs/pricing)

**O que é:** a página oficial de pricing do Google AI Studio confirma, num callout explícito,
que `gemini-2.5-flash` já está depreciado e fora do seletor de modelos do AI Studio. A partir
de 01/12/2026 (15 dias a partir de hoje) toda chamada à API com esse model ID é roteada
automaticamente pelo próprio Google para `gemini-3.5-flash-lite`, cobrada nas tarifas desse
modelo novo. Para o único uso real que o Stevi faz desse modelo — input de ÁUDIO na
transcrição de voz — isso é uma QUEDA de preço (US$1,00 → US$0,30 por 1M tokens de áudio,
output igual em US$2,50). O aumento de preço de até 2× que trackers de terceiros anunciaram é
do `gemini-3.8-flash`, modelo que o Stevi nunca adotou — o enquadramento inicial de "aumento
de preço" não se sustentou na fonte primária.

**Por que toca este projeto:** é literalmente o pin de transcrição do Stevi
(`ROCA_TRANSCRIBE_PROVIDER=google-ai-studio`, `api/_lib/env.ts`, `api/_lib/llm.ts`,
`api/_lib/llmDirect.ts`), decidido em 01/09/2026 com a premissa explícita (registrada neste
mesmo arquivo) de que "a API pública segue sem data de desligamento anunciada" — premissa que
não é mais verdadeira. O comentário em `api/_lib/env.ts:23-27` ficou desatualizado nos dois
lados (a data do Vertex já passou, e agora o AI Studio também tem data). O modelo-juiz default
do gym (`api/_lib/gym/judge.ts`, `api/_lib/gym/goldeneval.ts`) também pode ser afetado pelo
mesmo reroteamento.

**Por que isso trava em DISCUTIR:** o score bruto (11) bateria PROTOTIPAR, mas a
`verdict_note` exige que PROTOTIPAR/IMPLEMENTAR ajudem a CONVERSAR com produtor ou DISPARAR
alerta — isso é manutenção defensiva de infraestrutura que, na melhor hipótese, preserva
capacidade existente. E o produto tem zero volume real de voz de produtor há meses.

**A pergunta:** vale gastar algumas horas do que resta do projeto rodando o goldenset de
transcrição PT-BR contra `gemini-3.5-flash-lite` antes de 01/12, ou deixamos o reroute
automático do Google acontecer sem validação — aceitando que o preço fica igual/menor, mas a
qualidade de transcrição de voz de roça (e o modelo-juiz default do gym) muda sem teste?

---

## Fila de trabalho

_vazio — nada passou de PROTOTIPAR/IMPLEMENTAR nesta rodada. Quinta rodada seguida (24/08,
31/08, 07/09, 16/11, 23/11) e oitavo veredito sem spike na campanha. O item de maior score
desta rodada (AgroGround, 10/15) bateria PROTOTIPAR pelo bruto, mas trava em DISCUTIR pela
mesma regra de sempre: melhora capacidade de diagnóstico, não ajuda a conversar ou alertar._

A `verdict_note` deste projeto exige que PROTOTIPAR e IMPLEMENTAR ajudem a **conversar com
produtor** ou a **disparar alerta**. Dos sete itens lidos a fundo em 16/11, os dois de maior
score (CADE×Meta e depreciação do Gemini, 11/15 cada) bateriam PROTOTIPAR pelo score bruto —
mas um é risco regulatório externo sem arquivo de produto a mudar, e o outro é manutenção
defensiva de infraestrutura (preservar capacidade de transcrição existente), não conversa ou
alerta novo; os dois travam em DISCUTIR por regra explícita. Nesta rodada isso importa mais
que de costume: segundo `.claude/plans/memos-scorecard/README.md`, o repositório não recebe
uma linha de engenharia desde 08/09 e a base não recebe mensagem de produtor desde 30/09 — o
projeto não precisa de mais uma fila de trabalho de código agora, precisa de uma decisão
humana sobre o próprio veredito já entregue há 66 dias.

**Adendo de 01/09:** os quatro itens de 31/08 foram decididos pelo Stefano no mesmo dia e
viraram código — três PRs mesclados (#13, #14, #15). Estão no Arquivo, cada um com o que
aconteceu. Isso NÃO contradiz a `verdict_note`: ela trava a PROMOÇÃO automática de item que
só adiciona capacidade; nenhum destes subiu sozinho de DISCUTIR. Quem decidiu foi o
fundador, que é exatamente o que a seção "Em aberto" existe para provocar. O registro fica
aqui porque a alternativa — apagar a pergunta depois de respondida — perderia o rastro de
por que o código existe.

## Radar

- `2026-11-23` **Croppie (estimativa de safra de café por foto + SMS, Uganda) é avaliado para expansão ao Quênia — mecanismo diferente do Stevi (safra, não praga/doença), ainda exploratório.** CGIAR/Alliance Bioversity-CIAT e o KALRO-Coffee Research Institute do Quênia discutem (set/2026, sem piloto ainda) adaptar a ferramenta — nascida em Uganda, >2.300 fazendas autodeclaradas — ao setor cafeeiro queniano. Conta cerejas por foto, prevê produção por lote, manda previsão + conselho agronômico por SMS. Café + foto + canal de texto para smallholder é a mesma categoria do Stevi; estimativa de safra via SMS é mecanismo diferente de triagem de praga/doença via WhatsApp. [CGIAR](https://www.cgiar.org/news-events/news/bridging-gap-can-croppie-take-root-kenyas-coffee-sector) · 5/15
- `2026-11-23` **Paper de conferência regional usa LLM genérico sem grounding para sugerir "tratamento básico" de doença de tomate, sem métrica nem disclaimer anti-prescrição.** Mistral/Llama 3.2 via LangChain, sem avaliação quantitativa divulgada, venue sem peer review forte (ICMR 2026). Contraste de postura com o compliance.ts do Stevi, mas evidência fraca demais para indicar tendência de mercado real — n=1, sem número. [arXiv](https://arxiv.org/abs/2611.10608) · 5/15
- `2026-11-23` **ElevenLabs lança Scribe v3 — mesmo preço, 27% menos erro de transcrição.** Toca o platform_dep de voz do Stevi (ligações da Vitória), não o caminho de texto do produtor. Upgrade de qualidade sem mudança de custo. [ElevenLabs](https://elevenlabs.io/pricing/api) · 5/15
- `2026-11-23` **Minerva Foods compra participação na Grão Direto, dona do assistente de IA "AIrton" no WhatsApp — valida WhatsApp+IA em escala B2B de commodity, categoria diferente do conselho agronômico ao produtor.** AIrton já atendeu ~2Mt dos 12Mt comercializados em 2025; outros investidores incluem Bayer, ADM, Cargill. [AgFeed](https://agfeed.com.br/agtech/exclusivo-minerva-foods-compra-participacao-e-se-torna-investidora-da-grao-direto) · 5/15
- `2026-11-23` **Gran Mestre: assistente gratuito no WhatsApp calcula custo/ha para produtor de 200ha+ — mesmo canal, segmento e mecanismo diferentes do Stevi.** GRAN Soluções Agrícolas (Pato Branco, PR); sem triagem de praga/doença, foco em custo de insumo e cotação. Mais um data point de "WhatsApp+IA gratuito" como padrão de indústria no agro BR. [UAI](https://www.uai.com.br/?p=189966) · 5/15
- `2026-11-23` **A100: modelo de visão fundacional agrícola pré-treinado sem rótulos em ~3M imagens de campo.** CNN+Transformer híbrido (self-distillation + reconstrução de patches mascarados); features congeladas servem para classificação e regressão. Contexto arquitetural — o Stevi não treina modelo próprio, diagnóstico é LLM multimodal zero-shot via OpenRouter. [arXiv](https://arxiv.org/abs/2610.22991) · 5/15
- `2026-11-23` **Framework baseado em ontologia (regras de especialista, não treino em larga escala) para diagnóstico interpretável de doença de fruta — F1 85%, comparável a VGG16.** Arquitetura alternativa de baixo custo computacional; sem transferência clara para o pipeline do Stevi hoje. [arXiv](https://arxiv.org/abs/2611.00039) · 5/15
- `2026-11-16` **Vereda captou R$30M para vender insumo via WhatsApp — e a própria aposta inicial no WhatsApp como funil de venda autossuficiente "não se confirmou".** Canary, Valor Capital Group e Speedrun/a16z. O agente "Vera" organiza pedido/proposta/financiamento de insumo entre produtor, indústria e os próprios vendedores da Vereda. Os fundadores mantiveram o WhatsApp como canal (não migraram para app) — só voltaram a pôr vendedor humano no meio de uma negociação de semanas que um bot sozinho não fechava. Fraco como ameaça a `bets[0]`: o uso do Stevi (triagem + alerta) é estruturalmente mais simples que fechar venda B2B financiada. [Startups.com.br](https://startups.com.br/negocios/agtech/vereda-capta-r-30m-para-conectar-industria-de-insumos-direto-ao-produtor/) · 4/15, descartado
- `2026-11-16` **KyGround: busca literal (tool-calling) cai 20-32 pontos com acento/maiúscula/transliteração grega — e o Stevi já blinda esse ponto cego.** Benchmark 198 perguntas, assistente agrícola grego-inglês; normalização de acento+stemming recupera a 83,8% (ainda atrás do RAG, 95,3%). `lookupPest` em `api/_lib/tools/agrofit.ts` já faz NFD+lowercase+colapso de pontuação+token-overlap scoring — mais robusto que a correção que o paper recomenda. Reforça, não muda, a decisão de 24/08 contra RAG denso. [arXiv](https://arxiv.org/abs/2610.08205) · 7/15
- `2026-11-16` **Digital Green/FarmerChat: gate de qualidade de imagem com modelo leve antes do LLM caro.** 1,16M fotos de produtores (Etiópia/Índia/Quênia/Nigéria); MobileNetV3 como filtro de qualidade bate GPT-4o em F1 (86,9%) a 12ms, pedindo foto melhor antes de gastar com o modelo grande. Técnica transferível ao caminho de foto do Stevi, mas sem known_gap nomeado que isso resolva hoje — contexto, não fila de trabalho. [arXiv](https://arxiv.org/abs/2609.21651) · 7/15
- `2026-11-16` **Instacrops (Chile) prepara agente gratuito via WhatsApp com alerta de geada, sem sinal de expansão ao Brasil.** SaaS pago de IoT/satélite com ~3.000 usuários (Chile/Peru/México/Colômbia/Uruguai/Guatemala); camada WhatsApp nasceu porque só 15% dos usuários usava a plataforma paga contra 80% que já gerencia o negócio por WhatsApp. Artigo (abr/2026) não confirma se o alerta é proativo (push) ou reativo, nem cita o Brasil — é o concorrente LatAm mais próximo em mecanismo, mas a ameaça real ainda não está demonstrada. [Diario Financiero](https://www.df.cl/df-lab/innovacion-y-startups/instacrops-ampliara-su-portafolio-de-agentes-de-ia-que-operan-por-whatsapp) · 6/15
- `2026-11-16` **Manual de implemento via CAN bus (ISO 11783) dá assistente LLM offline a trator — mecanismo não transfere pro celular do produtor.** Proof-of-concept em PC (não embarcado), retrieval semântico bate palavra-chave entre idiomas (80-93% vs 9-24%), modelos 7-8B empatam com 120B em inglês mas pioram em 5 outros idiomas (sem português testado). Toca o known_gap "operação offline do produtor" só na etiqueta — não há CAN bus nem ECU no caminho do WhatsApp Cloud API. [arXiv](https://arxiv.org/abs/2610.31863) · 6/15
- `2026-11-16` **Fundo RAIZ (The Yield Lab Latam) declara tese de investimento em IA conversacional por WhatsApp/voz para o pequeno produtor.** Até R$200M, aportes de R$1-5M; justificativa citada: ~5M estabelecimentos agro vs 100 mil atingidos por tecnologia tradicional. Valida de leve a tese de distribuição do `bets[0]`, mas é tese declarada de um fundo, não produto ou dado de uso — contexto de mercado, não gatilho de ação. [AgFeed](https://agfeed.com.br/agtech/the-yield-lab-procura-ia-boa-de-papo-com-produtor-rural/) · 6/15
- `2026-11-16` **Cobrança de service messages da Meta (01/10) entrou em vigor exatamente como previsto, sem atraso — confirma o cálculo de 24/08.** BSPs brasileiros (Digisac) e a própria doc da Meta confirmam: sem mudança de termos, franquia de 1.000 mensagens grátis/mês por número. Desenvolvedores reclamaram no fórum oficial da Meta pedindo reversão; sem resposta até 16/11. Como o Stevi já paga template em todo alerta proativo (delta calculado: zero) e o caminho conversacional custa ~R$0,75/produtor/mês, a exposição continua irrelevante como custo — movido pro Arquivo como resultado confirmado, ver abaixo. [Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) · 4/15, dedup/resultado
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

- `2026-11-16` **[era DISCUTIR 10/15] A cobrança de 01/10 da Meta entrou em vigor exatamente como previsto — resultado confirmado, não decisão pendente.** A cobrança de service messages começou em 01/10/2026 sem atraso e sem mudança de termos (confirmado por BSP brasileiro e pela doc da própria Meta); houve reclamação pública de desenvolvedores no fórum oficial pedindo reversão, sem resposta até hoje. O cálculo de 24/08 se confirma: o alerta do Stevi não encarece (já cai em `template`, que já era pago), o caminho conversacional custa ~R$0,75/produtor/mês — irrelevante como custo. O risco real nomeado (continuidade de pagamento da WABA) nunca chegou a ser testado, porque o canal não tem volume real de produtor desde muito antes de 01/10. Movido pro Arquivo como resultado medido, não pergunta respondida.
- `2026-11-16` **[eram DISCUTIR, envelheceram sem decisão — 3 itens de 24/08 e 07/09, +80 dias sem resposta do Stefano]** Regra mecânica de 21 dias aplicada. Nenhum destes foi decidido nem invalidado por evidência nova; ficam arquivados por idade, não por resultado, e podem ser reabertos se o voo for revivido:
  - **[era DISCUTIR 11/15, 07/09] Prompt logging na OpenRouter está desligado nas duas contas?** Pergunta de configuração de conta (principal + reserva `OPENROUTER_FALLBACK_API_KEY`), nunca confirmada. Dado que o projeto não processa mensagem real de produtor desde 30/09, o risco de exposição de dado real por essa via está, na prática, zerado por falta de tráfego — mas a configuração em si continua não verificada.
  - **[era DISCUTIR 9/15, 07/09] Um projeto universitário gratuito (App do Cacau, UESC/Bahia) roda o mesmo mecanismo do Stevi.** Pergunta sobre se o padrão "universidade+fundação, gratuito pra sempre" se replica para café em MG (EPAMIG/Embrapa) nunca foi investigada.
  - **[era DISCUTIR 8/15, 07/09] Café 360 Premium (Zavarise) tem 100+ downloads no beachhead — vale citar como data point de posicionamento?** Nunca decidido se entra no README de posicionamento.
  - **[era DISCUTIR 10/15, 24/08] O primeiro alerta sai às 08:00 para todo mundo, ou por tipo de alerta?** Pergunta de desenho (geada à noite vs. queimada na hora vs. vazio em horário comercial) nunca decidida — e continua sem dado, porque `farmer_alerts` segue em 2 linhas de teste desde 14/08.
- `2026-09-07` **[era DISCUTIR 10/15] A Fecon aconteceu 1–3/09 — e gerou zero cadastros, apesar do kit pronto.** O kit (`64152d6`) e a regra de vouch (`527120b`, token `#fecon` vs. `#fecon-cartaz`) foram shipados dias antes da feira. Medição de 07/09 no banco: `users.source ilike '%fecon%'` retorna **zero linhas**; só 1 usuário novo entrou no banco desde 31/08 (`kind='empresa'`, não produtor). O repositório não registra se o Stefano foi e não usou o kit, ou não foi — mas o resultado é o mesmo: a única janela de campo dentro do voo de 60 dias não converteu ninguém. Movido pro Arquivo como resultado, não como decisão pendente — a pergunta original ("você vai?") não faz mais sentido perguntar, a janela fechou.
- `2026-09-01` **[era DISCUTIR 10/15] A OpenRouter virou parte da Stripe — decidido: diversificar em duas camadas, sem esperar mudança de termos.** O Stefano mandou ir fundo e liberou trocar modelo. Confirmado com as fontes primárias que a aquisição foi anunciada pelas DUAS partes em 19/08 ("same product, same roadmap", closing pendente) — promessa, não contrato. Entraram: fallback direto por chave (`api/_lib/llmDirect.ts`, Anthropic Messages API e endpoint OpenAI-compat do Google AI Studio) em #13, e chave RESERVA do OpenRouter — conta separada, a do projeto twin-me — como camada 1 em #14, já configurada em produção (`OPENROUTER_FALLBACK_API_KEY`) com redeploy feito. O gateway deixou de ser ponto único. [Stripe](https://stripe.com/newsroom/news/stripe-agrees-to-acquire-openrouter) · [OpenRouter](https://openrouter.ai/blog/announcements/openrouter-is-joining-stripe/)
- `2026-09-01` **[era DISCUTIR 10/15] O Google já tem data pra desligar o Gemini 2.5 — decidido: pinar `google-ai-studio` agora, sem esperar a data oficial.** A checagem nas páginas do Google fechou a dúvida das duas datas: 16/10/2026 está confirmado nos release notes do **Vertex**; a página de model-versions cita 20/10 e o Google não resolveu a contradição (planejamos pelo 16). O que decide é outra coisa: a **API pública segue "no shutdown date announced"**, então o pin desacopla a transcrição do prazo do Vertex inteiro. Implementado em #13 (`ROCA_TRANSCRIBE_PROVIDER`, default `google-ai-studio`, `any` desliga), com o canário pingando o tier de transcrição pelo MESMO pin — senão validaria caminho que o produtor não usa. Modelo mantido: `gemini-2.5-flash-lite` seria mais barato em áudio (US$0,30/M vs 1,00) mas ninguém mediu transcrição PT-BR de voz de roça nele; trocar default sem golden de transcrição fica em aberto. [Vertex release notes](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes) · [deprecations da API pública](https://ai.google.dev/gemini-api/docs/deprecations)
- `2026-09-01` **[era DISCUTIR 8/15] O JoIA da CNA — decidido: citar a base pública, e ela ancora uma resposta que saía rasa.** A leitura a fundo confirmou o desenho do concorrente (WhatsApp, gratuito, número (61) 99844-8367, lançado 25/08, rollout na Expointer) e, mais útil, o **status legal da base**: os boletins mensais do Campo Futuro (CNA/Senar; café elaborado pelo CIM/UFLA) trazem impresso "Reprodução permitida desde que citada a fonte". Não é território deles — é fonte pública. Implementado em #13: `api/_lib/tools/custos.ts` detecta pergunta de custo (que não é cotação e caía no caminho `general` sem base nenhuma) e injeta estrutura COE/COT, a citação, e a honestidade de que o número público é da propriedade MODAL da região, não da lavoura dele — com o gancho pro caderno, que é o dado que só a Stevi tem. Nenhum número embutido no código: boletim é mensal. Caso novo no goldenset (`custo-producao-cafe`). Confirmado também que o JoIA é **só reativo** — nenhuma fonte menciona alerta proativo, o que mantém a `bets[1]` de pé. [CNA](https://cnabrasil.org.br/noticias/sistema-cna-senar-leva-joia-projeto-comprador-e-produtos-artesanais-a-expointer) · [boletim Ativos Café](https://www.cnabrasil.org.br/storage/arquivos/icones/Ativos-Cafe-Campo-futuro-Agosto-2024-CNA.pdf)
- `2026-09-01` **[era DISCUTIR 8/15] O estudo da FDC — decidido: citar na CONVERSA, não no template. E o registro de 31/08 estava errado num ponto que mudava a ação.** O título daquele item dizia que o estudo "nomeia, com dirigente e faturamento". Abrindo o PDF: ele **anonimiza** — a Tabela 1 traz perfis (fundação, cidade, nº de associados, faturamento 2024) e o cargo do entrevistado, sem nome de cooperativa nem de dirigente. Dá pra inferir que o perfil de Guaxupé com R$10,7 bi é a Cooxupé, mas isso é inferência nossa, não citação; atribuir número do estudo a uma cooperativa nominal seria inventar fonte. Implementado em #13 com essa trava explícita no prompt da Vitória (`prospect/agent.ts`), junto da munição citável (15 dirigentes de MG, 22 barreiras, recomendação de parceria com startups e IA na interação com o cooperado) e da resposta pronta à objeção de propriedade de dados, que o estudo documenta na voz do cooperado ("eu não vou passar não, porque eu não sei para onde que vai isso"): consentimento LGPD + exclusão a pedido, caso técnico devolvido aos agrônomos da cooperativa, sem venda de dados, contrato escala pro Stefano. O template aprovado `stevi_parceria_coop_v1` **não muda** — bloco de texto em template frio morre no porteiro-robô (medição de 05/ago) e corpo aprovado exige re-submissão à Meta; a citação vive onde há humano lendo. [Zenodo (DOI 10.5281/zenodo.17604355)](https://zenodo.org/records/17604355)
- `2026-09-01` **[achado colateral, virou #15] A rede de resgate era silenciosa — e o alerta de crédito não cobria o caso.** Simulando a queda da chave principal contra a API real (não mock), o OpenRouter devolveu `401 "User not found"`, que **não** é `isCreditError`: a reserva seguraria todo o tráfego sem nenhum alerta, só `log.error` na Vercel, enquanto o saldo do outro projeto escoava. Chave revogada é justamente o cenário de aquisição que motivou a reserva existir. #15 faz as duas camadas de resgate avisarem os fundadores (cooldown de 10 min, `fireAndForget`, texto nomeando camada/modelo/motivo). Não é item de intel — é o que a verificação achou, e fica aqui porque nasceu desta rodada.
- `2026-08-31` **[era DISCUTIR 9/15] Em 30/08 o cron tenta o alerta de vazio de MT sozinho — resolvido por código, não por decisão do Stefano.** No mesmo dia em que o item foi aberto (24/08), `def021c` filtrou `listSojaFarmersByUf`/`listFarmsWithCoords` por `kind='produtor'`, e `7e891f5` completou a cobertura de UF. Medição de 31/08 no banco confirma: a única farm com soja em MT é `kind='teste'` e o filtro a exclui — o cron de 30/08 não vai contaminar `farmer_alerts`. Movido pra cá porque a pergunta original (disparar pra teste ou filtrar antes?) já tem resposta no código, não porque o Stefano decidiu.
