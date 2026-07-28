# Memos do PM do Scorecard — voo de 60 dias (13/jul → 11/set/2026)

Append-only. Semana mais recente no topo. Cada seção segue o template do
`.claude/agents/stevi-pm-scorecard.md`.

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
