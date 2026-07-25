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

### 3. APIs & dados agro (5.5)
- [seed] Verificação empírica NDVI (offset BOA +1000) + máscara SCL.
- [seed] Open-Meteo commercial (~€29/mês); alternativa a titiler.xyz (GEE startups program — prazo/custo).
- [seed] Fallback de preços (stooq) p/ Yahoo não-oficial.

### 4. Produto & CX (6.0)
- [seed] Alertas de retenção quebrados por construção (Pacote B do roadmap) — aguarda ok do usuário para código.
- [seed] Pesquisar: padrões de retenção de bots WhatsApp B2C (o que traz o usuário de volta no dia 2?); voice-first UX para baixo letramento.

### 5. Cards & UI (6.0)
- [seed] wa.me em todos os cards + HMAC (aguarda ok). Pesquisar: exemplos de cards virais BR (clima/preço) e o que os faz circular em grupo.

### 6. Dados & moat (6.5)
- [seed] triage_events + ndvi_readings append-only (aguarda ok).
- [seed] Pesquisar: quem compra dado de pressão de praga regional (coops? seguradoras? indústria de defensivos?) e em que formato.

---

## Log de iterações (append)

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
