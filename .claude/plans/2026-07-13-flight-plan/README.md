# Voo de 60 dias — plano de validação (13/jul → 11/set 2026)

**Objetivo pré-registrado:** decidir *venture vs. negócio próprio vs. matar/pivotar*
com evidência honesta de (a) retenção de produtores e (b) disposição de pagar de
agrônomos — medida pelos instrumentos já construídos. O produto desta campanha é a
DECISÃO, não o assistente.

Constraints declaradas (13/jul): fundador full-time 30h+/sem · "provar primeiro,
decidir depois" · +55 bloqueado por meses (o +1 é ativo único e insubstituível).

## A estratégia em uma frase

Stevi vence emprestando confiança que ainda não tem: todo produtor chega por um
humano que vouча (técnico, parceiro, balcão de armazém, vizinho) — nunca por
número frio; agrônomos são CLIENTES (pagam por lead), coops/revendas são
DISTRIBUIÇÃO (Stevi devolve o produtor pros técnicos DELES).

## Posicionamento — "por que não os apps / a internet / o ChatGPT?" (16/jul)

**Quem é o produtor-alvo:** 5–50 ha de café (Caparaó/Sul de Minas), mais velho,
pouca paciência com tecnologia, WhatsApp = a internet inteira dele. Essa
realidade responde quase tudo:

- **vs. apps de agro** — ele não tem (e quando tentou: download, cadastro,
  senha, dashboard vazio pedindo que ELE digite dados). Todo app de agro faz o
  produtor trabalhar; a Stevi pede um pin e responde mensagem. As ferramentas
  reais dele são o técnico, o vizinho e o rádio — a Stevi não compete com eles,
  ela se pluga neles (chega vouchada, devolve o caso difícil pro agrônomo).
- **vs. dados grátis da web** — os dados da Stevi SÃO públicos; o produto é a
  MONTAGEM: seis fontes viram uma frase na língua dele ("✅ Pode pulverizar
  agora"). Ninguém calcula Delta-T da roça. E a web nunca liga pra ele — a
  Stevi avisa da geada ANTES.
- **vs. ChatGPT** — o ChatGPT não sabe ONDE ele está (sem pin → sem clima real,
  sem satélite DA lavoura dele, sem vazio do estado dele); receita produto e
  dose de bom grado (ilegal + perigoso — a Stevi é cercada: registro oficial,
  nunca dose, encaminha ao agrônomo); não lembra da operação (a Stevi acumula o
  caderno passivamente); nunca avisa nada; e termina em texto — a Stevi termina
  num humano com CREA. Nenhuma coop endossa "pergunta pro ChatGPT"; o
  cercamento é exatamente o que permite o vouch.

**Admissão honesta:** o Q&A puro ("qual adubo pro café?") é commodity — modelo
de fronteira responde igual (e usamos um por baixo). O moat NÃO é a IA; é
**distribuição** (chega por humano de confiança, no app onde ele já vive) +
**contexto** (pin, cultura, histórico — acumulando) + **cercamento** (a postura
legal que faz profissional endossar) + **proatividade** (fala primeiro quando
importa) + **rede de dois lados** (agrônomo paga pelo problema difícil, que
mantém grátis pro produtor). Cada peça é copiável sozinha; juntas e ganhas
produtor a produtor, são o negócio.

**Este posicionamento é a APOSTA que o scorecard testa** — não um fato: D7
vouchado alto = o argumento provado por comportamento; churn = a tese morre
honestamente. Por isso o próximo passo é campo, não código.

## As três correções estruturais (fan-out 13/jul)

1. **Template por tipo**: pitch de lead-gen é ameaça competitiva pra coop/revenda.
   → `PROSPECT_SEND_KINDS=agronomo,consultoria` (default em código) até o template
   de distribuição (`stevi_parceria_coop_v1`, submetido 13/jul, PENDING) aprovar.
2. **O precursor real de ban é invisível ao termômetro** (quem bloqueia não responde
   SAIR). → canário agora sonda `quality_rating`/`messaging_limit_tier` da Meta
   diariamente; latch: 2 pausas de saúde em 21 dias = disparo TRAVADO até humano
   limpar `dispatch_pauses`.
3. **Sinal de monetização precisa de um PEDIDO, não de uso.** Script no gatilho:
   lead nº 3 do Michel → "R$50 por lead aceito, continua?". Parceiros nº 2+ já
   entram com framing pago ("primeiros 10 grátis, depois R$50").

## Estrutura semanal

- **S1 (13–19/jul)** — armadura pré-disparo (feita, ver Status) + ligação Michel
  (segunda, roteiro abaixo) + tokens de origem por canal + kit do técnico
  (voice-note + cartão de contato .vcf "Stevi") + cartão de preço diário + cartão
  de geada armado. *Indicador: pin-rate de links vouchados ≥70%.*
- **S2–4** — replies da Vitória → calls de 15min → "pilote com 10 produtores";
  1 manhã de armazém/sem; prompt de indicação pós-momento-de-vitória; parceiros
  nº 2–3 promovidos dos replies agronomo. *Gate S4: D7 vouchado ≥30% = replicar;
  <20% = congelar aquisição e consertar produto.*
- **S5–8** — 8–12 pedidos pagos (R$50 → sondar R$100–150); Boletim do Consultor
  semanal; matar 2 piores canais por D7 agrupado; memo do dia 60 contra o
  scorecard. *Cláusula pré-comprometida: +30 dias SE o primeiro endosso de coop
  chegar depois da S5 (a janela mede o produto na pior estação dele — colheita).*

## Scorecard pré-registrado (aprovado 13/jul — não renegociável pela semana 8)

- **Venture:** D7 vouchado ≥40% (n≥20) · ≥3 parceiros com PIX real (≥1 repetiu)
  · ≥1 corrente de indicação produtor→produtor espontânea · número GREEN.
- **Negócio:** D7 20–40% · ≥1 parceiro pagando de forma confiável · crescimento
  manual mas unit-positive.
- **Matar/pivotar:** D7 <15% (n≥30) apesar de presença de campo · 0 pagantes após
  10 leads entregues · número morre 2× (latch).
- **Regras de leitura:** nenhuma métrica decide abaixo do piso de n (D7: coorte
  ≥15; reply-rate: ≥100 envios por segmento; golden: ±5pp é ruído). Coortes de
  cartão/armazém são população separada das vouchadas. Covariável sazonal vai no
  primeiro parágrafo do memo.
- **Tripwire semanal:** commits > conversas-com-produtores = campanha fora dos
  trilhos; o conserto nunca é mais código.

## Regras operacionais (pré-comprometidas)

1. `PROSPECT_DAILY_CAP` só é usado com valor **0** (freio de emergência). Nunca
   para subir o cap na mão.
2. Template pausado pela Meta → **não** submeter variante na mesma semana.
3. Latch engatado → religar é decisão humana com investigação, nunca reflexo.
4. Nunca publicar o número cru: sempre cartão .vcf + link wa.me tokenizado +
   voz de quem voucha.
5. Anti-canal: tráfego pago frio pro +1 — proibido até o +55 existir.
6. Fundador lê a primeira sessão de todo produtor novo em <24h, os 60 dias todos.

## Roteiros

**Ligação Michel (segunda 14/jul, 20 min, voz):** diagnosticar os 4 leads parados
sem culpa → ele responde os templates NA HORA (isso libera os dossiês) → Stevi
re-consenta os 4 produtores antes → acordo parceiro-fundador: leads do Caparaó
grátis até ago em troca de (1) SLA 48h de contato, (2) verificação do golden set
(15 min/sem — ele é o QA agronômico), (3) testemunho após 1º fechamento, (4) 2
intros (coop + revenda), (5) convidar a carteira dele pra Stevi (densidade = os
leads futuros DELE). Meta: 1 visita marcada até sexta. Pergunta de preço SÓ
depois do 1º fechamento: "R$50 por produtor aceito a partir do próximo — continua?"

**Domínio:** `stevi.com.br` = registrado porém EXPIRADO (evento de expiração
25/mai/2026, status inactive — vigiar o processo de liberação do registro.br).
**Comprar agora: `stevi.agr.br` (disponível em 13/jul, RDAP 404)** — registro.br,
CPF serve, ~R$40/ano. Depois: página-verificador (número +1 exibido, responsável,
CREA do Michel, contato LGPD) e apontar. Passos: registro.br → criar conta com
CPF → buscar stevi.agr.br → adicionar → pagar (PIX) → DNS: apontar pra Vercel.

**Kit do técnico:** voice-note dele (roteiro pronto no relatório de growth) +
cartão .vcf "Stevi - Assistente do Cafeicultor" + link wa.me com token
`vim pelo [nome]`. Nunca o número cru.

## Status da armadura (13/jul, antes do 1º disparo)

- [x] Sonda de quality_rating/messaging_limit no canário
- [x] Latch de pausas (migração `dispatch_pauses` aplicada; episódios com dedup 48h)
- [x] Gate de kinds no disparo (default agronomo,consultoria; bumps incluídos)
- [x] Template de distribuição coop/revenda submetido (PENDING na Meta)
- [x] Vitória: scripts de disclosure (é robô?), proveniência LGPD (de onde pegou
      meu número?) e explicação do +1
- [x] Canal de alerta testado ponta-a-ponta (WhatsApp founder OK em 13/jul)
- [x] Piso de tracking na saúde (envios pré-webhook não contam — evita pausa
      fantasma na 2ª-feira)
- [ ] `ALERT_WEBHOOK_URL` (canal independente do WhatsApp) — 5 min do fundador
- [ ] stevi.agr.br comprado (fundador) + página verificador (Claude, depois)
- [x] Tokens de origem + prompt de indicação + cartão de preço/geada (S1, Claude)
- [x] Colunas outcome/lead_grade + SLA 24h de lead parado (S1, Claude)
- [x] Cartão de contato .vcf "Stevi" do kit do técnico — endpoint `/api/vcard`
      (número via PUBLIC_WA_NUMBER; voice-note do técnico continua com o fundador)

## Divisão de trabalho

**Só o fundador:** Michel e todo parceiro (voz), manhãs de armazém, 10 conversas
de produtor/sem, pedidos de preço, leitura das primeiras sessões, compra do
domínio, ALERT_WEBHOOK_URL.
**Claude + OS:** todo o build acima, conversas da Vitória, missões noturnas
(agora apontadas pra alvos de técnicos + locais de armazém), briefs, canário,
golden, e o tripwire semanal de commits × conversas.
