# Loop de Curadoria do Stevi — retro-audit, desenho e estado (25/jul/2026)

Este doc é a CASA do loop: retro-audit do que foi feito, regras do loop,
backlog por área (semeado pelas notas da auditoria) e log de iterações
(append no fim). O loop atualiza este arquivo a cada iteração.

---

## Retro-audit brutal do dia 25/jul (o que foi feito vs o que vale)

**Feito hoje:** auditoria 13-agentes (~120 findings) · roadmap + AGENTS.md ·
baseline de tração · post-mortem draft do dispatch · 4 agentes Fase 0 · fix do
PRICE_INTENT portado pro master (PR #1 fechado) · e-mail de lead quente no
primeiro reply de prospect (código + testes, deployado) · correção da narrativa
das "5 referrals" (eram teste interno) + lição registrada.

**Crítica honesta, sem poupar o próprio trabalho:**

1. **~90% do output do dia é meta-trabalho** (análise, planos, agentes,
   processo). Só 2 itens tocam o produto que um usuário sente: o fix do
   PRICE_INTENT e o e-mail de lead quente. Nenhum produtor novo foi tocado.
   Pelo tripwire do flight-plan, hoje foram ~6 commits × 0 conversas — o dia
   foi ÚTIL (a empresa não sabia sua própria tração), mas não pode se repetir
   em série: análise tem retorno decrescente rápido.
2. **O baseline que eu mesmo publiquei de manhã estava errado à tarde** — as
   "5 referrals orgânicas" eram teste do founder/simulador. Peguei em horas
   porque verifiquei identidade; mas o erro mostra que até "query fresca" é
   insuficiente sem decompor QUEM (lição registrada no lessons.md).
3. **A verdade nua que sobrou:** 1 usuário externo real na vida do produto
   (Gaia Tech, vouchado pelo Michel, 1 msg, sem retorno), 0 pedidos orgânicos
   de agrônomo, 0 replies em 29 envios de prospecção, funil pausado. O gargalo
   NÃO é conhecimento, é AQUISIÇÃO VOUCHADA — e isso é humano (kit do técnico,
   Michel, armazém), não código nem pesquisa.
4. **Dependências humanas continuam paradas** (nenhuma engenharia resolve):
   memo tese/beachhead · código de erro de 21/jul no Business Manager ·
   CNPJ · acordo escrito com Michel + assinatura do golden set · env
   `FOUNDER_NOTIFY_TO` na Vercel · follow-up no Gaia Tech.
5. **Risco do próprio loop:** um loop de pesquisa pode virar máquina de gerar
   papel que ninguém lê. Mitigação: toda iteração termina em ARTEFATO USÁVEL
   NO CAMPO (mensagem pronta, lista de alvos, script de conversa, correção
   proposta com diff) — nunca em "relatório de tendências" solto.

**Próximo passo (em uma frase):** transformar pesquisa em munição de campo —
scripts, alvos e treino da Vitória — enquanto os founders destravam as 6
dependências humanas acima.

---

## Desenho do loop

**Cadência:** self-paced (~45-90 min por iteração enquanto a sessão viver;
o usuário interrompe quando quiser — "para o loop" encerra).

**Cada iteração:**
1. **Lead-quente check** (SQL fresco, 1 min): prospect replied? referral real
   nova? usuário real novo/dormindo? → Se lead REAL: rascunho de e-mail no
   Gmail (para stefanogebara@gmail.com + vitoriafcardozo@gmail.com) + destaque
   no relatório. (Automático em prod: notify.ts já e-maila no reply — exige
   `FOUNDER_NOTIFY_TO` setado na Vercel.)
2. **Uma área por vez** (rotação ponderada abaixo): spawn do agente
   pesquisador da área → pesquisa web (WebSearch/WebFetch; browser/Playwright
   para andar dentro de plataformas concorrentes) → 3-7 propostas ACIONÁVEIS
   com fonte e data.
3. **Atualizar este doc**: propostas entram no backlog da área; log de
   iteração no fim.
4. **QA de deploy** (quando houve push desde a última iteração): passada de
   browser na landing//verificar/painel.

**Rotação ponderada** — peso = (10 − nota da auditoria) × ênfase do usuário
(prospecção/Vitória ×2 por pedido explícito):

| Ordem | Área | Nota | Peso | Agente |
|---|---|---|---|---|
| 1 | Prospecção & Vitória (conversação) | 4.5 | 11.0 | stevi-pesquisa-prospeccao |
| 2 | Estratégia & GTM | 4.5 | 5.5 | stevi-pesquisa-mercado |
| 3 | APIs & dados agro | 5.5 | 4.5 | stevi-pesquisa-infra-apis |
| 4 | Loops de aprendizado | 5.5 | 4.5 | (coberto por prospecção/produto) |
| 5 | Produto & CX | 6.0 | 4.0 | stevi-pesquisa-produto-cx |
| 6 | Cards & UI | 6.0 | 4.0 | stevi-pesquisa-design-ui |
| 7 | Dados & moat | 6.5 | 3.5 | stevi-pesquisa-dados-moat |

**Guard-rails do loop (invioláveis):**
- Propostas, nunca aplicação: código só com aprovação explícita do usuário.
- Banco de produção: SELECT apenas; PII mascarada em qualquer relatório.
- E-mail: só RASCUNHO no Gmail (founder envia), e só para lead REAL — nunca
  para "descobertas interessantes".
- Tripwire-aware: o loop produz munição de campo, não desculpa para não ir a
  campo. Se 3 iterações seguidas não geraram nada USADO pelos founders, o
  loop reduz cadência e diz isso em voz alta.
- Toda afirmação de tendência/plataforma com FONTE e DATA.

---

## Backlog por área (semeado 25/jul; o loop appenda `[data] proposta — fonte`)

### 1. Prospecção & Vitória (4.5) — PRIORIDADE
- [seed] Currículo de treino da Vitória: `.claude/plans/2026-07-25-vitoria-treino/README.md`.
- [seed] Religada bloqueada pelos gates do post-mortem (código de erro 21/jul).
- [seed] Pesquisar: benchmarks de cold outreach B2B agro no Brasil; alternativas de canal (grupos de WhatsApp de coop, sindicatos, EMATER, feiras); o que muda com número +55 verificado.
- [seed] 0 replies/29 envios: revisar copy dos templates contra exemplos vencedores de outbound BR.
- [25/jul] **H1 validada em fonte primária (erro 131049 / per-user marketing limits).** A Meta documenta limite dinâmico por DESTINATÁRIO para templates MARKETING, agregado entre todas as empresas que mensageiam o usuário, calibrado pelo read-rate de marketing dele; a mensagem é aceita na API e bloqueada na entrega (assinatura idêntica a 21/jul), só MARKETING é afetado (utility/auth não), e mensagens dentro da janela de 24h pós-resposta NÃO contam no cap. Brasil está no escopo (excluídos: EEA, UK, Japão, Coreia). Como fechar: Gate 1 do post-mortem — ler o error code de 21/jul no WhatsApp Manager (15 min, founder). — developers.facebook.com "Per-user marketing template message limits" + "Error codes" (acessados 25/jul/2026)
- [25/jul] **Sub-hipótese nova H1b: erro 130497 — restrição cross-border Brasil/Indonésia (desde 15/set/2025).** Fontes secundárias relatam que WABA registrado fora do Brasil não entrega para +55 ("Business account is restricted from messaging users in this country"), sem workaround além de número/WABA local. NÃO achei página primária da Meta — tratar como não-confirmada. Se o error code de 21/jul for 130497 (e não 131049), cold-WA do número +1 morreu por política, não por copy. As duas hipóteses convergem na mesma ação: número +55. Risco: fontes são vendors. — vmoscloud.com/blog/whatsapp-error-130497 (nov/2025); help.gohighlevel.com art. 155000007285
- [25/jul] **Número +55 + verificação de negócio: processo e custo mapeados.** Portfólio NÃO-verificado pode ter até 2 números (temos 1 → um +55 cabe no mesmo WABA hoje): WhatsApp Manager → adicionar número → OTP SMS/voz; custo = só o chip/número virtual (~R$20-50), Meta não cobra. Verificação de negócio é GRATUITA, sobe o tier de 250→2.000 destinatários únicos/24h e o cap de números de 2→20 — bloqueada só pelo CNPJ (dependência humana já listada). Segundo número também isola risco de ban (Gate 3 do post-mortem). — developers.facebook.com "Messaging limits" + "Business phone numbers" (25/jul/2026)
- [25/jul] **Estratégia reply-first no 1º toque.** O objetivo do template frio deve ser RESPOSTA, não call: resposta abre a janela de 24h onde a conversa é livre e não conta no per-user cap. Pitch direto em mensagem fria: <5% de resposta; pergunta provocativa 20-35%; dado de mercado 25-40%; indicação nominal 40-60% (framework mais forte — pedir ao Michel 3 intros nomeadas antes de religar). Guard-rail: NÃO disfarçar marketing de UTILITY — a Meta recategoriza/rejeita e o risco é o número. — koee.com.br "Como abordar lead frio no WhatsApp" (2026); developers.facebook.com per-user limits
- [25/jul] **Reescrita dos templates (texto pronto, aguarda ok do founder).** Teardown: v2 e coop_v1 são pitch completo + pedido de reunião no 1º toque (anti-padrão <5%), personalização genérica ("atendem produtores no dia a dia"), sem disclosure de IA (habilidade #1 do currículo). Proposta `stevi_parceria_v3` (2 params): "Oi, {{1}}! Sou a Vitória, assistente digital da equipe da Stevi 🌱 Pergunta rápida: quando um cafeicultor da região de {{2}} precisa de receituário e não tem agrônomo por perto, ele chega até vocês como? Pergunto porque a gente recebe esses pedidos no WhatsApp e queria saber se faz sentido indicar vocês." Proposta `stevi_parceria_coop_v2` (2 params): "Oi, {{1}}! Sou a Vitória, assistente digital da Stevi 🌱 A gente atende cafeicultores no WhatsApp e devolve o caso técnico organizado pro time da {{2}} — não substitui ninguém. Posso te mandar um exemplo real de caso pra você avaliar?" Ambos mantêm footer SAIR; ≤3 linhas; 1 pergunta; CTA de micro-compromisso. — koee.com.br (regra das 6 linhas + frameworks); socialhub.pro "Cold message B2B: 12 templates" (2025-2026)
- [25/jul] **Canal vouchado #1 — Coocafé (Lajinha-MG, 11 mil+ cooperados).** Unidades exatamente no nosso mapa: Manhuaçu, Espera Feliz, Manhumirim, Durandé, Mutum, Ipanema (MG) + Iúna, Ibatiba, Irupi, Brejetuba (ES); faz assistência técnica e dias de campo. Passo 1: visita presencial do founder à unidade de Manhuaçu ou Espera Feliz pedindo 15 min com o responsável técnico — pitch de distribuição (dossiê devolve o produtor pro técnico da coop). Custo: deslocamento. — portal.ocbes.coop.br (perfil Coocafé); portalcaparao.com.br (jul/2026)
- [25/jul] **Canal vouchado #2 — sindicatos rurais (ATeG Café+Forte) e EMATER-MG, custo zero.** Os técnicos do ATeG Café+Forte (Sistema FAEMG/Senar) em Manhuaçu e Espera Feliz são o ICP agronomo/consultoria, já pagos para atender produtores — a Stevi alimenta o técnico, não compete. Passo 1a: DM no @spr.esperafeliz (Instagram do Sindicato dos Produtores Rurais de Espera Feliz) pedindo o contato do mobilizador do ATeG. Passo 1b: localizar o escritório local da EMATER-MG do município-alvo no diretório oficial (emater.mg.gov.br → Escritórios Locais) e agendar demo com o extensionista de cafeicultura (precedente: startup Algrano entrou via escritório local). Bônus de credibilidade: Simpósio de Cafeicultura das Matas de Minas (Manhuaçu, anual, FAEMG) e chamada Avança Café da Embrapa (a CertifiCafé saiu dela com a Cooxupé como cliente). — revistacafeicultura.com.br + sistemafaemg.org.br; emater.mg.gov.br; agenciaminas.mg.gov.br; embrapa.br (AgriMatching 2025)

### 2. Estratégia & GTM (4.5)
- [seed] Memo tese/beachhead ABERTO (founders). Pesquisa de apoio: pricing On Agri hoje, evolução do RAImundo, novos bots agro-WA desde 16/jul.
- [seed] Canais nunca avaliados: EMATER/ATER, revendas como distribuição, rádio rural.
- [25/jul] **On Agri: preço mantido (R$147,90 Start), mas o delta é o CANAL — parceria Clube Broto (Banco do Brasil), anunciada 27/fev/2026.** Planos atuais: Start R$147,90/mês até 1.000 ha · Basic R$297,90 · Advanced R$497,90 — a régua "até 1.000 ha" confirma que a On Agri mira produtor grande, não 5-50 ha. Assinantes do Clube Broto (R$14,90/mês, clube de benefícios do BB com meta de 100 mil produtores) acessam o "engenheiro agrônomo digital" da On Agri via cadastro simples (grau de inclusão vs desconto não divulgado — verificar). Implicação pro memo: a âncora de preço direto-ao-produtor desabou de R$147 para R$14,90-via-clube; "assinatura vendida ao produtor abaixo de R$147" ficou muito mais fraca como tese — se houver assinatura, o comprador natural é agrônomo/coop/clube, não o produtor. Ação: memo trata bundle B2B2C (clube/coop) como o comparável real de pricing. — onagri.com.br (acessado 25/jul/2026); noticias.broto.com.br "Consultoria agronômica por WhatsApp" (27/fev/2026); club.broto.com.br + theagribiz.com (R$14,90/mês, meta 100 mil)
- [25/jul] **RAImundo: NENHUMA tração pública nova desde jul/2025 — sinal fraco de estagnação.** Últimos números públicos: 2.900 interações em beta (Band, 18/jul/2025); versão definitiva/freemium prometida para o 2º semestre/2025 sem qualquer evidência pública de lançamento; meta de 100 mil usuários/ano-1 sem confirmação; investimento AZap.AI modesto (R$100 mil + até R$500 mil). Buscas de 25/jul/2026 não acharam balanço 2026. Delta vs 16/jul: a linha de base tratava RAImundo como ameaça "grátis do governo"; hoje a evidência sugere projeto sub-capitalizado e sem momentum público — mas ausência de notícia não é prova (marcar como sinal fraco, 1 rodada de fontes). Ação: memo não deve tratar RAImundo como bloqueador de GTM; monitorar trimestralmente. — band.com.br (18/jul/2025); revistarpanews.com.br + portal.agrosummit.com.br (mai/2025); buscas 25/jul/2026 sem resultados novos
- [25/jul] **Entrante novo desde a linha de base: Aegrozap (Aegro), lançado 19/mar/2026 — captura conversacional de registros por voz/texto no WhatsApp.** Faz exatamente o conceito do nosso caderno (áudio → registro estruturado, "eliminando a barreira entre a operação em campo e o registro administrativo"), mas acoplado ao SaaS de gestão pago da Aegro (produtor profissionalizado, já usuário de sistema). Valida a tese "captura conversacional mata a morte por digitação" por um player estabelecido; risco real se a Aegro descer de mercado. Ação: copy do Stevi reivindica já o nicho "caderno no zap SEM sistema de gestão, sem cadastro, sem mensalidade de software" — diferencial que a Aegro estruturalmente não ataca sem canibalizar o SaaS. — seguroruralbrasil.com.br (18/mar/2026, lançamento no Aegro Conecta 19/mar/2026)
- [25/jul] **Vento a favor por política da Meta: chatbots de IA de propósito geral banidos do WhatsApp desde 15/jan/2026** (ChatGPT, Perplexity etc. saíram do canal; bots de negócio/domínio seguem permitidos). O argumento do flight-plan "vs ChatGPT" ganhou uma linha objetiva: o ChatGPT não PODE mais estar no zap do produtor; um assistente de domínio cercado, com agrônomo CREA por trás, pode. Ação: 1 linha nova no pitch e na página /verificar. — portaltela.com (23/out/2025, vigência 15/jan/2026)
- [25/jul] **Evidência de monetização converge: produtor 5-50 ha comprovadamente NÃO paga assinatura; quem paga é instituição — e lead-gen R$50 não tem comp público (mercado aberto).** Pró-instituição: ATeG/Senar = assistência mensal GRATUITA ao produtor por 24 meses, paga pelo sistema (cnabrasil.org.br); ManejeBem = projetos patrocinados por indústria/coop (Nespresso-style), produtor não paga, NPS 9,26 (manejebem.com); RAImundo = grátis (governo); Clube Broto = R$14,90/mês subsidiado pela lógica de aquisição do BB. Contra/risco lead-gen: nenhum benchmark público de R$/lead aceito para agrônomo/consultoria agro BR foi encontrado (proxy mais próximo: CPC médio ~R$12,50 em campanhas agro — adlocal.com.br 2026); consultores precificam por diária/sacas, sem tabela pública (aegro.com.br/blog). Implicação: R$50/lead é hipótese SEM comp de mercado — o teste do Michel (lead nº 3, já roteirizado no flight-plan) é o único gerador de evidência que existe; o memo deve pré-registrá-lo como o experimento decisivo da tese de receita, não como detalhe. — fontes acima, acessadas 25/jul/2026
- [25/jul] **Caso quantificado pró canal-extensionista (kit do técnico): Farmer.Chat/Digital Green — 12.000 agentes de extensão adotaram, servindo 500 mil produtores (Índia/Quênia/Nigéria); estudo 60 Decibels 2025: 70% dos produtores aplicaram recomendações em 30 dias, 73% acessavam advisory digital pela 1ª vez.** O modelo que escala é a ferramenta NA MÃO do agente de confiança, não app direto ao produtor — mesma tese do nosso kit do técnico/ATeG Café+Forte (área 1). No BR: WhatsApp já é "a ferramenta mais usada" na ATER remota da Emater-MG (caso estrutural, 2021; página oficial do Ater Digital fora do ar por período eleitoral em 25/jun/2026 — sem números 2026). Ação: memo posiciona o técnico ATeG/EMATER como usuário-distribuidor primário do beachhead café, citando Farmer.Chat como precedente quantificado. — digitalgreen.org + openai.com/index/digital-green (2025); agrolink.com.br nº 446771 (2/mar/2021)

### 3. APIs & dados agro (5.5)
- [seed] Verificação empírica NDVI (offset BOA +1000) + máscara SCL.
- [seed] Open-Meteo commercial (~€29/mês); alternativa a titiler.xyz (GEE startups program — prazo/custo).
- [seed] Fallback de preços (stooq) p/ Yahoo não-oficial.
- [25/jul] **NDVI: veredito EMPÍRICO — o cálculo atual NÃO está enviesado; o risco real é a migração de collection.** Teste feito hoje via STAC + titiler no mesmo ponto (-20.25, -42.05, Manhuaçu-MG) e mesma cena (S2C 23KRT, 21/jul/2026): collection `sentinel-2-l2a` (a que o ndvi.ts usa) leu B04=1288/B08=2747; collection `sentinel-2-c1-l2a` leu B04=2288/B08=3747 — exatamente +1000 por banda. Ou seja: a collection antiga entrega COGs HARMONIZADOS (offset já removido; item atual baseline 05.12 com `earthsearch:boa_offset_applied: true`) e o NDVI cru do ndvi.ts está correto para cenas recentes (NDVI 0,36 coerente com SCL=5/não-vegetado no ponto); já a c1 preserva o DN da ESA com o +1000 embutido (decisão explícita da E84: "we have decided not to apply scale or offset", discussion #26) — migrar para c1 sem aplicar `raster:bands` (scale 0.0001, offset -0.1) INTRODUZIRIA o viés que a auditoria temia (0,80 real → ~0,55). Pegadinha: o `raster:bands` da collection antiga também anuncia offset -0.1, mas o dado já está corrigido — a flag por item é a verdade, o metadado é enganoso. Como a antiga está marcada para ser substituída pela c1 (README E84), proposta: (a) checar `earthsearch:boa_offset_applied` por item no findLatestScene e logar/abortar se false; (b) golden-field test de 30 min que trava a calibração: 2 pins conhecidos (talhão do Michel + um fragmento de mata), ler B04/B08 nas DUAS collections na mesma cena, comparar com o NDVI do Copernicus Browser (mesma data/ponto, browser.dataspace.copernicus.eu) e gravar os valores como teste de regressão. Custo: R$0. — earth-search.aws.element84.com/v1 (itens vivos, 25/jul/2026); github.com/Element84/earth-search discussion #26 + README; titiler.xyz point-reads 25/jul/2026
- [25/jul] **Máscara de nuvem SCL: viável no titiler atual, +9 point-reads por pin, sem dependência nova.** As duas collections servem `SCL.tif` como COG (testado hoje: point-read no SCL da cena de Manhuaçu retornou classe 5.0 pelo mesmo endpoint `/cog/point` que o ndvi.ts já usa). Proposta: ler SCL nos mesmos 9 pontos do grid ANTES de B04/B08 e descartar pixels das classes {0 nodata, 1 saturado, 3 sombra de nuvem, 8 nuvem média, 9 nuvem alta, 10 cirrus}; se sobrarem <5 amostras, cair para a cena anterior. Fecha o finding HIGH "nuvem sobre o talhão vira 'possível estresse'" e o falso "não achei vegetação" do onboarding. Custo: R$0 (mesma infra; ~27 reads/pin em vez de 18). — classes SCL: docs Sentinel-2 L2A (Scene Classification); asset SCL verificado vivo em ambas collections 25/jul/2026
- [25/jul] **titiler self-host no Fly.io por ~US$6/mês (~R$33) resolve o load-bearing demo AGORA; GEE não vale o rewrite neste estágio.** Fly.io: shared-cpu-1x 1GB = US$5,92/mês + egress US$0,02/GB (volume do Stevi: centavos) → ~US$6-7/mês total; container pronto (ghcr.io/developmentseed/titiler), deploy = 1 fly.toml + trocar 2 consts de URL no ndvi.ts. Alternativa GEE: uso comercial obrigatório para empresa operacional; pay-as-you-go US$1,33/EECU-h online, US$0,40/EECU-h batch, US$0,026/GB (cloud.google.com/earth-engine/pricing); o Google for Startups Cloud Program cobre EE com até US$100k/ano nos 2 primeiros anos, mas o tier alto exige startup COM funding institucional (Stevi bootstrapped → tier de entrada menor) e o data path inteiro teria que ser reescrito da API STAC/COG para a API EE. Proposta: Fly agora (1º passo: `fly launch --image ghcr.io/developmentseed/titiler:latest`, ~1h), GEE reavaliado se/quando houver funding — e trocar o probe do canary por point-read real num COG fixo com valor esperado (o healthz atual aceita 429/404 como saudável). — fly.io/docs/about/pricing (25/jul/2026); cloud.google.com/earth-engine/pricing; earthengine.google.com/commercial
- [25/jul] **Clima: Open-Meteo commercial US$29/mês fecha o gap de termos; INMET NÃO tem API de previsão com SLA (mas tem um cross-check útil).** Open-Meteo: plano Standard US$29/mês = 1M calls/mês, API key, endpoint dedicado, uptime 99,9% e uso comercial licenciado — o free tier é explicitamente "non-commercial use" com 10k calls/dia (open-meteo.com/en/terms + /en/pricing). É a fonte mais load-bearing do produto (pulverização, geada, farm card): assinar é a proposta óbvia, 1º passo = assinar e pôr a key em env. INMET: nenhuma API de previsão documentada (portal.inmet.gov.br/manual só documenta o RSS de avisos); existe `apiprevmet3.inmet.gov.br/previsao/{geocode IBGE}` — testado hoje p/ Manhuaçu (3139409): JSON válido, mín/máx por período, ~2 dias, sem token — mas é endpoint interno do portal, sem docs nem SLA: serve como CROSS-CHECK de geada no canary (se Open-Meteo e INMET divergirem >3°C na mínima, flag), não como fundação. — open-meteo.com/en/pricing e /en/terms (25/jul/2026); portal.inmet.gov.br/manual; apiprevmet3 testado 25/jul/2026
- [25/jul] **Preços: números REAIS de licença — B3 D-1 é GRÁTIS para redistribuir, delayed snapshot custa R$320/mês; CEPEA é CC BY-NC (comercial só com autorização); stooq não tem termos citáveis.** B3 Market Data Commercial Policy 2026 (item 4.1.1, licença de Distribution por dataset/mês, tabela nacional): Delayed|Snapshot R$320, Delayed|Continuous R$1.920, Real-Time R$6.000; e a Consumption Policy permite distribuir dados end-of-day/D-1 SEM custo e SEM autorização prévia. Caminho barato e legal para o card de preços: ajuste D-1 do ICF (café arábica B3) como fonte licenciada de graça ("fechamento de ontem"), com KC=F (ICE NY — licença de bolsa americana, fora do alcance) rebaixado a referência interna, não redistribuída em card viral. CEPEA: dados sob CC BY-NC 4.0 — uso comercial requer autorização escrita, sem preço público; 1º passo = e-mail ao CEPEA pedindo termos para redistribuição em WhatsApp (custo hoje: R$0, só a pergunta). stooq: termos de uso NÃO recuperáveis publicamente (stooq.com/terms.html vazio; regulamin 404) — sem cláusula para citar, é fallback TÉCNICO com o mesmo status jurídico do Yahoo, não solução de licença. — b3.com.br "Market Data Commercial Policy 2026" (PDF oficial, lido 25/jul/2026) + "Market Data B3 Consumption Policy" (16/set/2025); cepea.org.br (CC BY-NC); stooq.com verificado 25/jul/2026
- [25/jul] **WhatsApp Cloud BR 2026: marketing US$0,0625/msg ENTREGUE, utility US$0,0068, auth US$0,0068 — e utility dentro da janela de 24h é GRÁTIS.** Per-message desde 1/jul/2025 (fonte primária Meta: "Effective July 1, 2025, Meta charges on a per-message basis"); billing em BRL para contas Brasil desde 1/jul/2026. Marketing não subiu de preço unitário (mesmos US$0,0625 da era por-conversa), MAS a mecânica encareceu sequências: antes 1 conversa de 24h cobria N templates, agora CADA template de marketing entregue custa US$0,0625 (~R$0,34) — reforça o reply-first da área 1 (resposta abre janela onde a conversa é livre). Implicação de produto: os alertas de retenção (geada/fogo/vazio) como template UTILITY custam ~R$0,04/msg e são GRÁTIS quando o produtor interagiu nas últimas 24h — o loop de retenção custa centavos, não é o custo que o bloqueia. Tiers de volume só reduzem utility/auth, não marketing. — developers.facebook.com/documentation/business-messaging/whatsapp/pricing (25/jul/2026); rate card BR corroborado em ≥3 BSPs (messagecentral.com, whautomate.com, formbeep.com)

### 4. Produto & CX (6.0)
- [seed] Alertas de retenção quebrados por construção (Pacote B do roadmap) — aguarda ok do usuário para código.
- [seed] Pesquisar: padrões de retenção de bots WhatsApp B2C (o que traz o usuário de volta no dia 2?); voice-first UX para baixo letramento.
- [25/jul] **Evidência de retenção D2/D7 em assistentes agro: quem volta, volta por gatilho temporal + próximo-passo sugerido — broadcast genérico não segura ninguém.** Farmer.Chat (Quênia, 8.805 usuários, 225 mil+ queries): média 28,9 queries/usuário; 35% "power users" geram ~80% das queries; os follow-ups clicáveis (introduzidos fev/2024) chegaram a >45% das interações no pico; o retorno é puxado por sazonalidade (surto de queries de praga/doença em mar-abr/24). 60 Decibels: FarmerChat Quênia 2025 (N=450) = 61% de "meaningful use" vs benchmark Quênia 27%; estudo amplo (~5.000 produtores, 18 agtechs, 5 países) = 35-48% de uso significativo, e uso >1 ano correlaciona com outcomes mais fortes. Nudges: RCT Índia (N=1.006) — SMS aumentou significativamente a adoção de app agro; lembretes TEMPORALMENTE relevantes → +0,44 práticas adotadas/ano (Blekking et al. 2026); contra-evidência que disciplina o desenho: Uganda (Van Campenhout 2021, AJAE) não achou efeito incremental de lembrete IVR/SMS genérico. Implicação Stevi: retenção não é "mandar mensagem", é mandar A mensagem no gatilho certo (geada iminente, janela de pulverização, preço que mexeu, "resolveu?") — e restaurar os quick replies nos cards (finding MEDIUM da auditoria: mídia mata botões justamente nos picos de valor; o dado de 45% do Farmer.Chat prova que é ali que a retenção mora). Métrica: taxa de retorno D2 e D7 por mecânica de gatilho, medível no message log hoje. — arxiv.org/abs/2409.08916 (2024); 60decibels.com "farmers-using-digital-tools" + FarmerChat Kenya Lean Data (2025); doi.org/10.1177/00139165251390702 (2026); doi.org/10.1002/ajae.12089 (2021)
- [25/jul] **Voice-first: evidência qualitativa forte, RCT áudio-resposta vs texto NÃO existe publicado — e TTS pt-BR custa centavos: proposta = resposta em áudio ESPELHADA (áudio responde áudio).** Evidência: literatura ICTD/CHI aponta preferência consistente por interação verbal em baixo letramento, e voz foi "essencial" em FarmerChat/VetBot/ASHABot (preferência moldada por letramento e idade); Kissan AI escalou a 2M+ produtores em 12 línguas voice-first (IVR+WhatsApp); o próprio Farmer.Chat devolve áudio TTS. Número de retenção específico de áudio-resposta não achei — tratar como aposta barata com medição própria, não como verdade importada. Custo real (jul/2026): Azure Neural US$16/1M chars (pt-BR maduro: Francisca, Thalita etc.), OpenAI TTS US$15/1M, Google Chirp 3 HD US$30/1M, ElevenLabs US$50-180/1M (fora de preço para o caso). Resposta de 30s ≈ 450 chars ≈ US$0,007 (~R$0,04); produtor que troca 20 áudios/mês ≈ R$0,80/mês. Mudança concreta: quando o inbound é áudio, responder áudio + texto (mesmo conteúdo, sem markdown); compliance.ts roda ANTES do TTS — o áudio é sintetizado do texto já aprovado, nenhuma regra nova de segurança. Métrica: % de produtores de áudio que seguem mandando áudio (proxy de conforto) e D7 de quem recebe áudio-resposta vs só texto. — dl.acm.org/doi/10.1145/3772318.3791266 (CHI 2026) + arxiv.org/pdf/2509.16158; kissan.ai (25/jul/2026); texttolab.com/blog/azure-text-to-speech-pricing + costgoat.com/pricing/openai-tts + diyai.io Google TTS pricing (jul/2026)
- [25/jul] **2º momento de valor em <24h: "bom-dia da lavoura" no D1, com opt-in colhido no fim do onboarding — WhatsApp abre 90-98% e a mensagem custa R$0,04 (ou R$0 na janela).** Padrão: o onboarding (farm card) fecha com UMA pergunta — "Quer que eu te avise se vier geada e te mande o tempo e o preço do café amanhã cedo?"; o "sim" vira opt-in registrado e o D1 vira template UTILITY compliant (update informacional que o usuário pediu), fora do per-user marketing cap que derrubou a prospecção. Guard-rail: template estritamente informacional (dados, zero promoção) — utility disfarçado de marketing é recategorizado pela Meta e arrisca o número (regra da área 1). Conteúdo do D1, tudo já existente no produto: mínima do dia + risco de geada (frost check do monitor) + preço café B3 D-1 (grátis para redistribuir — área 3) + 1 quick reply ("ver a lavoura 🛰️" / "preço 💰") que reentra no pipeline. Canal não é o gargalo: open rate WhatsApp 90-98%, leitura típica <5 min. Métrica: % de opt-in no onboarding (meta >60%) e retorno D2 (qualquer inbound) de quem recebeu o bom-dia vs quem não. — hyperleap.ai + wapikit.com WhatsApp Business stats 2025-26; developers.facebook.com pricing (utility US$0,0068, grátis na janela de 24h — custos fechados na iteração 3)
- [25/jul] **Follow-up pós-triagem em ~48h ("E aí, resolveu?") — a mecânica de D2 mais barata que existe e a única que gera dado de OUTCOME.** Evidência: o sucesso medido em agro-advisory é AÇÃO aplicada (60 Decibels 2025: 70% dos produtores do Farmer.Chat aplicaram recomendação em 30 dias — it.2); lembrete temporalmente relevante tem efeito causal (+0,44 práticas/ano, Blekking 2026); follow-up sugerido é o motor de 45% das interações do Farmer.Chat — e NENHUMA plataforma pesquisada publica follow-up pós-diagnóstico automatizado: espaço aberto. Mudança: 48h após pest_triage/veredito de spray, 1 template utility (follow-up de interação iniciada pelo produtor): "Oi {{1}}! Como ficou aquela {{2}} na lavoura? Me conta:" + 3 quick replies (Melhorou / Tá igual / Piorou). Cada resposta: (a) reabre a janela de 24h (conversa livre, grátis); (b) grava outcome no triage_events — o moat da área 6 ganha o rótulo que falta hoje; (c) "Piorou" → oferta de conectar agrônomo (lead pro concierge que já existe). Custo: US$0,0068/msg entregue. Métrica: taxa de resposta ao follow-up (meta >30%) e % de triagens com outcome registrado. — 60decibels.com/insights/farmers-ai-recommendations (2025); doi.org/10.1177/00139165251390702 (2026); arxiv.org/abs/2409.08916 (45% via follow-ups)
- [25/jul] **Loop de retenção mínimo para o gate S4 — desenho completo com engenharia mínima, teto ~R$2,50/produtor/mês.** Sequência: D0 onboarding (farm card + pergunta de opt-in) → D1 manhã "bom-dia da lavoura" (utility) → +48h follow-up pós-triagem quando houve triagem → evento-driven contínuo (geada/fogo/vazio quando a condição dispara — é o Pacote B) → D7 "resumo da sua semana" (chuva acumulada, NDVI, variação do preço — reusa a mecânica do digest, virada pro produtor). Anti-spam: máx 1 proativa/dia e 3/semana (alerta de geada fura o cap por ser segurança); bom-dia pausa após 7 dias sem leitura/resposta; SAIR sempre honrado. Pré-requisito técnico inegociável (Pacote B, aguarda ok): persistir provider/canal por usuário + caminho de template na send() dos dois adapters — sem isso nada disso chega a produtor dormente >24h (finding HIGH da auditoria: alertas hoje quebrados por construção). Custo/produtor/mês no PIOR caso (tudo fora da janela, como utility): 30 bom-dias + 4 follow-ups + 4 alertas ≈ 38 × US$0,0068 ≈ US$0,26 (~R$1,40); versão enxuta (3 proativas/semana) ≈ R$0,50; + TTS opcional ≈ R$0,80 → teto ~R$2,50. LLM adicional ~zero (mensagens proativas são template, não geração). Métrica do gate: D7 vouchado (scorecard) de quem optou-in vs não; kill-switch: se D7 não mexer em 4 semanas com ≥10 produtores expostos, o bom-dia diário morre e fica só evento-driven + follow-up. — custos WhatsApp da iteração 3 (developers.facebook.com, 25/jul/2026); evidência das propostas acima; Esoko/RML precedente de info diária de preço/clima como serviço retido (+10% renda via barganha — sti-portal.fao.org / gsma.com, estudos 2010s)

### 5. Cards & UI (6.0)
- [seed] wa.me em todos os cards + HMAC (aguarda ok). Pesquisar: exemplos de cards virais BR (clima/preço) e o que os faz circular em grupo.
- [25/jul] **QA mobile ao vivo (375px, roca-black.vercel.app): layout sólido, mas os 3 bugs de copy da auditoria continuam EM PRODUÇÃO no ponto exato de conversão.** Visto no browser (não no código): (1) hero e faixa final ainda dizem "código de acesso"/"WhatsApp sandbox" enquanto o prefill real é "Oi, Stevi! Quero testar." — a nota fica a 14,4px logo abaixo do CTA primário; (2) "ele" vivo em ≥4 lugares ("do jeito que ele responde", "ele pede sua permissão", 2 FAQs); (3) zero links para /verificar e zero menção a agrônomo-parceiro/cooperativa no body inteiro (grep no DOM ao vivo). O que está BOM ao vivo: acima da dobra cabem H1 + CTA sólido olive + CTA fantasma (hierarquia correta), sem overflow horizontal, HTML ~39KB, sem quebras visuais; nav some no mobile sem hambúrguer (finding conhecido, aceitável em landing de scroll único). Bônus: /verificar renderiza Michel Silva CREA-ES 010049/D em produção (env vars setadas — incerteza da auditoria RESOLVIDA). Proposta: executar o lote de 15 min de copy (sandbox→"a mensagem já vem pronta — é só enviar", ele→ela, link /verificar no footer) antes de religar outbound — é a página que o prospect que googla vê. — QA browser 25/jul/2026, DOM ao vivo em 375×812
- [25/jul] **Fechar o viral loop: rodapé wa.me DUPLO (pixel + caption) com ?text= por tipo de card — o prefill é a própria frase de intent, então atribuição = roteamento.** Padrão click-to-chat: wa.me/<número>?text=<msg URL-encoded>, mensagem curta e acionável; atribuição por fonte = um texto DIFERENTE por origem, contado no primeiro inbound (sem cookie, sem encurtador de terceiro — encurtador esconde o destino e mina confiança). Desenho: (a) no PIXEL do card (sobrevive a qualquer forward), linha DM Sans 700 verde em tamanho body — "wa.me/55XXXXXXXXX · manda 'cotação'" (curto e digitável; hoje a CTA é a MENOR fonte do card, em cinza muted); (b) na CAPTION da mídia, o link completo clicável https://wa.me/<n>?text=cota%C3%A7%C3%A3o — caption pode se perder no forward, por isso o pixel é o load-bearing. Prefill por tipo: prices→"cotação" (já roteia pro fast-path de preços, commit 011eb7e), frost→"geada", ndvi→"como está minha lavoura?" — a primeira mensagem do convertido JÁ entra no pipeline como intent válido E identifica o card de origem no message log (métrica forward→conversa por tipo). Guard-rail de privacidade: link ESTÁTICO por tipo, nunca por usuário — link único por destinatário vazaria a identidade de quem encaminhou; no máximo tipo+data. Pré-requisito já no seed: HMAC nas URLs de card (forgery de marca mata a confiança que o rodapé constrói). — faq.whatsapp.com (click to chat); linklyhq.com/blog/whatsapp-link-generator + greenbubble.io/blog/direct-whatsapp-link-generator (atribuição por texto distinto por canal, 2025-26); auditoria área Cards
- [25/jul] **Padrão dos cards que JÁ circulam em grupo rural BR: autoridade nomeada + antecedência + validade — frost card ganha carimbo "emitido hoje · HH:MM" + "vale para a madrugada de dd/mm".** Referências reais: (1) Alerta Geada IDR-Paraná/Simepar — serviço público que o cafeicultor recebe via WhatsApp/Telegram e app IDR Clima, avisos com 48h e 24h de antecedência, ativo mai-set, gratuito: o formato que o produtor já confia e repassa é órgão emissor + antecedência explícita + validade; (2) boletins diários de coop: Cooxupé publica Boletim Diário e cotações com data e praça (cooxupe.com.br/cotacoes), Notícias Agrícolas republica o indicador CEPEA diário — o gênero "cotação do dia" é commodity; o diferencial encaminhável é marca+data+praça legíveis na THUMBNAIL; (3) Grão Direto lançou o AIrton (IA no WhatsApp que manda cotações/alertas, mar/2025) — precedente direto de cotação-no-zap como aquisição. Mudança concreta (frost.ts, ~6 linhas): pill "emitido hoje · HH:MM (BRT)" + validade no header — o card atual tem datas mas não diz QUANDO foi emitido nem até quando vale, e é isso que separa aviso crível de print velho re-encaminhado (mesmo furo do spray card, finding conhecido). Impacto: mais forward (urgência crível) e proteção contra "alerta requentado" em nome da marca. — adapar.pr.gov.br "Receber alerta de geada para a cultura de café"; istoedinheiro.com.br "IDR e Simepar lançam serviço alerta contra geada via WhatsApp"; cooxupe.com.br/cotacoes; agfeed.com.br (AIrton, Grão Direto)
- [25/jul] **Seção B2B "Para agrônomos e cooperativas" na landing — estrutura extraída de 3 referências BR que vendem pro mesmo comprador.** (1) Aegro "Software para Consultor Agronômico" (aegro.com.br/para-voce/software-para-consultor-agronomico): página SEGMENTADA por persona (padrão /para-voce/), hero com promessa no resultado do consultor, prova social em números agregados ("4 mi+ ha", "10 mil+ usuários", margem 22%→38-42%), depoimentos nomeados, CTA único "Agende uma demonstração" repetido 8×; (2) ManejeBem (manejebem.com): páginas por comprador (agroindústria/ESG/ATER digital) e NPS 9,26 de projeto como prova social — UM número honesto de satisfação vale mais que logos que não temos; (3) Grão Direto: apresenta a plataforma por elo da cadeia (cooperativas, armazéns, tradings) — o comprador se encontra pelo próprio nome. Tradução pro Stevi (1 seção na landing, não página nova): título "Para agrônomos e cooperativas", âncora de responsabilidade = Michel Silva CREA-ES 010049/D (JÁ renderizado em /verificar — reusar com link), 1 número honesto quando existir (ex.: triagens com fonte citada), e CTA próprio com atribuição: wa.me?text="Oi! Sou agrônomo(a)/cooperativa e quero conhecer a Stevi" — distinto do CTA de produtor, mede o funil B2B que a Vitória alimenta. Impacto: o prospect que recebe o template e googla deixa de cair numa página 100% farmer que contradiz o pitch (finding HIGH, confirmado ao vivo hoje). — aegro.com.br/para-voce/software-para-consultor-agronomico; manejebem.com (projetos ESG/ATER digital, NPS 9,26); grao direto/agfeed 25/jul/2026
- [25/jul] **/verificar converte no momento de maior intenção e o único CTA abre chat VAZIO — adicionar ?text= distinto e alinhar o rodapé.** Visto ao vivo: o botão "Falar com a Stevi no WhatsApp" de /verificar é href="https://wa.me/19705509125" SEM prefill (a landing tem "Oi, Stevi! Quero testar." nos 4 CTAs) — quem acabou de verificar a marca cai num campo em branco e precisa inventar o que dizer; e o rodapé diz "assistente do cafeicultor" enquanto a landing diz "soja, milho, pastagem, café e citros" (terceira resposta divergente, agora confirmada ao vivo nas duas superfícies). Mudança (api/_lib/verifierPage.ts, 2 linhas): ?text="Oi, Stevi! Verifiquei o número e quero testar." — que também vira atribuição /verificar→conversa no message log (mesma mecânica dos cards); rodapé alinhado ao posicionamento que o memo de beachhead decidir. Impacto: fecha a fricção no ponto mais quente do funil de confiança — a página existe exatamente pra converter cético. — QA browser 25/jul/2026 (DOM de /verificar ao vivo)

### 6. Dados & moat (6.5)
- [seed] triage_events + ndvi_readings append-only (aguarda ok).
- [seed] Pesquisar: quem compra dado de pressão de praga regional (coops? seguradoras? indústria de defensivos?) e em que formato.

---

## Log de iterações (append)

### Iteração 5 — 25/jul (~16h30) — Cards & UI (com QA ao vivo)
- Pesquisador de design (157K tokens, 29 tool uses); 5 propostas na área 5.
- **QA mobile ao vivo (375px, produção):** layout saudável e sem overflow;
  mas os 3 bugs de copy da auditoria CONTINUAM no ar ("código de acesso/
  sandbox" no hero e na faixa final; "ele" ≥4×; zero link pra /verificar e
  zero menção a agrônomo/coop no body). **Incerteza da auditoria resolvida:**
  /verificar renderiza Michel Silva CREA-ES 010049/D em produção (env OK).
  Achado novo: o CTA do /verificar é wa.me SEM ?text= — chat vazio no momento
  de maior intenção; e rodapé diz "cafeicultor" vs "5 culturas" da landing.
- **Padrão dos cards que circulam** (IDR-Paraná/Simepar geada 48h antes;
  boletim diário Cooxupé; AIrton/Grão Direto): autoridade nomeada +
  antecedência explícita + validade. Proposta de 6 linhas: carimbo "emitido
  hoje HH:MM + validade" no frost card.
- **wa.me?text= por TIPO de card** (privacidade: nunca por usuário): rodapé
  duplo — número digitável no pixel + link clicável na caption com prefill da
  frase de intent ("cotação", "geada") que já roteia no fast-path → atribuição
  forward→conversa direto no message log, sem encurtador.
- **Landing B2B referências:** Aegro (página por persona, CTA demo 8×),
  ManejeBem (NPS como prova), Grão Direto (segmentação por elo).
- Próxima: Dados & moat (última área virgem) → depois, síntese executiva.

### Iteração 4 — 25/jul (~16h05) — Produto & CX (retenção)
- Pesquisador de produto (137K tokens, 22 tool uses); 5 propostas na área 4.
- **Evidência de retenção mais forte:** Farmer.Chat (arXiv 2409.08916, 8.805
  usuários): follow-ups clicáveis = **>45% das interações**; retorno puxado
  por sazonalidade de praga. Nudges só funcionam quando temporalmente
  relevantes (+0,44 práticas/ano, Blekking 2026); lembrete genérico não move
  nada (Van Campenhout 2021). → O finding da auditoria "cards matam os quick
  replies nos picos de valor" é **bug de RETENÇÃO**, não cosmético.
- **TTS/voz-resposta:** evidência qualitativa forte, zero RCT — aposta barata
  a medir internamente. Custo: resposta de 30s ≈ R$0,04; ~R$0,80/produtor/mês
  (Azure US$16/1M chars). Regra proposta: áudio responde áudio, sintetizado do
  texto JÁ aprovado pelo compliance.ts.
- **Loop de retenção mínimo p/ S4 desenhado** (usa o que existe): D0 opt-in →
  D1 "bom-dia da lavoura" (mínima+geada+preço B3 D-1, template utility) →
  +48h "resolveu?" pós-triagem (grava outcome + reabre janela grátis) →
  alertas evento-driven (Pacote B é pré-requisito) → D7 resumo. Anti-spam:
  1/dia, 3/semana, pausa após 7 dias mudo. **Custo R$0,50-2,50/produtor/mês.**
  Kill-switch: 4 semanas sem sinal no D7 opt-in vs não.
- Próxima: Cards & UI (stevi-pesquisa-design-ui).

### Iteração 3 — 25/jul (~15h45) — APIs & dados agro
- Pesquisador de infra (155K tokens, 47 tool uses); 6 propostas na área 3.
- **NDVI: finding CRITICAL da auditoria DERRUBADO empiricamente.** Teste ao
  vivo no mesmo ponto (Manhuaçu) e mesma cena: collection `sentinel-2-l2a`
  (a nossa) vs `c1` diferem exatamente +1000/banda → a nossa entrega COGs
  harmonizados (`boa_offset_applied: true`) e **o NDVI atual está correto**.
  O risco real é o INVERSO: migrar para a c1 (a antiga será descontinuada)
  sem aplicar offset introduziria o viés. Proposta: golden-lock de regressão
  com 2 pins conhecidos. Máscara de nuvem SCL: legível pelo mesmo /cog/point,
  +9 reads/pin, custo zero.
- **Custos fechados com fonte:** titiler self-host Fly.io ~US$6/mês (fazer);
  GEE só com funding (US$1,33/EECU-h, startups program exige tier alto).
  Open-Meteo commercial US$29/mês (free é explicitamente non-commercial).
  INMET `apiprevmet3` testado (JSON válido, sem docs/SLA) — cross-check de
  geada, não fundação. **B3 D-1/EoD é GRÁTIS para redistribuir** (Consumption
  Policy); delayed R$320/mês; CEPEA é CC BY-NC (pedir autorização por e-mail);
  stooq sem termos citáveis. WhatsApp BR: marketing US$0,0625/msg, utility
  US$0,0068 (grátis na janela de 24h) → alertas de retenção como UTILITY
  custam ~R$0,04 — viáveis.
- Lead-check: 0 replies · 0 referrals · 0 msgs 24h.
- Próxima: Produto & CX (stevi-pesquisa-produto-cx).

### Iteração 2 — 25/jul (~15h20) — Estratégia & GTM
- Pesquisador de mercado (123K tokens, 31 tool uses); 6 propostas na área 2.
- **Deltas vs 16/jul:** (1) On Agri entrou no Clube Broto/Banco do Brasil
  (27/fev/2026) — agrônomo digital por **R$14,90/mês via clube**: a âncora de
  preço direto-ao-produtor desabou de R$147→R$14,90. (2) RAImundo estagnado
  (2.900 interações, freemium prometido sem lançamento). (3) Entrante:
  **Aegrozap** (Aegro, mar/2026) — áudio→registro estruturado no WhatsApp;
  valida o caderno conversacional, mas preso ao SaaS pago. (4) **Vento a
  favor: Meta baniu chatbots de IA de propósito geral do WhatsApp
  (15/jan/2026)** — "por que não o ChatGPT?" morreu por política; bot de
  domínio cercado segue permitido.
- **Monetização:** evidência converge em "produtor 5-50 ha não paga;
  instituição paga" (ATeG/Senar grátis pro produtor; ManejeBem por projetos
  patrocinados; Broto subsidiado pelo BB). Pró lead-gen: nicho vazio, ninguém
  monetiza lead de agrônomo. Contra: zero comp público de R$/lead no agro —
  o teste R$50 do Michel é o único gerador de evidência.
- **Distribuição:** Farmer.Chat/Digital Green — 12.000 extensionistas → 500
  mil produtores; 70% aplicam recomendações em 30 dias (60 Decibels 2025).
  O modelo que escala é ferramenta na mão do agente de confiança.
- Implicação honesta pro memo: enfraquece "assinatura de caderno ao
  produtor"; fortalece lead-gen-como-experimento + B2B2C institucional.
- Próxima: APIs & dados agro (stevi-pesquisa-infra-apis).

### Iteração 1 — 25/jul (~15h) — Prospecção & Vitória
- Lead-check: 0 replies · 0 referrals · 0 usuários novos · 0 msgs in 24h.
- Smoke pós-deploy: landing/verificar/webhook = 200.
- Pesquisador de prospecção (125K tokens, 27 tool uses): **H1 confirmada em
  fonte primária** (per-user marketing limits, #131049, aceita-na-API/bloqueia-
  na-entrega, Brasil no escopo) e **H1b nova** (#130497, restrição cross-border
  BR desde 15/set/2025 — vendors, sem fonte primária; discriminador = error
  code de 21/jul). +55 no WABA atual: cabe hoje (portfólio não-verificado
  suporta 2 números), custo só do chip; verificação de negócio grátis via CNPJ
  sobe tier 250→2.000/dia. Copy: templates atuais são pitch-completo (padrão
  <5% resposta); reescritas v3 reply-first prontas no backlog (pergunta única,
  disclosure de IA, CTA leve). Canais vouchados com passo 1: Coocafé (Lajinha,
  11 mil cooperados), FAEMG/ATeG Café+Forte (@spr.esperafeliz), EMATER-MG.
- Post-mortem atualizado com H1b. 7 propostas appendadas na área 1.
- **Para o founder:** o Gate 1 (ler o error code, 15 min) agora discrimina
  H1×H1b — e as duas convergem em "número +55 antes de religar marketing".
- Próxima: Estratégia & GTM (stevi-pesquisa-mercado) — spawnada em background.

### Iteração 0 — 25/jul (bootstrap, esta sessão)
- Lead-quente check: **0 leads reais**. Descoberta: as 5 referrals eram teste
  interno; único usuário externo real = Gaia Tech (michel, 17/jul, dormindo) →
  follow-up humano recomendado aos founders (e-mail NÃO enviado: não é lead
  novo, é correção de narrativa — foi pro relatório da sessão).
- Shipped: e-mail de lead quente no 1º reply de prospect (a97aec3).
- Docs corrigidos (tração/roadmap) + lição no lessons.md.
- Próxima iteração: pesquisa Prospecção & Vitória (agente spawnado em background).
