# Stevi — Roadmap pós-auditoria (25/jul/2026)

**Método:** auditoria multi-agente de 25/jul — 12 auditores especializados (arquitetura,
segurança/LGPD, performance/custo, produto/CX, prospecção/leads, cards/imagens,
dados/DB, APIs externas, testes, UI web, estratégia/GTM, loops de aprendizado) +
1 red-team CEO que desafiou os findings e apontou lacunas. ~2M tokens, 446 leituras
de arquivo, sobre master (HEAD 4ad9de5). Evidência completa: [auditoria-completa.md](./auditoria-completa.md).
Desenho da equipe de agentes da empresa: [AGENTS.md](./AGENTS.md).

**Contexto vinculante:** estamos no dia ~12 do voo de 60 dias (13/jul → 11/set), com
scorecard pré-registrado e o tripwire *"commits > conversas-com-produtores = campanha
fora dos trilhos"* **já disparado** (design system + refactors + gym enquanto
`PROSPECT_DAILY_CAP=0` congela a aquisição há 4+ dias). Este roadmap se subordina ao
flight-plan: engenharia mínima e cirúrgica; o gargalo é campo, não código.

---

## Notas por dimensão

| Dimensão | Nota | Veredito em uma linha |
|---|---|---|
| Arquitetura & código | 7.0 | Bem acima da média; 3 buracos: perda silenciosa at-most-once, "Anotado" falso, sends Cloud sem log |
| Segurança & LGPD | 7.0 | Engenharia forte; compliance de papel frágil (consentimento declarado ≠ implementado, Vitória sem disclosure de IA) |
| Performance & custo | 6.5 | Custo irrisório; latência WhatsApp é o problema (webhook síncrono, card no caminho da entrega, LLM sem timeout) |
| Dados & modelagem | 6.5 | Schema disciplinado de app de mensagens; **não** é schema de empresa de dados — o moat declarado está sendo jogado fora |
| Testes & qualidade | 6.0 | 547 testes verdes, mas deploy sem gate, send-path sem teste, golden julgado pela mesma família e 0/36 assinados |
| Produto & CX | 6.0 | Núcleo honesto e bom; alertas proativos quebrados por construção, features escondidas atrás de regex, zero feedback de velocidade |
| Cards & PDFs | 6.0 | Render barato e bom design nos pilotos; viral loop quebrado (sem caminho de volta) e forgery de marca aberta |
| UI/UX web | 6.0 | Artesanato bom, alvo errado: landing 100% farmer sem lado B2B; painel mente durante emergência |
| APIs externas | 5.5 | Fail-soft honesto; fundação frágil (titiler demo, Yahoo não-oficial, Open-Meteo fora dos termos, NDVI possivelmente descalibrado) |
| Loops de aprendizado | 5.5 | Boa máquina de MEDIR, quase nada aprende sozinho; zero outcome real de fazendeiro realimenta o sistema |
| Prospecção & leads | 4.5 | Motor blindado protegendo decisão frágil: cold outreach sem opt-in no número único do produto; funil morto sem postmortem |
| Estratégia & GTM | 4.5 | Plano excelente orbitando um campo que ninguém está pisando; duas teses de receita não decididas desde 16/jul |

## Leitura executiva

1. **O código não é o risco; a decisão é.** As notas de engenharia (6–7) são acima da
   média pré-seed. As duas piores notas (4.5) são estratégia e prospecção — exatamente
   onde código não conserta. Duas teses de receita concorrentes (lead-gen R$50/lead vs
   caderno/crédito) e dois beachheads (café vs hortifruti) estão abertos desde 16/jul;
   validar meio de cada um em 60 dias = validar nenhum.

2. **Ninguém sabe a tração.** Lacuna mais grave apontada pelo red-team: nenhum dos 12
   auditores (nem o painel, nem o digest) responde "quantos produtores ativos, qual D7,
   quantos voltaram". O gate S4 (D7 vouchado ≥30%, coorte n≥15) é inoperável sem esse
   baseline — e a coorte não está sendo enchida porque a aquisição está parada.

3. **Risco existencial concentrado num número +1.** Cold outreach de marketing sem
   opt-in, no MESMO número que serve produtores, número que a Meta já sinalizou
   (display name recusado 3×, outage #132000, cap=0). Um ban não mata o funil B2B —
   mata a Stevi. CNPJ → +55 → número separado de prospecção é caminho crítico
   existencial, não milestone.

4. **O moat declarado está vazando.** A tese diz "contexto acumulado é moat", mas o
   veredito de triagem de praga não persiste estruturado, o NDVI é sobrescrito a cada
   leitura, o caderno mostra contadores em vez de conteúdo, e o card "viral" não tem
   caminho de volta. Consertar isso custa quase zero e compõe com o tempo.

5. **Mentiras silenciosas corroem a tese da honestidade.** "Anotado ✅" quando a escrita
   falhou; "Disparo automático ativo" no painel durante o cap=0; "consentimento" na
   página pública quando o código registra aviso; "4 produtores te esperando" que não
   existiam. O produto vende honestidade — a operação precisa praticá-la em cada superfície.

---

## AGORA (esta semana) — 5 decisões + 1 pacote de religada

> Regra: nada abaixo entra em execução de código sem confirmação do fundador.
> Itens [Fundador]/[Vitoria] são humanos por natureza; Claude/OS prepara material.

1. **[Fundador+Vitoria] Memo de 1 página: tese de receita + beachhead.**
   Lead-gen de agrônomo (R$50/lead) OU caderno/crédito (PRONAF, <R$147/mês)? Café OU
   hortifruti? Aberto desde 16/jul; bloqueia copy, prospecção, roadmap e o scorecard.
   Insumo novo da auditoria: o lead-gen tem teto estrutural (~R$1k/mês no cenário
   VENTURE do próprio scorecard) e mismatch geográfico observado.

2. **[Fundador] Levantar tração real + falar com as 5 referrals paradas.**
   Query fresca no Supabase (produtores ativos, D7/W1, conversas/dia) — vira o
   baseline do gate S4. As 5 referrals soja/milho SP/MT são a única demanda orgânica
   observada: atendê-las (recrutar 1 agrônomo SP/MT) ou declará-las fora do beachhead
   — mas parar de coletar demanda e jogá-la fora. *(Claude/OS: preparo as queries e o
   roteiro de entrevista.)*

3. **[Fundador] Postmortem escrito do dispatch (20-21/jul) ANTES de religar.**
   "Credencial re-sincronizada" não explica falha pós-aceite — a assinatura é de
   qualidade/limite do número (#131049), e religar sem entender acelera um ban.
   Religada só com o pacote de guard-rails: linha "Prospecção: PARADA há N dias" no
   digest, cap degradado 10 (não warming 20), bump D+3 excluído para coop/revenda
   (1 linha — hoje manda o pitch de lead-gen concorrente pra coop), disclosure de IA
   na 1ª mensagem da Vitória ("assistente digital da equipe Stevi"), enum de kinds
   unificado (prospects 'coop'/'sindicato' hoje ficam presos em ready para sempre),
   replied_at + rollup por template (dado de estágio não se reconstrói depois).

4. **[Fundador] Iniciar CNPJ esta semana.** Destrava +55, display name "Stevi",
   verificação de negócio Meta, stevi.agr.br — o caminho crítico leva semanas e
   nenhum resultado do voo sobrevive a um ban do +1.

5. **[Fundador] Formalizar Michel por escrito (5 linhas de WhatsApp) + sessão de
   assinatura dos 36 casos golden.** O QA agronômico, o CREA público em /verificar e
   o molde do produto estão em UMA pessoa sem acordo fechado. Assinar os casos
   transforma a métrica central de opinião-de-LLM em verdade de especialista — a
   maior alavancagem/custo de toda a auditoria.

## 30 dias (até o gate S4, ~10/ago)

**Pacote A — Confiabilidade do caminho crítico (1-2 dias de código, cirúrgico):**
- `AbortSignal.timeout` no `chatOnce` (25-30s reasoning / 10s router) — mata o cenário
  "produtor recebe silêncio total" (única chamada externa sem deadline).
- `alertFounders` no catch-all do webhook (hoje crash = ack 200 + log que ninguém lê).
- `log.error` nos 2 fallbacks silenciosos do `cloud.ts` (a classe exata do outage).
- Texto primeiro, card como 2ª mensagem em `finalizeAndSend` (resposta em segundos;
  o card chega quando renderizar).
- "Anotado" honesto: `insertApplication`/`setFarmCrops`/`createReferralRequest`
  retornam sucesso; em falha, resposta honesta ("não consegui anotar, manda de novo").
- Mark-as-read + typing indicator no Cloud adapter ao receber o webhook (1 POST;
  transforma a velocidade percebida).
- Portar o fix do PRICE_INTENT (PR #1) para master re-aplicado sobre a versão
  refatorada; matar a branch lateral.

**Pacote B — Loop de retenção de verdade (alertas):**
- Persistir canal/provider por usuário; cron deixa de instanciar `TwilioAdapter`
  hard-coded (hoje usuário Cloud recebe alerta de OUTRO número ou nada).
- Templates aprovados geada/fogo/vazio; template-first fora da janela de 24h
  (hoje o produtor dormente — o alvo do alerta — nunca recebe).
- Dedup de geada por nível (`frost:{date}:{risk}`) — hoje "risco 3°C" na terça
  silencia "geada 0°C" na quarta, o pior erro de confiança possível.

**Pacote C — Moat de dados barato (migrations + poucas linhas):**
- `triage_events` append-only (praga, confiança, cultura, município, data) — hoje o
  dado nº1 do moat é jogado fora na URL do card.
- `ndvi_readings` append-only — hoje cada leitura destrói a anterior.
- Caderno com conteúdo: `application_log` no EVENT_LABELS + praga/veredito nos
  registros (hoje "meu histórico" devolve contadores).
- Rodapé wa.me em negrito verde em TODOS os cards + HMAC curto nas URLs de card
  (forgery de marca aberta hoje; infra do reportToken já existe).

**Pacote D — Descobribilidade de features:**
- prices/history/brief/caderno como classes do router LLM + parágrafo de capacidades
  no SYSTEM_PROMPT (hoje metade das features só existe atrás de regex e o LLM não
  sabe que elas existem — whack-a-mole infinito).
- Café na pergunta de cultura do farm card; copy do REFERRAL_REPLY prometendo o
  follow-up que JÁ acontece (não "quando a rede estiver pronta").

**Pacote E — Prospecção sustentável:**
- Segundo número no WABA para prospecção (separar do número do produto).
- Decisão honesta: cold-WA sobrevive à tese "nunca número frio"? Alternativa
  desenhada pelo red-team: primeiro toque B2B vira intro vouchada/voz, Vitória vira
  follow-up de quem já respondeu.
- `alertStaleLeads` no cron de dispatch (SLA de lead quente: latência de alerta cai
  de ~48h para ~3h).

**Papel/legal (barato, janela ideal com cap=0):**
- LIA + RoPA de 1-2 páginas (produto + prospecção); corrigir /verificar e
  CONSENT_NOTE para a base legal real (legítimo interesse) — a alegação falsa de
  "consentimento" é pior que a verdade numa fiscalização.
- Consulta jurídica: responsabilidade civil da triagem (CREA/CDC), disclaimers.
- Verificar backup/PITR do Supabase e testar restore — o moat é o dado e ninguém
  sabe se ele sobrevive a um acidente.

## 90 dias (pós-gate; só se o scorecard mandar continuar)

- Webhook assíncrono (ack imediato + waitUntil/fila) — a única mudança estrutural
  que 100x exige; o pipeline já é idempotente e transport-agnóstico.
- Claim de inbound em duas fases (claimed → replied) — at-least-once com dedup.
- Tirar titiler.xyz do caminho crítico (self-host ou GEE startups) + verificação
  empírica do offset BOA do NDVI + máscara de nuvem SCL — hoje toda leitura de
  vigor é suspeita; verificar contra talhão conhecido ANTES de mexer no cálculo.
- Open-Meteo commercial (~€29/mês) — a fonte mais load-bearing do produto está
  fora dos termos de uso.
- Gate de deploy (branch protection + check verify obrigatório) — 10 minutos que
  encerram o deploy-quebrado-antes-do-CI (já aconteceu 2×).
- Pré-render de cards para storage; juiz cross-family no goldeneval/prospect-gym;
  testes de contrato do send-path (a camada que quebrou 2× em produção).
- Split de pipeline.ts (1.223 linhas) e db.ts (775) + tipos gerados do Supabase —
  DEPOIS do gate; é polish.

## Kill list (remover/congelar já)

- **Cold outreach de marketing no número do produto** — desligado até existir número
  separado E decisão explícita de que cold-WA continua sendo canal.
- **Migração design system v2 dos cards + lint tipográfico** — congelar até o gate S4.
- **Refactors estéticos** (split pipeline/db, tipos gerados, tightening de null-checks)
  — o tripwire já disparou; congelar até o gate.
- **Experimentos de gym/personas da Vitória** — sem funil ligado não geram sinal.
- **Citros e pastagem do discurso/landing** — se o memo confirmar café.
- **Tabela llm_usage / plano do reajuste Sonnet** — custo <US$0,10/conversa; prematuro.
- **2FA no painel, safeEqual nos crons** — higiene de backlog, não fila ativa.
- **A copy "quando a rede estiver pronta"** — matar imediatamente.

## Restart list (refazer do zero, não remendar)

- **Primeiro toque B2B** → intro vouchada/voz do founder; Vitória rebaixada a
  follow-up. É outro desenho de funil, não patch no dispatch.
- **Fluxo de referral do produtor** → entrega imediata (dossiê/caderno pronto para
  levar ao agrônomo local) em vez de promessa de futuro.
- **Base legal LGPD (/verificar + CONSENT_NOTE)** → reescrever com a base verdadeira.
- **Entrega de alertas proativos** → channel-aware por construção (Pacote B).
- **Landing: CTA + seção B2B** → alinhada ao fluxo real e ao lado parceiro do modelo
  (Michel CREA-ES como âncora; hoje a página converte o público errado com
  instruções contraditórias de "sandbox").

## Research list (pesquisar antes de decidir)

1. Causa raiz das falhas pós-aceite 20-21/jul (#131049 vs credencial) — obrigatório
   antes de religar.
2. Entrevistar as 5 referrals soja/milho SP/MT — pode invalidar a aposta café-MG;
   fazer ANTES de fechar o memo de beachhead.
3. Responsabilidade civil de triagem agronômica (CREA + CDC) — advogado.
4. Processo/custo: segundo número no WABA, verificação Meta com CNPJ novo, display
   name — sequenciar CNPJ → +55 → número de prospecção sem retrabalho.
5. NDVI: teste empírico do offset BOA +1000 contra talhão conhecido (Copernicus
   Browser como referência).
6. Canais de aquisição que ninguém avaliou: grupos rurais de WhatsApp, sindicatos,
   EMATER/ATER, revendas, rádio rural — onde "confiança emprestada" é nativa.
7. GEE startups vs self-host titiler — só quando houver volume de onboarding.
8. Licenciamento de preços (B3 delayed/CEPEA) — só se o memo eleger o card de
   cotações como loop de crescimento.
9. Backup/PITR Supabase: o que existe, custo, teste de restore.

## Regras de execução (deste roadmap)

1. **Tripwire vale para o roadmap também:** semana com mais commits que conversas de
   produtor = engenharia congela, exceto Pacote A (confiabilidade) e religada segura.
2. Todo item de código nasce com teste (regra da casa: bug → failing test → fix).
3. Todo incidente fecha com: post-mortem + 1 check de canário + 1 teste que o teria
   pego (institucionalizar o padrão #132000).
4. Nenhuma promessa outbound sem query fresca no sistema de verdade (lessons 17/jul).
5. Prioridade em empate: o que enche a coorte D7 > o que protege o número > o que
   acumula dado > todo o resto.
