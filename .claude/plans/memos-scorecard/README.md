# Memos do PM do Scorecard — voo de 60 dias (13/jul → 11/set/2026)

Append-only. Semana mais recente no topo. Cada seção segue o template do
`.claude/agents/stevi-pm-scorecard.md`.

---

## Semana de 27/jul — dia 15 de 60

**Tripwire:** **TRIPWIRE DISPARADO** — 38 commits (7 dias) × **0** conversas de
produtor externo. Pior que a leitura anterior: dos "2 ativos em 7 dias" que a
query bruta mostra, nenhum é produtor — são o founder (Stefano, `cloud`) e o
número de sistema `WhatsApp Business` (+1646…). Excluindo teste/founder/sistema,
zero seres humanos externos escreveram para a Stevi na semana.

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
| Prospecção: enviados/replied | 29 enviados vida toda / **0 replied** | funil **PARADO** desde 21/jul (`PROSPECT_DAILY_CAP=0`), nenhum envio novo na semana |

`farmer_alerts`, `triage_events` e `ndvi_readings` seguem zeradas — não porque
os pacotes de retenção/moat não foram construídos (foram, ver abaixo), mas
porque não houve uma única conversa real de produtor para acioná-los. Engenharia
correu na frente do funil, exatamente o que o tripwire existe para pegar.

**Lead quente:** nenhum. `prospects.status='replied'` = 0 linhas. O único
contato externo (Gaia Tech) mandou 1 mensagem em 17/jul, recebeu a resposta
automática do bot 4 segundos depois, e não houve nenhuma mensagem humana de
follow-up registrada desde então — 10 dias parado.

**Mudou no repo:** semana com o maior volume de engenharia da campanha (38
commits, 20-26/jul): **+55 registrado E verificado** (26/jul — a pendência de
"semanas" do roadmap fechou em um OTP), Pacote A (confiabilidade: timeouts,
alertas de crash, escritas honestas), Pacote B (retenção channel-aware),
Pacote C (moat: `triage_events`/`ndvi_readings`/caderno — construído mas sem
uso), viral loop dos cards (wa.me + HMAC), 3 copy fixes da landing, treino da
Vitória (gym, 6 personas, disclosure de IA) e 11 iterações do loop de pesquisa
de curadoria. A prospecção continua travada desde 21/jul — nenhuma religada.

**Decisões abertas (dias parados):**
- Memo tese de receita + beachhead (lead-gen vs caderno/crédito; café vs
  hortifruti) — parado desde **16/jul → 11 dias**.
- Ler o error code de 21/jul no WhatsApp Manager (discrimina #131049 de
  #130497) — parado desde **21/jul → 6 dias**; o sistema não consegue mais
  recuperar isso pela API, só o painel resolve, 15 min do founder.
- CNPJ — listado como "iniciar esta semana" em 25/jul, sem evidência de
  início → **2 dias** (mas efetivamente parado desde que virou item do
  roadmap; nenhum commit ou doc novo menciona progresso).
- Acordo escrito com Michel + assinatura dos 36 casos golden — sem evidência
  de que tenha saído do papel → **≥2 dias** (item do roadmap de 25/jul).
- Envs `FOUNDER_NOTIFY_TO` e `WHATSAPP_TEMPLATE_ALERT` na Vercel — ainda em
  branco no `.env.example` local; não tenho como confirmar o estado real na
  Vercel neste memo → **≥2 dias**, marcar "não medido" quanto ao valor em
  produção.
- Follow-up humano no único usuário externo real (Gaia Tech) — **10 dias**
  parado (17/jul), sem resposta manual registrada.

**Chip +55 sai da lista — resolvido em 26/jul** (registrado + `VERIFIED` na
Cloud API). Não é mais decisão aberta.

**As 3 prioridades da semana:**
1. **Parar de construir e ir a campo.** Zero conversas de produtor em 7 dias
   com 38 commits no período — o próprio roadmap já previa isso ("congelar
   engenharia exceto Pacote A e religada segura"). Prioridade única de fato:
   founder fala com produtores/parceiros (manhã de armazém, follow-up Gaia
   Tech, ligação Michel) — não mais código.
2. **Fechar o Gate 1 do post-mortem (15 min).** Ler o error code de 21/jul no
   WhatsApp Manager. Sem isso a religada da prospecção não pode ser decidida
   com segurança, e é a única peça que falta para transformar H1/H1b de
   hipótese em fato.
3. **Decidir o memo de tese/beachhead.** Parado há 11 dias e bloqueia copy,
   prospecção e a própria leitura do scorecard (que beachhead conta para o
   D7?). Enquanto não sair, qualquer aquisição nova mede a coisa errada.

**O que NÃO fazer:** nenhum pacote novo de código, nenhuma religada de
prospecção sem o error code lido, nenhuma "iteração de pesquisa" adicional do
loop de curadoria — o roadmap já apontou retorno decrescente e a semana
confirma: pesquisa e infraestrutura estão muito à frente do funil que deveria
alimentá-las.
