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

### Iteração 0 — 25/jul (bootstrap, esta sessão)
- Lead-quente check: **0 leads reais**. Descoberta: as 5 referrals eram teste
  interno; único usuário externo real = Gaia Tech (michel, 17/jul, dormindo) →
  follow-up humano recomendado aos founders (e-mail NÃO enviado: não é lead
  novo, é correção de narrativa — foi pro relatório da sessão).
- Shipped: e-mail de lead quente no 1º reply de prospect (a97aec3).
- Docs corrigidos (tração/roadmap) + lição no lessons.md.
- Próxima iteração: pesquisa Prospecção & Vitória (agente spawnado em background).
