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
> **Quinta passada (2026-10-19) — o voo fechou, e isso muda o que "intel relevante"
> significa aqui.** No intervalo desde 07/09 (42 dias), o repositório não recebeu uma
> linha de engenharia: o voo de 60 dias fechou em 11/09 com veredito qualitativo
> MATAR/PIVOTAR (ver `docs/intel/STATE.md` e `.claude/plans/memos-scorecard/README.md`),
> e os únicos 6 commits desde então são memos semanais do PM do Scorecard registrando o
> mesmo silêncio toda semana — zero produtor conversando há 94 dias, zero mensagem de
> qualquer tipo há 19 dias. Feed do resumo matinal veio vazio de novo (mesmo JSON de
> 22/08); cinco scouts trouxeram ~45 candidatos brutos depois de deduplicar, oito foram
> lidos a fundo por um analista cada. **Zero PROTOTIPAR, zero IMPLEMENTAR — sétima
> rodada seguida sem spike**, e nesta rodada isso não é só a `verdict_note` funcionando:
> é que não há mais engenharia ativa para um spike aterrissar. Quatro itens foram
> arquivados por envelhecer sem decisão (>21 dias); dois outros foram superados por
> desenvolvimento real e reabertos com evidência nova: a mudança de cobrança do
> WhatsApp (estava só prevista em 24/08, agora é fato confirmado com tarifa BR) e o App
> do Cacau da UESC (passou de "sem número divulgado" para ">1.000 usuários + parceria
> Wageningen"). Dois itens novos genuínos entraram: um paper com dados reais de produção
> do FarmerChat (Digital Green) medindo exatamente a classe de erro que o código de
> triagem por foto do Stevi replica — mas nunca testada, porque nenhum produtor real
> jamais mandou foto; e uma decisão do Cade que mantém o WhatsApp aberto a chatbots de
> IA de terceiros no Brasil, favorável hoje mas já revertida três vezes em três meses.

## Em aberto — precisa de decisão do Stefano

### [DISCUTIR 12/15] A cobrança do WhatsApp chegou — mas a pergunta mudou de "a conta está fundeada?" para "vale manter fundeada sem tráfego?"
**Data:** 2026-10-19 · **Eixos:** P3 A1 D3 E3 L1
**Fonte primária:** [Meta, WhatsApp Pricing](https://developers.facebook.com/docs/whatsapp/pricing) · [Diário do Comércio, tarifa BR](https://diariodocomercio.com.br/negocios/cobranca-whatsapp-business-outubro/)
**Atualiza:** o item de 24/08 "A partir de 01/10 não sobra caminho gratuito no WhatsApp" (arquivado nesta rodada — a data chegou e o fato se confirmou).

**O que é:** desde 01/10/2026 a Meta cobra por toda *service message* (franquia de
1.000 entregas grátis por número/mês, sem acúmulo) e por toda *utility message*
respondida dentro da janela aberta de 24h — antes grátis desde jul/2025. A divergência
entre páginas da Meta que existia em 24/08 (uma dizia grátis, a outra paga) já não
existe mais: as duas convergem na mesma data. A tarifa de exemplo da própria Meta para
mensagem de utilidade/autenticação (US$0,0068 ≈ R$0,035) bate com o valor publicado
pelo Diário do Comércio para o Brasil.

**Por que toca este projeto:** `alertSendPlan()` em `api/_lib/alerts.ts` só libera
`freeform` se o produtor falou nas últimas 24h — todo alerta proativo real cai em
`template`, que já era pago antes de 01/10. O que passa a custar é o caminho
conversacional (`api/_lib/pipeline.ts`, `adapter.send()` por turno via
`api/_lib/transport/cloud.ts`). Mas o repositório está em pausa pós-mortem desde 11/09
(veredito MATAR/PIVOTAR, ver `docs/intel/STATE.md`): zero mensagem de qualquer tipo há
19 dias, zero produtor conversando há 94. Não há tráfego para a nova tarifa incidir
sobre.

**Por que isso não vira código:** é conferir um dashboard de billing, não mudar uma
linha de `api/_lib/`. Trava em DISCUTIR pela mesma regra de 24/08.

**A pergunta:** a pergunta de 24/08 presumia uma campanha ativa; hoje não há. Dado que
não existe tráfego a proteger agora, vale decidir explicitamente deixar o método de
pagamento da WABA cair (aceitando que uma reativação futura, se houver, vai exigir
reconfigurar billing do zero — e o precedente de #131042 mostra que essa falha já
aconteceu sem aviso) — ou mantém-se fundeada como opcionalidade barata para quando/se a
campanha reabrir? As duas opções têm custo zero hoje, mas "não decidir" também é uma
escolha por omissão, e vale nomear qual.

---

### [DISCUTIR 10/15] O Cade mantém o WhatsApp aberto a chatbots de IA rivais — mas o caso já se reverteu três vezes em três meses
**Data:** 2026-10-19 · **Eixos:** P3 A1 D2 E2 L2
**Fonte:** [CNN Brasil](https://www.cnnbrasil.com.br/economia/negocios/cade-mantem-medida-preventiva-que-obriga-meta-a-permitir-chatbots-de-ia-no-whatsapp/) (corroborado por Canaltech e Olhar Digital)

**O que é:** em 04/03/2026 o Tribunal do Cade negou por unanimidade o recurso da Meta e
manteve a medida preventiva que suspende novos termos de uso do WhatsApp Business que
excluiriam chatbots de IA de terceiros (denúncia das startups Luzia e Zapia contra
favorecimento à Meta AI). O caso já reverteu três vezes em três meses: liminar judicial
suspendeu a medida em jan/2026, outra decisão a restabeleceu em mar/2026, a Meta tentou
cobrar ~US$0,0625 por "mensagem não padronizada" de tráfego de IA a partir de 11/3, o
Cade aplicou multa diária de R$250 mil por descumprimento, e em 29-30/4/2026 a Justiça
Federal de SP suspendeu essa multa e determinou conciliação. Busca ativa por
desenvolvimento de mai-out/2026 não encontrou nada além disso — o inquérito de mérito
(abuso de posição dominante, processo 08700.012397/2025-63) segue sem decisão até onde
esta rodada alcançou.

**Por que toca este projeto:** é a mesma dependência de plataforma única do produto —
`api/_lib/transport/cloud.ts`, o cliente do Graph API que a Stevi usa como transporte
ativo. Hoje o efeito é protetor (mantém acesso livre a chatbots de terceiros), não uma
ameaça concretizada — mas nenhuma fonte testa a pergunta que importa: se os termos
restritivos da Meta fossem reinstaurados, eles atingiriam um bot de nicho agronômico
como a Stevi, ou só "assistentes de IA generalistas" que competem de frente com a Meta
AI (como Luzia e Zapia)? Isso nunca é discutido nas fontes.

**A pergunta:** vale só monitorar passivamente o desfecho do inquérito (sem data
prevista), ou já é hora de confirmar que `api/_lib/transport/twilio.ts` (hoje
legado/rollback) ainda sobe como transporte de emergência, caso a Meta volte a cobrar
por mensagem de IA ou bloquear chatbots de terceiros antes da decisão de mérito?

---

### [DISCUTIR 9/15] FarmerChat (Digital Green) mediu em produção o exato padrão de erro que o código de visão da Stevi replica — mas nunca testado, porque nunca chegou foto real
**Data:** 2026-10-19 · **Eixos:** P2 A2 D1 E2 L1
**Fonte:** [arXiv 2609.21651](https://arxiv.org/abs/2609.21651) (v2, 2026-09-21)

**O que é:** o paper analisa 1,16M fotos reais enviadas ao FarmerChat (Digital Green) em
produção na Etiópia, Índia, Quênia e Nigéria: 46,8% das fotos são rejeitadas por um gate
de qualidade; >25% das que passam voltam sem cultura identificada; e 35,8% dos rótulos
"doença" eram, na verdade, praga. Uma rota especialista em três estágios (gate de
qualidade MobileNetV3, classificador de cultura DaViT, detector YOLO26) chega a 95,41%
de acurácia de cultura contra 91,46% da rota única de produção (VLM fine-tunado).

**Por que toca este projeto:** `identifyFromPhoto` em `api/_lib/reason.ts` devolve
praga/doença num campo só, sem separar categoria, e `api/_lib/pipeline.ts` só valida
tamanho de arquivo da foto (`MEDIA_BASE64_CAP`), não qualidade ou relevância — a mesma
classe de erro que o FarmerChat mediu existe estruturalmente no código. Mas nenhum
produtor real jamais mandou uma foto documentada ao Stevi (nem o único externo, Gaia
Tech) — é gargalo teórico, não observado. O projeto está em pausa pós-mortem desde
11/09, sem engenharia ativa (`.claude/plans/memos-scorecard/README.md`).

**A pergunta:** vale separar os campos praga/doença e endurecer o retry de baixa
confiança como ajuste de prompt barato agora, mesmo sem dado de campo pra validar — ou
isso é exatamente o padrão "capacidade sem onde aterrissar" que o tripwire do projeto
existe pra bloquear, e deve esperar sinal real de produtor com foto?

---

### [DISCUTIR 9/15] O lookup determinístico da Stevi já mitiga o que um paper novo testa — mas erro de digitação dentro do token continua sem cobertura
**Data:** 2026-10-19 · **Eixos:** P2 A2 D2 E2 L1
**Fonte:** [arXiv 2610.08205](https://arxiv.org/abs/2610.08205) (2026-10-06)

**O que é:** o paper compara tool-calling (busca literal por chave) com vector RAG numa
base agrícola grega/inglesa de 198 perguntas: 71,6% vs. 95,3% em grego canônico; sem
normalização de acento/maiúscula o tool-calling cai ~20pp (RAG só até 2pp); grego em
script latino ("Greeklish") custa 21-32pp a ambos; com busca insensível a acento +
stemming o tool-calling sobe a 83,8%.

**Por que toca este projeto:** é o ângulo inverso do paper já registrado em 24/08 (RAG
denso falha em fala coloquial — decisão: não trocar por embeddings). Lendo o código
real: `lookupPest` em `api/_lib/tools/agrofit.ts` já faz exatamente a mitigação que o
paper testa como ablation (accent-insensitive + stemmed-token matching via `strip()` e
`matchNorm()`), e `extractPestTarget` não é parser literal — é uma chamada de LLM
(`api/_lib/reason.ts:44`) que já absorve abreviação e registro antes do lookup
determinístico. O gap residual real é erro de digitação tipo teclado dentro do próprio
token (ex. "catucho" por "cartucho"), que nenhuma dessas camadas cobre.

**A pergunta:** dado que o voo fechou em MATAR/PIVOTAR e não há produtor conversando há
mais de 90 dias (sem tráfego pra validar se isso resolve algo vivido), vale gastar um
spike de 2-4h adicionando fuzzy-match por edit-distance a `lookupPest` agora, ou isso
espera uma eventual decisão de retomada?

---

### [DISCUTIR 9/15] O App do Cacau (UESC) passa de 1.000 usuários — a tração do modelo "universidade financiada, grátis pra sempre" deixou de ser hipótese
**Data:** 2026-10-19 · **Eixos:** P3 A1 D2 E1 L2
**Fonte:** [Movimento Econômico](https://movimentoeconomico.com.br/agronegocio/2026/09/15/universidade-baiana-cria-app-com-ia-para-detectar-doencas-e-pragas-do-cacau/) (15/09/2026)
**Atualiza:** o item de 07/09 "Um projeto universitário gratuito já roda o mesmo
mecanismo do Stevi — em cacau" (arquivado nesta rodada; mesma pergunta, evidência nova).

**O que é:** a leitura de 07/09 registrava o mecanismo (UESC, WhatsApp, triagem
multimodal sem dose, Instituto Arapyaú financiando) sem número de usuários divulgado. A
fonte nova traz dois dados novos, autodeclarados pela própria UESC em entrevista à
imprensa, sem metodologia revelada: **mais de 1.000 usuários** e parceria formal com a
**Universidade de Wageningen** (Holanda) no modelo de identificação por imagem.

**Por que toca este projeto:** não resolve a pergunta original — a matéria não cita
café, EPAMIG nem Embrapa, só fala em expansão para "outras regiões produtoras de
cacau". Mas aumenta a urgência dela: >1.000 usuários grátis é evidência real de que o
modelo "universidade financiada, grátis pra sempre" consegue tração de campo — não é
mais só uma hipótese institucional sem prova de adoção.

**A pergunta:** a mesma de 07/09, agora com peso maior — vale checar se algum programa
estadual, EPAMIG ou a própria Embrapa tem um movimento equivalente nascendo para café?
O projeto está em pausa pós-mortem desde 11/09, então isso é só posicionamento pra
arquivar, ou motivo suficiente pra reabrir, antes de qualquer pivot, a pergunta de como
monetizar se esse padrão chegar ao café?

---

## Fila de trabalho

_vazio — nada passou de PROTOTIPAR/IMPLEMENTAR nesta rodada. Sétima rodada seguida sem
spike na campanha (24/08, 31/08, 01/09, 07/09, e agora 19/10 depois do fechamento do voo)._

A `verdict_note` deste projeto exige que PROTOTIPAR e IMPLEMENTAR ajudem a **conversar com
produtor** ou a **disparar alerta**. Dos oito itens lidos a fundo em 19/10, o item de maior
score (cobrança do WhatsApp, 12/15) bateria PROTOTIPAR pelo score bruto — mas a única ação
possível é checar billing fora do repositório, não mudar código, então trava em DISCUTIR
por regra explícita. Os outros quatro DISCUTIR (Cade, FarmerChat, App do Cacau, tool-calling
vs. RAG) são leitura de mercado/paper, não spike de produto pronto para rodar. Nesta rodada
isso importa mais que nunca: o voo fechou em 11/09 com veredito MATAR/PIVOTAR e, desde
então, 42 dias e zero linha de engenharia (ver `STATE.md`) — não há mais campanha ativa para
um spike de código aterrissar em.

**Adendo de 01/09:** os quatro itens de 31/08 foram decididos pelo Stefano no mesmo dia e
viraram código — três PRs mesclados (#13, #14, #15). Estão no Arquivo, cada um com o que
aconteceu. Isso NÃO contradiz a `verdict_note`: ela trava a PROMOÇÃO automática de item que
só adiciona capacidade; nenhum destes subiu sozinho de DISCUTIR. Quem decidiu foi o
fundador, que é exatamente o que a seção "Em aberto" existe para provocar. O registro fica
aqui porque a alternativa — apagar a pergunta depois de respondida — perderia o rastro de
por que o código existe.

## Radar

- `2026-10-19` **Vertex aposentou Gemini 2.5 em 16/10 — a API pública que a Stevi usa não foi tocada, o pin de 01/09 estava certo.** Release notes oficiais do Vertex confirmam 16/10/2026 como data de retirement de Gemini 2.5 Pro/Flash/Flash-Lite nessa plataforma; o changelog oficial da Gemini Developer API (18/09) diz que os mesmos modelos na API pública "are not deprecated and will continue to be served until further notice". Confirmado no código (`api/_lib/env.ts`, `api/_lib/llmDirect.ts`): o Stevi só chama `generativelanguage.googleapis.com` (AI Studio), nunca Vertex. Zero arquivo muda. [Vertex release notes](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes) · [Gemini API changelog](https://ai.google.dev/gemini-api/docs/changelog) · 7/15
- `2026-10-19` **Paper mostra vazamento de identidade de sessão em dataset de doença de folha — alerta metodológico, não ação.** Em dois datasets coreanos, 91,9% das imagens de teste têm duplicata exata de sensor/sessão no treino; um classificador que só lê timestamp empata com modelos multimodais de imagem+sensor. Relevante como lembrete para qualquer avaliação futura de modelo de visão do Stevi (hoje não treina nenhum), não para o grounding por chave já em produção. [arXiv](https://arxiv.org/abs/2610.06369) · 5/15
- `2026-10-19` **InteliAgro (BR) diz ter captado US$8M de Série A — mas nem a empresa nem os investidores citados aparecem em qualquer outra fonte.** Plataforma de analytics preditivo (solo/clima) para produtor de médio porte na América Latina — segmento e canal (dashboard, não WhatsApp) diferentes do beachhead do Stevi; fonte única (af.net), sem corroboração, tratar com ceticismo. [af.net](https://af.net/realtime/brazilian-ai-startup-inteliagro-raises-8-million-to-advance-agricultural-productivity/) · 5/15
- `2026-10-19` **"Theo", assistente da Nestlé por WhatsApp pra cacauicultor, triplicou de usuários entre 2023 e abril/2025.** Dicas de preço, cultivo e clima via WhatsApp para cacauicultor — mesmo canal, cultura perene adjacente (cacau, não café), crescimento de 1.862 para 7.172 usuários num relato de 2025. Novo no radar deste projeto (não estava entre os concorrentes já triados), mas sem desenvolvimento nesta janela — é descoberta de concorrente antigo, não notícia da semana. [Canal Rural](https://www.canalrural.com.br/agricultura/cresce-em-300-o-uso-de-assistente-virtual-que-da-dicas-de-preco-e-cultivo-de-cacau/) · 5/15
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

- `2026-10-19` **[era DISCUTIR 10/15] "A partir de 01/10 não sobra caminho gratuito" — a data chegou, o fato se confirmou, superado por desenvolvimento.** Não é arquivamento por idade: a mudança de cobrança do WhatsApp que em 24/08 era só previsão virou fato em 01/10, com tarifa BR confirmada. Pergunta atualizada reaberta em "Em aberto" (19/10) com o contexto novo: não há mais tráfego para a tarifa incidir sobre, já que o projeto fechou em MATAR/PIVOTAR.
- `2026-10-19` **[era DISCUTIR 9/15] "Um projeto universitário gratuito já roda o mesmo mecanismo — em cacau" — superado por desenvolvimento, não por idade.** A leitura de 07/09 não tinha número de usuários; a de 19/10 confirma >1.000 e parceria com Wageningen. Pergunta original (café/EPAMIG/Embrapa) continua sem resposta — reaberta em "Em aberto" (19/10) com a evidência nova.
- `2026-10-19` **[era DISCUTIR 11/15] Prompt logging na OpenRouter — envelheceu sem decisão.** Aberto em 07/09, 42 dias sem confirmação de nenhuma das duas contas (principal e `OPENROUTER_FALLBACK_API_KEY`). Nenhum scout desta rodada tocou o tema de novo. Se a configuração nunca mudou (o padrão é desligado), o risco provavelmente já estava mitigado — mas isso nunca foi confirmado em voz alta.
- `2026-10-19` **[era DISCUTIR 8/15] Café 360 Premium — envelheceu sem decisão.** Aberto em 07/09 como evidência de campo a favor de `bets[0]` (apps de agro falham mesmo com IA embutida e cobertura idêntica). Ninguém decidiu se vale citar no README de posicionamento; sem desenvolvimento novo nesta rodada.
- `2026-10-19` **[era DISCUTIR 10/15] "O primeiro alerta sai às 08:00 para todo mundo?" — envelheceu sem decisão.** Aberto em 24/08 (56 dias), sem produtor real para aprender horário de leitura e sem decisão do Stefano sobre horário único vs. argumentado por tipo de alerta. Continua teoricamente correto, mas o projeto está em pausa pós-mortem (zero produtor conversando) — não há como testar isso agora, e não há sinal de que vá haver em breve.
- `2026-09-07` **[era DISCUTIR 10/15] A Fecon aconteceu 1–3/09 — e gerou zero cadastros, apesar do kit pronto.** O kit (`64152d6`) e a regra de vouch (`527120b`, token `#fecon` vs. `#fecon-cartaz`) foram shipados dias antes da feira. Medição de 07/09 no banco: `users.source ilike '%fecon%'` retorna **zero linhas**; só 1 usuário novo entrou no banco desde 31/08 (`kind='empresa'`, não produtor). O repositório não registra se o Stefano foi e não usou o kit, ou não foi — mas o resultado é o mesmo: a única janela de campo dentro do voo de 60 dias não converteu ninguém. Movido pro Arquivo como resultado, não como decisão pendente — a pergunta original ("você vai?") não faz mais sentido perguntar, a janela fechou.
- `2026-09-01` **[era DISCUTIR 10/15] A OpenRouter virou parte da Stripe — decidido: diversificar em duas camadas, sem esperar mudança de termos.** O Stefano mandou ir fundo e liberou trocar modelo. Confirmado com as fontes primárias que a aquisição foi anunciada pelas DUAS partes em 19/08 ("same product, same roadmap", closing pendente) — promessa, não contrato. Entraram: fallback direto por chave (`api/_lib/llmDirect.ts`, Anthropic Messages API e endpoint OpenAI-compat do Google AI Studio) em #13, e chave RESERVA do OpenRouter — conta separada, a do projeto twin-me — como camada 1 em #14, já configurada em produção (`OPENROUTER_FALLBACK_API_KEY`) com redeploy feito. O gateway deixou de ser ponto único. [Stripe](https://stripe.com/newsroom/news/stripe-agrees-to-acquire-openrouter) · [OpenRouter](https://openrouter.ai/blog/announcements/openrouter-is-joining-stripe/)
- `2026-09-01` **[era DISCUTIR 10/15] O Google já tem data pra desligar o Gemini 2.5 — decidido: pinar `google-ai-studio` agora, sem esperar a data oficial.** A checagem nas páginas do Google fechou a dúvida das duas datas: 16/10/2026 está confirmado nos release notes do **Vertex**; a página de model-versions cita 20/10 e o Google não resolveu a contradição (planejamos pelo 16). O que decide é outra coisa: a **API pública segue "no shutdown date announced"**, então o pin desacopla a transcrição do prazo do Vertex inteiro. Implementado em #13 (`ROCA_TRANSCRIBE_PROVIDER`, default `google-ai-studio`, `any` desliga), com o canário pingando o tier de transcrição pelo MESMO pin — senão validaria caminho que o produtor não usa. Modelo mantido: `gemini-2.5-flash-lite` seria mais barato em áudio (US$0,30/M vs 1,00) mas ninguém mediu transcrição PT-BR de voz de roça nele; trocar default sem golden de transcrição fica em aberto. [Vertex release notes](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes) · [deprecations da API pública](https://ai.google.dev/gemini-api/docs/deprecations)
- `2026-09-01` **[era DISCUTIR 8/15] O JoIA da CNA — decidido: citar a base pública, e ela ancora uma resposta que saía rasa.** A leitura a fundo confirmou o desenho do concorrente (WhatsApp, gratuito, número (61) 99844-8367, lançado 25/08, rollout na Expointer) e, mais útil, o **status legal da base**: os boletins mensais do Campo Futuro (CNA/Senar; café elaborado pelo CIM/UFLA) trazem impresso "Reprodução permitida desde que citada a fonte". Não é território deles — é fonte pública. Implementado em #13: `api/_lib/tools/custos.ts` detecta pergunta de custo (que não é cotação e caía no caminho `general` sem base nenhuma) e injeta estrutura COE/COT, a citação, e a honestidade de que o número público é da propriedade MODAL da região, não da lavoura dele — com o gancho pro caderno, que é o dado que só a Stevi tem. Nenhum número embutido no código: boletim é mensal. Caso novo no goldenset (`custo-producao-cafe`). Confirmado também que o JoIA é **só reativo** — nenhuma fonte menciona alerta proativo, o que mantém a `bets[1]` de pé. [CNA](https://cnabrasil.org.br/noticias/sistema-cna-senar-leva-joia-projeto-comprador-e-produtos-artesanais-a-expointer) · [boletim Ativos Café](https://www.cnabrasil.org.br/storage/arquivos/icones/Ativos-Cafe-Campo-futuro-Agosto-2024-CNA.pdf)
- `2026-09-01` **[era DISCUTIR 8/15] O estudo da FDC — decidido: citar na CONVERSA, não no template. E o registro de 31/08 estava errado num ponto que mudava a ação.** O título daquele item dizia que o estudo "nomeia, com dirigente e faturamento". Abrindo o PDF: ele **anonimiza** — a Tabela 1 traz perfis (fundação, cidade, nº de associados, faturamento 2024) e o cargo do entrevistado, sem nome de cooperativa nem de dirigente. Dá pra inferir que o perfil de Guaxupé com R$10,7 bi é a Cooxupé, mas isso é inferência nossa, não citação; atribuir número do estudo a uma cooperativa nominal seria inventar fonte. Implementado em #13 com essa trava explícita no prompt da Vitória (`prospect/agent.ts`), junto da munição citável (15 dirigentes de MG, 22 barreiras, recomendação de parceria com startups e IA na interação com o cooperado) e da resposta pronta à objeção de propriedade de dados, que o estudo documenta na voz do cooperado ("eu não vou passar não, porque eu não sei para onde que vai isso"): consentimento LGPD + exclusão a pedido, caso técnico devolvido aos agrônomos da cooperativa, sem venda de dados, contrato escala pro Stefano. O template aprovado `stevi_parceria_coop_v1` **não muda** — bloco de texto em template frio morre no porteiro-robô (medição de 05/ago) e corpo aprovado exige re-submissão à Meta; a citação vive onde há humano lendo. [Zenodo (DOI 10.5281/zenodo.17604355)](https://zenodo.org/records/17604355)
- `2026-09-01` **[achado colateral, virou #15] A rede de resgate era silenciosa — e o alerta de crédito não cobria o caso.** Simulando a queda da chave principal contra a API real (não mock), o OpenRouter devolveu `401 "User not found"`, que **não** é `isCreditError`: a reserva seguraria todo o tráfego sem nenhum alerta, só `log.error` na Vercel, enquanto o saldo do outro projeto escoava. Chave revogada é justamente o cenário de aquisição que motivou a reserva existir. #15 faz as duas camadas de resgate avisarem os fundadores (cooldown de 10 min, `fireAndForget`, texto nomeando camada/modelo/motivo). Não é item de intel — é o que a verificação achou, e fica aqui porque nasceu desta rodada.
- `2026-08-31` **[era DISCUTIR 9/15] Em 30/08 o cron tenta o alerta de vazio de MT sozinho — resolvido por código, não por decisão do Stefano.** No mesmo dia em que o item foi aberto (24/08), `def021c` filtrou `listSojaFarmersByUf`/`listFarmsWithCoords` por `kind='produtor'`, e `7e891f5` completou a cobertura de UF. Medição de 31/08 no banco confirma: a única farm com soja em MT é `kind='teste'` e o filtro a exclui — o cron de 30/08 não vai contaminar `farmer_alerts`. Movido pra cá porque a pergunta original (disparar pra teste ou filtrar antes?) já tem resposta no código, não porque o Stefano decidiu.
