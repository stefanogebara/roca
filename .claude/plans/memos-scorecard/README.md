# Memos do PM do Scorecard — voo de 60 dias (13/jul → 11/set/2026)

Append-only. Semana mais recente no topo. Cada seção segue o template do
`.claude/agents/stevi-pm-scorecard.md`.

---

## Semana de 03/ago — dia 22 de 60

*Covariável sazonal: início de agosto cai na janela de colheita/pós-colheita do
café em Minas — o próprio flight-plan já previa que essa é "a pior estação"
para adoção (produtor ocupado no campo, menos tempo de tela). Não é desculpa
para os números abaixo, é o contexto que os founders pediram no topo do memo.*

**TRIPWIRE DISPARADO** — **50 commits** (7 dias, `git log --since="7 days ago"`)
× **0 conversas reais de produtor externo**. A query bruta de "ativos 7d"
devolve 9, mas nenhum é produtor: são 1 `Simulador Roca` (teste) + 8 respostas
**automáticas de atendimento** de revendas/cooperativas que a Vitória
prospectou via cold outreach B2B (bots de menu "digite 1 ou 2", mensagens de
horário de funcionamento, saudação padrão) — nenhum humano de produtor
escreveu pra Stevi esta semana. É a 2ª semana seguida de tripwire disparado
neste memo (27/jul: 51×0; hoje: 50×0) — o padrão não é um pico, é o regime.

**Calendário:** dia **22 de 60** · **39 dias** até 11/set · **7 dias** até o
gate S4 (~10/ago). O gate exige coorte D7 vouchada com n≥15; hoje n=**1**
(Gaia Tech, inalterado desde 25/jul). Em 7 dias, partindo de n=1 e com zero
produtor novo vouchado nas últimas 3 semanas, o gate S4 não tem como ser lido
com o piso de n definido em 13/jul — isso por si só é uma decisão que precisa
ser encarada, não só medida (ver prioridade 1).

**Tração (total / externos reais):**

| Métrica | Total | Externos reais |
|---|---|---|
| Usuários | **18** (+8 vs 27/jul) | **1** (Gaia Tech — inalterado desde 25/jul; os +8 são bots de atendimento de revendas/coop prospectadas, não produtores) |
| Ativos 7 dias | 9 | **0** (1 Simulador Roca + 8 bots de atendimento B2B) |
| Caderno de aplicações | 0 | 0 (inalterado desde sempre) |
| Alertas proativos (vida toda) | 0 | 0 (inalterado desde sempre) |
| `triage_events` | 0 | — segue vazia |
| `ndvi_readings` | 0 | — segue vazia |
| Coorte D7 vouchada | n=1, D7=0% | **n insuficiente** (piso: 15) |
| Coorte "27/jul" (8 novos) | 0% D7, 0 vouchados | **ruído, não é coorte de produtor** — são os mesmos 8 bots de atendimento; a query genérica de coorte não distingue produtor de prospect que respondeu automaticamente. Mesma classe de erro da correção de 25/jul (referrals de teste): decompor por identidade ANTES de usar em estratégia. |
| Prospecção: enviados vida toda | 47 (+10 vs 27/jul: 37→47) | 23 delivered · 9 read · 13 failed · **1 replied** |

O 1 `replied` (revenda, prospect de cooperativa/revenda, template
`stevi_parceria_coop_v2`, 28/jul) **não é lead** — é um humano (atendente)
recusando: "nós trabalhamos somente com produtos pecuários, agrícola não
trabalhamos". Prospect corretamente marcado `discarded`. Reply-rate real desta
semana: 1/47 ≈ 2% — e mesmo assim **n insuficiente** (piso: 100 envios/segmento)
para qualquer leitura.

**Achado operacional (não é decisão de founder, é fato observado):** o bloqueio
de billing (#131042, "business eligibility payment issue") que zerava toda
entrega em 27/jul **está resolvido** — 23 delivered + 9 read nos envios de
28-31/jul confirmam. Os novos motivos de falha são `131026 Message
undeliverable` (dominante, ~12 casos) e, uma vez, `131049 This message was not
delivered to maintain healthy ecosystem engagement` — a mesma assinatura do
limite per-user de marketing da Meta que a pesquisa de 25/jul já tinha
identificado como H1 (confirma: **+55 antes de qualquer marketing** continua
sendo o caminho, não mais código no número atual). Nenhum envio novo registrado
de 01 a 03/ago — não sei dizer se é pausa deliberada, cap atingido ou outro
bloqueio; **não medido**, sinalizo para o founder confirmar.

**Lead quente:** **nenhum.** `prospects.status='replied'` = 0 linhas (o único
`send_status='replied'` virou `discarded` — ver acima). O único contato externo
real da vida do produto (Gaia Tech) segue sem follow-up humano — **17 dias
parado** desde 17/jul.

**Mudou no repo (50 commits, 27/jul-03/ago):** quase todo o volume foi
instrumentação de prospecção e do gym/juiz — enriquecimento automático de
WhatsApp na fila de prospects, rotação de cidades na varredura, filtro de ICP
(autopeças/pet fora), painel do funil com qualidade de número e placar
pareado persistido, linguagem de founder no painel (jargão pro tooltip),
correções no juiz do gym (rubrica, piso de ruído, denominador honesto), e hoje
um resumo diário do lote de prospecção por WhatsApp pros founders (`notify`).
Zero commit tocou o produto que um produtor sente. É o mesmo padrão que o
tripwire existe para pegar: motor de prospecção cada vez mais blindado,
continuando a mandar mensagem pra revenda/cooperativa, zero produtor
conversando.

**Decisões abertas dos founders (dias parados, silêncio não é decisão):**
- CNPJ — "iniciar esta semana" listado em 25/jul, sem evidência de início →
  **9 dias**.
- Acordo escrito com Michel + assinatura dos 36 casos golden — sem evidência
  de progresso desde 25/jul → **9 dias** (ver decisão tomada em 03/ago abaixo).
- Envs `FOUNDER_NOTIFY_TO` e `WHATSAPP_TEMPLATE_ALERT` na Vercel — sem acesso
  para confirmar o valor em produção → **9 dias, não medido**.
- Follow-up humano no único usuário externo real (Gaia Tech) — **17 dias**
  parado desde 17/jul.

**Decidido em 03/ago (durante a leitura desta semana):** Stefano vai retomar
contato pessoal com Michel (Gaia Tech) pelo WhatsApp — não pela Stevi/robô,
seguindo a regra pré-registrada de 16/jul de que esse acordo não pode vir do
bot. Rascunho da mensagem preparado, cobrindo as duas frentes que estavam
paradas: (1) reengajar o único contato externo real, silencioso há 17 dias, e
(2) reabrir o acordo escrito + validação dos 36 casos golden, sem mencionar
preço (guard-rail: só depois do 1º fechamento, que ainda não aconteceu). Isso
é a ação de campo, não de engenharia, que a prioridade 2 desta semana pedia —
ainda depende do envio e da resposta dele para sair do "parado".

**Resolvido desde a última leitura:** ✅ billing da Meta (#131042) — entregas
voltaram a acontecer 28-31/jul (ver "Achado operacional" acima). Isso remove o
bloqueador técnico nº1 do memo anterior, mas não muda a leitura de fundo: com
o billing corrigido e ainda assim 0 produtor real conversando, o gargalo já
não é técnico, é campo.

**As 3 prioridades da semana:**
1. **Ir a campo, com 7 dias até o gate S4.** n=1 na coorte vouchada e nenhum
   produtor novo real em 3 semanas — o gate não tem número pra ler no piso
   pré-registrado (n≥15) se nada mudar até 10/ago. Isso precisa virar uma
   conversa explícita com os founders sobre adiar o gate ou aceitar a leitura
   "n insuficiente" em 10/ago — não uma surpresa no dia.
2. **Fechar o follow-up humano com Gaia Tech** (17 dias parado) — é o único
   dado de produtor real que existe; deixá-lo esfriar mais é desperdiçar o
   ativo mais barato de todos.
3. **Fechar as 3 decisões humanas paradas ≥9 dias** (CNPJ, acordo+assinatura
   golden com Michel, envs de notificação na Vercel) — nenhuma se resolve com
   código, e a resolução do billing prova que quando um bloqueio técnico é
   endereçado, o gargalo real (campo) fica exposto sem desculpa.

**O que NÃO fazer:** mais nenhum commit em prospecção/gym/painel esta semana —
50 commits produziram 1 reply, e esse reply foi um "não". Cold-B2B já rodou
n=47 com reply-rate ~2% (abaixo do piso pra decidir); investigar o novo erro
`131026` ou tentar "otimizar" o funil de novo é o mesmo movimento que o
tripwire já pegou duas vezes. A pergunta certa não é "como consertamos o
funil", é a que o roadmap de 25/jul já tinha aberto: cold-WA sobrevive à tese
"nunca número frio"? Essa é decisão de founder, não trabalho de engenharia.

---

## Semana de 27/jul — dia 15 de 60

*Nota: entre a primeira coleta deste memo e o push, o founder tomou a decisão
de tese/beachhead e a prospecção religou e voltou a pausar — tudo no mesmo dia
27/jul. Reconsultei o banco fresco (regra da casa: nunca reusar número
herdado) antes de fechar; os números abaixo são a leitura final do dia.*

**Tripwire:** **TRIPWIRE DISPARADO** — 51 commits (7 dias) × **0** conversas de
produtor externo. Pior que a leitura anterior: dos "2 ativos em 7 dias" que a
query bruta mostra, nenhum é produtor — são o founder (Stefano, `cloud`) e o
número de sistema `WhatsApp Business` (+1646…). Excluindo teste/founder/sistema,
zero seres humanos externos escreveram para a Stevi na semana — mesmo com um
lote real de prospecção disparado hoje à tarde.

**Calendário:** dia 15 de 60 · **46 dias** até 11/set · **14 dias** até o gate
S4 (~10/ago). O gate exige coorte D7 vouchada com n≥15; hoje n=1.

**Tração (total / externos reais):**

| Métrica | Total | Externos reais |
|---|---|---|
| Usuários | 10 | **1** (Gaia Tech, inalterado desde 25/jul) |
| Ativos 7 dias | 2 | **0** (os 2 são Stefano + número de sistema) |
| Novos usuários desde 25/jul | 0 | 0 |
| Caderno de aplicações | 0 | 0 |
| Alertas proativos (vida toda) | 0 | 0 |
| `triage_events` (criada 25/jul) | 0 | — ainda vazia: nenhuma conversa real desde a criação |
| `ndvi_readings` (criada 25/jul) | 0 | — idem |
| Coorte D7 vouchada | n=1, D7=0% | **n insuficiente** (piso: 15) |
| Prospecção: enviados/replied | 37 enviados vida toda / **0 replied** | religou hoje à tarde (cap 10, alvo cooperativa/revenda), falhou de novo e voltou a `PROSPECT_DAILY_CAP=0` |

`farmer_alerts`, `triage_events` e `ndvi_readings` seguem zeradas — não porque
os pacotes de retenção/moat não foram construídos (foram, ver abaixo), mas
porque não houve uma única conversa real de produtor para acioná-los. Engenharia
correu na frente do funil, exatamente o que o tripwire existe para pegar.

**Lead quente:** nenhum. `prospects.status='replied'` = 0 linhas. O único
contato externo (Gaia Tech) mandou 1 mensagem em 17/jul, recebeu a resposta
automática do bot 4 segundos depois, e não houve nenhuma mensagem humana de
follow-up registrada desde então — 10 dias parado.

**Mudou no repo:** semana com o maior volume de engenharia da campanha (51
commits, 20-27/jul): **+55 registrado E verificado** (26/jul), Pacotes A/B/C
(confiabilidade, retenção, moat de dados — construídos mas sem uso real),
viral loop dos cards, copy fixes da landing, treino da Vitória (gym, 6
personas), 11 iterações do loop de pesquisa. **Hoje (27/jul) o quadro virou
duas vezes no mesmo dia:** (1) o founder decidiu a tese — B2B2C institucional,
beachhead café — e a prospecção mudou de alvo (agora cooperativa/revenda,
`stevi_parceria_coop_v2`); (2) o post-mortem do dispatch de 21/jul FECHOU — a
causa raiz não era limite de engajamento da Meta como se suspeitava, era
**billing** (erro #131042, "business eligibility payment issue" — a conta não
tem forma de pagamento válida cadastrada). O primeiro lote real sob a nova
tese (8 envios) confirmou o diagnóstico ao falhar pelo mesmo erro, e a
prospecção voltou a `PROSPECT_DAILY_CAP=0`. Um filtro "fixo não recebe
WhatsApp" foi implementado e revertido no mesmo dia (era erro de inferência —
9 das 14 entregas bem-sucedidas da história eram para telefone fixo).

**Decisões abertas (dias parados):**
- **NOVA, urgente e bloqueia tudo:** adicionar forma de pagamento válida no
  Meta Business Manager (Configurações do Negócio → Faturamento) e associar à
  WABA. Sem isso, **nenhum template sai** — nem prospecção, nem alerta de
  geada/fogo. Achado hoje (27/jul), 0 dias parado, mas é o bloqueador nº1 a
  partir de agora.
- CNPJ — listado como "iniciar esta semana" em 25/jul, sem evidência de
  início → **2 dias**.
- Acordo escrito com Michel + assinatura dos 36 casos golden — sem evidência
  de que tenha saído do papel → **≥2 dias**.
- Envs `FOUNDER_NOTIFY_TO` e `WHATSAPP_TEMPLATE_ALERT` na Vercel — ainda em
  branco no `.env.example` local; não tenho como confirmar o estado real na
  Vercel neste memo → **≥2 dias**, "não medido" quanto ao valor em produção.
- Follow-up humano no único usuário externo real (Gaia Tech) — **10 dias**
  parado (17/jul), sem resposta manual registrada.

**Saíram da lista, resolvidas hoje:**
- ✅ Chip +55 — registrado + verificado (26/jul).
- ✅ Memo de tese/receita + beachhead — **decidido por Stefano em 27/jul**:
  B2B2C institucional (coop/sindicato/ATeG paga; produtor não), beachhead
  café; lead-gen R$50 com o Michel mantido só como instrumento de medida.
- ✅ Error code de 21/jul — não precisou mais do painel manual: o próprio
  sistema (correção deployada horas antes) capturou o erro real do primeiro
  lote religado e fechou o post-mortem (era billing, não #131049/#130497).

**As 3 prioridades da semana:**
1. **Cadastrar forma de pagamento válida na Meta hoje.** É o único motivo
   pelo qual zero mensagem proativa sai do número — prospecção E alertas de
   geada/fogo ficam mortos até isso ser resolvido. 5 minutos do founder,
   maior alavancagem da semana.
2. **Parar de construir e ir a campo.** 51 commits × 0 conversas de produtor
   em 7 dias. A tese já foi decidida — agora falta o que nenhuma engenharia
   resolve: founder em campo (Coocafé, ATeG/EMATER, follow-up Gaia Tech,
   Michel) testando o beachhead café/institucional que acabou de virar
   oficial.
3. **Fechar as 3 decisões humanas que sobraram:** CNPJ, acordo escrito +
   assinatura golden com Michel, envs de notificação na Vercel. Nenhuma
   delas se resolve com código; todas estão ≥2 dias paradas.

**O que NÃO fazer:** mais nenhum pacote de engenharia (moat, retenção, viral
loop já estão prontos e seguem sem uso por qualquer produtor real) e nenhuma
religada de prospecção antes do billing resolvido — repetir o lote sem
corrigir a causa raiz só queima mais prospects "ready" sem necessidade.
