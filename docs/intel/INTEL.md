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

## Em aberto — precisa de decisão do Stefano


### [DISCUTIR 10/15] Você vai à Fecon, de 1 a 3 de setembro?
**Data:** 2026-08-24 · **Eixos:** P3 A2 D1 E1 L3
> **01/09:** a feira começou HOJE e fecha em 03/09. Esta pergunta expira em dois dias — e
> era a única do Arquivo inteiro capaz de gerar coorte com leitura D7 dentro do voo.
> Continua sem decisão registrada.
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

## Fila de trabalho

_vazio — nada passou de PROTOTIPAR/IMPLEMENTAR nesta rodada, pela segunda semana seguida._

A `verdict_note` deste projeto exige que PROTOTIPAR e IMPLEMENTAR ajudem a **conversar com
produtor** ou a **disparar alerta**. Dos oito itens lidos a fundo em 31/08, os quatro que
tocavam de perto o produto eram observação de mercado ou risco de plataforma sem ação de
código exigida agora — nenhum virou spike. O resto era capacidade ou contexto.

**Adendo de 01/09:** os quatro itens de 31/08 foram decididos pelo Stefano no mesmo dia e
viraram código — três PRs mesclados (#13, #14, #15). Estão no Arquivo, cada um com o que
aconteceu. Isso NÃO contradiz a `verdict_note`: ela trava a PROMOÇÃO automática de item que
só adiciona capacidade; nenhum destes subiu sozinho de DISCUTIR. Quem decidiu foi o
fundador, que é exatamente o que a seção "Em aberto" existe para provocar. O registro fica
aqui porque a alternativa — apagar a pergunta depois de respondida — perderia o rastro de
por que o código existe.

## Radar

- `2026-08-31` **CooperRita já tem vendor de IA (Crawly) — e é prospect nomeado do ICP do Stevi.** O iUai, lançado em jan/2026, é chatbot de marca sobre café e queijo regional, não conselho agronômico — mas mostra que uma cooperativa de café do Sul de Minas, dentro do beachhead, já assinou com um fornecedor de IA. Gancho de prospecção, não ameaça de produto. [Itatiaia](https://www.itatiaia.com.br/agro/ia-mineira-cooperativa-lanca-ferramenta-que-entende-de-queijo-e-cafe) · 6/15
- `2026-08-31` **Preço do Claude Sonnet 5 não sobe.** A Anthropic tornou permanente o preço introdutório ($2/$10 por MTok) e cancelou o aumento pra $3/$15 que estava marcado pra 01/09 — custo do modelo de raciocínio da Stevi via OpenRouter fica igual. [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing) · 6/15
- `2026-08-31` **AgriRegion confirma a tese, mas o Stevi já resolveu melhor.** Paper de RAG geoespacial (Carolina do Norte, sem código liberado) valida "conselho agrícola precisa ser regional" — mas o vazio sanitário de SP, o bug real da semana, foi fechado com lookup determinístico de município (`vazioRegiao.ts`), não com retrieval. Generalizar pro método do paper seria trocar solução exata por probabilística sem necessidade. [arXiv](https://arxiv.org/abs/2512.10114) · 5/15
- `2026-08-31` **Farmtech contrata crédito agrícola dentro do WhatsApp da revenda.** "Jornada ao Produtor" formaliza CPR-f digital na mesma conversa que já existe entre revenda e produtor; projeção de R$500-700mi na safra 26/27. Categoria diferente (crédito, não conselho), mas valida de leve a aposta de canal. [AgFeed](https://agfeed.com.br/grande-slam-do-agro/andav/farmtech-aposta-no-whatsapp-para-destravar-a-ultima-milha-do-credito-agro/) · 5/15
- `2026-08-24` **RAG denso desaba em fala de produtor — e a Stevi não usa RAG denso.** Recuperação densa cai a R@10 = 0,093 em pergunta coloquial contra 0,970 em pergunta formal (bengali, 1.000 consultas, 2.882 nós de 284 publicações oficiais); BM25 híbrido lidera com 0,539. A Stevi já busca por **chave**: `extractPestTarget` normaliza a fala em `{cultura, praga}` canônico com o tier barato antes da busca, e `lookupPest` casa por token — zero embeddings no repo inteiro. Fica registrado como razão documentada para **não** trocar o grounding por embeddings. E o goldenset já está em linguagem de roça ("manchas alaranjadas na parte de baixo, tipo um pó"), então não há o que reescrever. [arXiv](https://arxiv.org/abs/2608.14886) · 7/15
- `2026-08-24` **RAImundo (Embrapa/MAPA/MDA/AZap.AI) segue sem sinal público desde out/2025.** Versão definitiva prometida para o 2º semestre de 2025 nunca teve lançamento evidenciado, nenhum número além de 2.900 interações em beta, nenhuma página oficial em embrapa.br ou gov.br. **Descartado pelo gate G3** — o repo já registrou a mesma leitura em 25/jul (`.claude/plans/2026-07-25-curadoria-loop/README.md`), com a ação já decidida (monitorar trimestralmente, não tratar como bloqueador de GTM). A varredura de hoje reforça a conclusão sem alterá-la. · 8/15, descartado por dedup

## Arquivo

- `2026-09-01` **[era DISCUTIR 10/15] A OpenRouter virou parte da Stripe — decidido: diversificar em duas camadas, sem esperar mudança de termos.** O Stefano mandou ir fundo e liberou trocar modelo. Confirmado com as fontes primárias que a aquisição foi anunciada pelas DUAS partes em 19/08 ("same product, same roadmap", closing pendente) — promessa, não contrato. Entraram: fallback direto por chave (`api/_lib/llmDirect.ts`, Anthropic Messages API e endpoint OpenAI-compat do Google AI Studio) em #13, e chave RESERVA do OpenRouter — conta separada, a do projeto twin-me — como camada 1 em #14, já configurada em produção (`OPENROUTER_FALLBACK_API_KEY`) com redeploy feito. O gateway deixou de ser ponto único. [Stripe](https://stripe.com/newsroom/news/stripe-agrees-to-acquire-openrouter) · [OpenRouter](https://openrouter.ai/blog/announcements/openrouter-is-joining-stripe/)
- `2026-09-01` **[era DISCUTIR 10/15] O Google já tem data pra desligar o Gemini 2.5 — decidido: pinar `google-ai-studio` agora, sem esperar a data oficial.** A checagem nas páginas do Google fechou a dúvida das duas datas: 16/10/2026 está confirmado nos release notes do **Vertex**; a página de model-versions cita 20/10 e o Google não resolveu a contradição (planejamos pelo 16). O que decide é outra coisa: a **API pública segue "no shutdown date announced"**, então o pin desacopla a transcrição do prazo do Vertex inteiro. Implementado em #13 (`ROCA_TRANSCRIBE_PROVIDER`, default `google-ai-studio`, `any` desliga), com o canário pingando o tier de transcrição pelo MESMO pin — senão validaria caminho que o produtor não usa. Modelo mantido: `gemini-2.5-flash-lite` seria mais barato em áudio (US$0,30/M vs 1,00) mas ninguém mediu transcrição PT-BR de voz de roça nele; trocar default sem golden de transcrição fica em aberto. [Vertex release notes](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes) · [deprecations da API pública](https://ai.google.dev/gemini-api/docs/deprecations)
- `2026-09-01` **[era DISCUTIR 8/15] O JoIA da CNA — decidido: citar a base pública, e ela ancora uma resposta que saía rasa.** A leitura a fundo confirmou o desenho do concorrente (WhatsApp, gratuito, número (61) 99844-8367, lançado 25/08, rollout na Expointer) e, mais útil, o **status legal da base**: os boletins mensais do Campo Futuro (CNA/Senar; café elaborado pelo CIM/UFLA) trazem impresso "Reprodução permitida desde que citada a fonte". Não é território deles — é fonte pública. Implementado em #13: `api/_lib/tools/custos.ts` detecta pergunta de custo (que não é cotação e caía no caminho `general` sem base nenhuma) e injeta estrutura COE/COT, a citação, e a honestidade de que o número público é da propriedade MODAL da região, não da lavoura dele — com o gancho pro caderno, que é o dado que só a Stevi tem. Nenhum número embutido no código: boletim é mensal. Caso novo no goldenset (`custo-producao-cafe`). Confirmado também que o JoIA é **só reativo** — nenhuma fonte menciona alerta proativo, o que mantém a `bets[1]` de pé. [CNA](https://cnabrasil.org.br/noticias/sistema-cna-senar-leva-joia-projeto-comprador-e-produtos-artesanais-a-expointer) · [boletim Ativos Café](https://www.cnabrasil.org.br/storage/arquivos/icones/Ativos-Cafe-Campo-futuro-Agosto-2024-CNA.pdf)
- `2026-09-01` **[era DISCUTIR 8/15] O estudo da FDC — decidido: citar na CONVERSA, não no template. E o registro de 31/08 estava errado num ponto que mudava a ação.** O título daquele item dizia que o estudo "nomeia, com dirigente e faturamento". Abrindo o PDF: ele **anonimiza** — a Tabela 1 traz perfis (fundação, cidade, nº de associados, faturamento 2024) e o cargo do entrevistado, sem nome de cooperativa nem de dirigente. Dá pra inferir que o perfil de Guaxupé com R$10,7 bi é a Cooxupé, mas isso é inferência nossa, não citação; atribuir número do estudo a uma cooperativa nominal seria inventar fonte. Implementado em #13 com essa trava explícita no prompt da Vitória (`prospect/agent.ts`), junto da munição citável (15 dirigentes de MG, 22 barreiras, recomendação de parceria com startups e IA na interação com o cooperado) e da resposta pronta à objeção de propriedade de dados, que o estudo documenta na voz do cooperado ("eu não vou passar não, porque eu não sei para onde que vai isso"): consentimento LGPD + exclusão a pedido, caso técnico devolvido aos agrônomos da cooperativa, sem venda de dados, contrato escala pro Stefano. O template aprovado `stevi_parceria_coop_v1` **não muda** — bloco de texto em template frio morre no porteiro-robô (medição de 05/ago) e corpo aprovado exige re-submissão à Meta; a citação vive onde há humano lendo. [Zenodo (DOI 10.5281/zenodo.17604355)](https://zenodo.org/records/17604355)
- `2026-09-01` **[achado colateral, virou #15] A rede de resgate era silenciosa — e o alerta de crédito não cobria o caso.** Simulando a queda da chave principal contra a API real (não mock), o OpenRouter devolveu `401 "User not found"`, que **não** é `isCreditError`: a reserva seguraria todo o tráfego sem nenhum alerta, só `log.error` na Vercel, enquanto o saldo do outro projeto escoava. Chave revogada é justamente o cenário de aquisição que motivou a reserva existir. #15 faz as duas camadas de resgate avisarem os fundadores (cooldown de 10 min, `fireAndForget`, texto nomeando camada/modelo/motivo). Não é item de intel — é o que a verificação achou, e fica aqui porque nasceu desta rodada.
- `2026-08-31` **[era DISCUTIR 9/15] Em 30/08 o cron tenta o alerta de vazio de MT sozinho — resolvido por código, não por decisão do Stefano.** No mesmo dia em que o item foi aberto (24/08), `def021c` filtrou `listSojaFarmersByUf`/`listFarmsWithCoords` por `kind='produtor'`, e `7e891f5` completou a cobertura de UF. Medição de 31/08 no banco confirma: a única farm com soja em MT é `kind='teste'` e o filtro a exclui — o cron de 30/08 não vai contaminar `farmer_alerts`. Movido pra cá porque a pergunta original (disparar pra teste ou filtrar antes?) já tem resposta no código, não porque o Stefano decidiu.
