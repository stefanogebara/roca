# Post-mortem (draft) — falhas pós-aceite no dispatch de prospecção, 21/jul/2026

**Status:** DRAFT para revisão do fundador. Escrito 25/jul com evidência fresca do
banco de produção + git log. O funil está em parada de emergência
(`PROSPECT_DAILY_CAP=0`) desde 21/jul. **Não religar antes de fechar este doc.**

## Resumo executivo

Em 21/jul, **16 de 16 envios de template falharam no callback de status** — a API
da Meta ACEITOU todos (16/16 têm `wamid`) e a entrega foi negada depois. A falha
atingiu os DOIS templates usados no dia (`stevi_parceria_coop_v1`: 11/11 e
`stevi_parceria_v2`: 5/5), todos **primeiro toque a número frio** (touches
prévios = 0 em todos). No dia anterior (20/jul), um `stevi_parceria_bump` para
contato já engajado **entregou normalmente**. O canário de hoje (25/jul) mostra
**qualidade do número GREEN** e todos os templates aprovados/íntegros.

A resposta operacional da época (re-sincronizar credenciais, commit 6605977) **não
é consistente com a evidência**: credencial quebrada falha na chamada da API (sem
wamid), não no callback pós-aceite.

## Linha do tempo

| Quando | Evento | Fonte |
|---|---|---|
| 10/jul | 12 × `stevi_parceria_bump` entregues OK | prospects (sent_at/send_status) |
| 13/jul | Outage #132000 (shape do template) → fix estrutural | commit 81de090, canary shape-check |
| 20/jul | 1 × bump entregue OK (contato já tocado) | prospects |
| 21/jul | **16 × primeiro-toque falham pós-aceite (2 templates)** | prospects: 16 failed, todos com wamid |
| 21/jul | Credenciais Cloud re-sincronizadas ("prod send outage fix") | commit 6605977 |
| 21/jul | `PROSPECT_DAILY_CAP=0` — parada de emergência | commits 18f2170, 4ad9de5 |
| 21-25/jul | Nenhum commit identifica causa raiz; digest sem linha de prospecção | git log, digest.ts |
| 25/jul | Canário: qualidade do número **GREEN**, 4 templates OK | canary_runs 25/jul 11:00 UTC |

Fatos adicionais do banco: `dispatch_pauses` está **vazio** (o termômetro de saúde
nunca engatou — cego abaixo de 20 envios na janela, e o cap manual o bypassa);
nenhum opt-out; **0 replies em 29 envios de toda a vida do funil**.

## Hipóteses, ranqueadas pela evidência

**H1 — Filtro de engajamento da Meta para templates de MARKETING a usuários frios
(erro típico: #131049 "…to maintain healthy ecosystem engagement"). PROVÁVEL.**
Assinatura bate ponto a ponto: aceite na API + negação na entrega; atinge só
marketing template para quem nunca interagiu; poupa o bump para engajado (20/jul);
**não rebaixa o quality_rating** (GREEN hoje). Número +1 novo, sem verificação de
negócio, mandando marketing frio internacional para BR é exatamente o perfil que
esse filtro estrangula. Nota: desde 2025 a Meta aplica "per-user marketing message
limits" — o destinatário frio pode estar no limite de marketing de OUTROS
remetentes, e o nosso é o descartado.

**H2 — Tier/limite do número US não verificado. POSSÍVEL, secundária.**
Só 16 envios no dia — longe do limite de 250 únicos/24h do tier inicial — mas
restrições específicas de número não-verificado para tráfego internacional frio
podem se manifestar igual à H1. Discriminar exige o código de erro exato.

**H3 — Credenciais. REFUTADA.** 16/16 com wamid = autenticação funcionou. O
re-sync de 6605977 não pode ter sido a causa nem a cura (não houve envio depois
para testar — cap=0 no mesmo dia).

**H4 — Template pausado/reprovado. REFUTADA.** Dois templates distintos falharam
simultaneamente; canário de shape e status dos 4 templates está verde desde então.

## O que falta para fechar (diagnóstico de 15 minutos, fundador)

1. **Ler o código de erro real**: Meta Business Manager → WhatsApp Manager →
   Insights/Message delivery do número, dia 21/jul. Se aparecer 131049 (ou
   "audience limit"), H1 confirmada. *(O sistema hoje DESCARTA o error code do
   callback — só grava `failed`. Correção obrigatória abaixo.)*
2. Conferir em Account Quality se há alguma restrição ativa no WABA que o
   quality_rating GREEN não mostra.

## Correções obrigatórias ANTES de religar (independem da hipótese)

1. **Persistir o código de erro do callback** (`prospects.wa_error` ou jsonb) —
   este post-mortem não pôde ser fechado porque o dado foi jogado fora.
2. **Circuit-breaker intra-dia**: N falhas pós-aceite em X horas ⇒ pausa
   automática do dia + registro em `dispatch_pauses` (o termômetro é cego <20
   envios e o episódio de 21/jul não deixou NENHUM rastro nele).
3. **Linha fixa no digest**: "Prospecção: PARADA (cap=0) há N dias" — o kill
   switch ficou invisível por 4 dias.
4. **Bump D+3 excluído para cooperativa/revenda** (1 linha) — hoje mandaria o
   pitch de lead-gen concorrente para o segmento de distribuição.
5. **Disclosure de IA na primeira mensagem da Vitória** — risco de denúncia →
   derruba o número inteiro (política Meta de experiência automatizada).
6. **Enum canônico de kinds** — prospects `coop`/`sindicato` presos em ready para
   sempre; CSV `consultoria` vira `revenda` e recebe template errado.
7. **`replied_at` + rollup por template** — sem isso o scorecard (≥100 envios por
   segmento) nunca será legível.

## Plano de religada (proposto — decisão do fundador)

- **Gate 0 (estratégico, antes de tudo):** decidir se cold-WA continua sendo
  canal. A evidência operacional é 0 replies/29 envios + o filtro da Meta
  estrangulando primeiro-toque frio; a tese do flight-plan ("nunca por número
  frio") e o roadmap apontam para: primeiro toque vouchado/voz, Vitória como
  follow-up de quem respondeu. Se cold-WA morre, a religada vira só bump/follow-up
  de contatos existentes — risco muito menor.
- **Gate 1:** código de erro de 21/jul lido e H1/H2 confirmada ou refutada.
- **Gate 2:** correções 1-7 acima deployadas.
- **Gate 3 (se cold-WA continuar):** número de prospecção SEPARADO do número do
  produto (segundo phone number no WABA) — um ban não pode matar a Stevi.
- **Religada:** cap=10 (não warming 20), 1 lote/dia por 3 dias, com regra de
  abort pré-registrada: >30% de falha pós-aceite no lote ⇒ para na hora, com o
  error code agora persistido.

## Lições (candidatas ao tasks/lessons.md ao fechar)

- Falha pós-aceite ≠ falha de credencial: **wamid presente = autenticação OK**;
  o remédio aplicado não correspondia ao sintoma.
- Todo callback de erro precisa ser PERSISTIDO — post-mortem sem error code é
  arqueologia.
- Kill switch manual precisa de: prazo, dono, lembrete diário e registro no
  mesmo sistema que o automático (`dispatch_pauses`).
- O silêncio de um monitor é evidência (2ª ocorrência do padrão — ver lição de
  17/jul): termômetro sem registro + SLA sem page = "tudo bem" falso.
