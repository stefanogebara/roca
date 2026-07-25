# Tração real do Stevi — baseline do gate S4 (25/jul/2026)

Fonte: Supabase de produção (`roca` / ruuflfeqcmxpziernaop), queries frescas em
25/jul ~12h BRT. Sem PII: só agregados. SQL reutilizável no fim — é o insumo
semanal do agente **PM do Scorecard**.

## Os números (sem anestesia)

| Métrica | Valor | Leitura |
|---|---|---|
| Usuários totais | **10** | inclui testes dos founders (sem como separar — ver gap nº1) |
| Ativos últimos 7 dias | **0** | última mensagem de produtor: **17/jul** (1 usuário, 1 msg) |
| Ativos últimos 14 dias | 2 | — |
| Mensagens inbound (vida toda) | 84 | pico: 08/jul (40 msgs, 8 usuários — dia de lançamento/teste) |
| Com token de origem (vouchado) | **1** (`michel`) | a coorte que o scorecard mede tem **n=1** |
| Farms com pin | 3 (2 com cultura) | — |
| Caderno de aplicações | **0 registros** | o "wedge mais defensável" nunca foi usado por ninguém |
| Alertas proativos enviados | **0** (vida toda) | o loop de retenção NUNCA disparou uma vez (confirma o achado da auditoria: quebrado por construção) |
| Referrals | 5 (100% paradas) | ver abaixo |
| Parceiros | 1 (Michel) | — |

**Coortes D7** (proxy: voltou com nova mensagem entre 24h e 8 dias após o 1º contato):

| Coorte (semana) | Novos | Voltaram D7 | D7 | Vouchados | D7 vouchado |
|---|---|---|---|---|---|
| 06/jul | 9 | 1 | 11% | 0 | — |
| 13/jul | 1 | 0 | 0% | 1 | **0%** (n=1) |
| 20/jul | **0** | — | — | 0 | — |

**Leitura contra o scorecard pré-registrado:** o gate S4 (~10/ago) exige coorte
D7 vouchada com n≥15. Hoje n=1 e a entrada de novos usuários é **zero há 2
semanas**. O scorecard não está sendo alimentado — não é que os números estejam
ruins; é que **não existem números**. Restam ~48 dias da janela. Nas palavras do
próprio flight-plan: o conserto nunca é mais código — é pin-rate de links
vouchados, manhãs de armazém e o kit do técnico circulando.

## As 5 referrals paradas (a única demanda orgânica observada)

| Criada | UF | Cultura | Status | Parceiro notificado | SLA alertado |
|---|---|---|---|---|---|
| 08/jul | MT | soja+milho | new | nunca | nunca |
| 08/jul | SP | — | new | nunca | nunca |
| 09/jul | SP | — | new | nunca | nunca |
| 09/jul | SP | soja+milho | novo¹ | nunca | nunca |
| 10/jul | SP | soja+milho | new | nunca | nunca |

¹ Bug menor: status em dois idiomas (`new`/`novo`) — normalizar quando tocar no funil.

**15-17 dias esperando.** `partner_id` nulo em todas (nenhuma casa com o raio do
Michel), `sla_alerted_at` nulo em todas — **o monitor de SLA nunca pageou**, e o
silêncio dele foi tratado como "tudo bem" (a lição de 17/jul em `tasks/lessons.md`
previu exatamente isso). Ação do roadmap: recrutar 1 agrônomo soja/milho SP/MT ou
declarar fora do beachhead e responder honestamente aos 5 produtores.

## Prospecção (contexto do post-mortem ao lado)

- 192 prospects: 73 discovered · 90 ready · 17 contacted · 12 stale · **0 replied**
- Por kind: consultoria 73 · revenda 69 · cooperativa 40 · agronomo 6 · fazenda 4
- Envios (vida toda): 29 — **13 delivered / 16 failed** (todos os 16 em 21/jul)
- Opt-outs: 0 · Replies: **0** — o funil nunca gerou uma resposta sequer
- Detalhe: 12 dos 13 delivered foram `stevi_parceria_bump` em **10/jul** — ou
  seja, até o primeiro toque real com os templates novos (21/jul), quase tudo que
  tinha saído era bump. Reply-rate de cold-WA até agora: 0/29.

## Gaps de instrumentação (impedem o scorecard de ser lido)

1. **Sem como separar founder-teste de produtor real** — nem flag `is_test` nem
   token de origem retroativo. Os 10 users provavelmente incluem 2-4 testes.
2. **`messages.intent` vem NULL nas mensagens recentes** (9/9 dos últimos 14d) —
   a coluna que alimentaria "o que os produtores pedem" não está sendo carimbada
   em todos os caminhos.
3. **Coorte vouchada** depende de `users.source`, que só 1 usuário tem — o
   pin-rate ≥70% de links vouchados (indicador S1) não é mensurável hoje.
4. **`farmer_alerts` vazio** também significa: nenhum teste de ponta a ponta do
   canal de alertas jamais rodou em produção.

## SQL reutilizável (rodar toda segunda — agente PM do Scorecard)

```sql
-- 1. Visão geral
select
  (select count(*) from users) as users_total,
  (select count(distinct user_id) from messages where direction='in' and created_at > now() - interval '7 days') as ativos_7d,
  (select count(*) from applications) as caderno,
  (select count(*) from farmer_alerts) as alertas,
  (select count(*) from referral_requests where partner_notified_at is null) as referrals_paradas;

-- 2. Série diária (21d)
select date_trunc('day', created_at)::date as dia,
       count(*) filter (where direction='in') as msgs_in,
       count(distinct user_id) filter (where direction='in') as users_in
from messages where created_at > now() - interval '21 days'
group by 1 order by 1;

-- 3. Coortes D7 (proxy 24h-8d) com corte vouchado
with first_in as (
  select user_id, min(created_at) as first_at from messages where direction='in' group by user_id
), ret as (
  select f.user_id, date_trunc('week', f.first_at)::date as coorte,
    exists (select 1 from messages m where m.user_id=f.user_id and m.direction='in'
            and m.created_at >= f.first_at + interval '24 hours'
            and m.created_at <  f.first_at + interval '8 days') as voltou_d7,
    (select coalesce(nullif(u.source,''),'(sem)') from users u where u.id=f.user_id) as source
  from first_in f
)
select coorte, count(*) as novos, count(*) filter (where voltou_d7) as d7,
       count(*) filter (where source<>'(sem)') as vouchados,
       count(*) filter (where voltou_d7 and source<>'(sem)') as d7_vouchado
from ret group by coorte order by coorte;

-- 4. Funil de prospecção por template
select sent_at::date as dia, template_used, send_status, count(*)
from prospects where sent_at is not null group by 1,2,3 order by 1;

-- 5. Tripwire (comparar com `git log --since='7 days ago' --oneline | wc -l`)
select count(distinct user_id) as produtores_conversados_7d
from messages where direction='in' and created_at > now() - interval '7 days';
```
