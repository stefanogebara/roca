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

## Em aberto — precisa de decisão do Stefano

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

_vazio — nada passou de PROTOTIPAR/IMPLEMENTAR nesta rodada. Terceira rodada seguida (24/08,
31/08, 07/09) e sexto veredito sem spike na campanha._

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
