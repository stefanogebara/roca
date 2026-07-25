# Equipe de agentes da empresa — desenho self-improving (25/jul/2026)

Empresa: Stefano + Vitoria. Produtos: Stevi (foco), Seatable/Racha (equipe mkt-*
já existe e vira um "pod" irmão no mesmo padrão). Este desenho parte do inventário
real de loops feito na auditoria — não é um organograma aspiracional.

## O princípio (aprendido da própria auditoria)

A auditoria achou a regra de ouro do self-improving da forma dura:

- O ÚNICO loop 100% automático do repo (playbook da Vitória → system prompt de
  produção) é também o mais perigoso: aprende de texto controlado por prospects,
  sem rótulo de outcome, sem revisão, e é canal de prompt-injection.
- Os loops BONS (gym pareado, golden fail-closed, canário por transição) são os que
  medem com rigor e param num humano para a decisão.

**Portanto: agentes propõem com evidência; humanos aprovam com um clique; a
aplicação é versionada; o resultado é medido; a memória acumula.** Nenhum agente
auto-aplica mudança em produção. Auto-learning ≠ auto-apply.

## A espinha dorsal: um trilho único de aprendizado

Todo agente da empresa evolui pelo MESMO trilho (que já existe ~70% construído):

```
SINAL            →  AVALIAÇÃO           →  PROPOSTA        →  GATE HUMANO      →  APLICAÇÃO       →  MEDIÇÃO
eventos reais       gym pareado            diff versionado    painel/PR           versão ativa       métrica do scorecard
(conversas,         (juiz cross-family)    (pack, template,   (1 clique,          (style_packs,      (D7, reply-rate,
 outcomes,          golden set assinado    copy, código,      com evidência       templates,          golden rate,
 incidentes,        canário                caso golden,       anexada)            deploy)             SLA, custo)
 métricas)          funil por estágio      check de canário)
                                                                                        └── memória (lessons.md, wiki, golden set) ←┘
```

Peças que faltam no trilho (itens do roadmap 30d): outcome real de fazendeiro
(triage_events + sinal de retorno/silêncio), funil por template/estágio
(replied_at), juiz cross-family em TODOS os evals, e ações de promoção no painel
("promover conversa a caso golden", "aprovar learning").

## O roster (9 papéis, não 9 processos rodando)

Papéis = prompts de agente (`.claude/agents/` / `~/.claude/agents/`) + cadência.
Um papel pode ser um cron, um ritual semanal disparado por skill, ou um subagente
invocado sob demanda. Começamos com 4 (fase 0) e crescemos só quando um papel
provar valor.

| # | Agente | Missão | Sinal de entrada | Saída (sempre proposta, nunca auto-apply) | Cadência |
|---|---|---|---|---|---|
| 1 | **Guardião** (ops/SRE) | Nada quebra em silêncio | canário, digest, falhas de send, cap/latch, monitor_runs | Alerta com diagnóstico; post-mortem draft; novo check de canário + teste por incidente | diário (já existe ~60%: canário+digest; falta a disciplina incidente→check) |
| 2 | **Voz do Produtor** (CX) | O fazendeiro real realimenta o produto | conversas reais da semana, silêncios pós-triagem, falhas de intent, referrals | Candidatos a caso golden/persona; fixes de copy; "features que ninguém acha"; relatório de fricção | semanal (clonar o padrão prospect/learn para o lado produto — hoje ZERO outcome real entra no sistema) |
| 3 | **Treinador** (gym master) | Todo prompt da empresa evolui por champion/challenger | gym_runs, golden_runs, packs, prompt da Vitória versionado | Challenger + resultado pareado + recomendação de promoção (gate: golden ≥ campeão, juiz cross-family) | semanal, PAUSADO até o gate S4 para o lado Stevi (kill list) |
| 4 | **Coach de Prospecção** | Funil aprende de outcome, não de vibe | funil por template/estágio, threads rotuladas ganho/perdido, quality_rating | Learnings COM rótulo de outcome (pending até aprovação); candidatos a template v3; realocação de kinds | semanal, só com funil religado |
| 5 | **Pesquisador de Mercado** | Concorrência e canais como processo, não evento | On Agri/RAImundo/novos bots WA, canais (coop, EMATER, sindicato, rádio), preços | Delta mensal de posicionamento; trigger de reavaliação; prep de entrevistas de usuário | mensal + sob demanda |
| 6 | **PM do Scorecard** | O voo de 60 dias é medido toda semana | tração fresca do Supabase (D7, coortes, conversas/dia), git log, agenda dos founders | Memo semanal: métricas vs scorecard, **tripwire commits×conversas**, 3 prioridades da semana | semanal (segunda) — o agente que faltou nas últimas 2 semanas |
| 7 | **Revisor de Engenharia** | Diff arriscado tem olhos frios | PRs, mudanças em pipeline/transport/dispatch | Review de correção + segurança; bloqueio de CRITICAL | por PR (já existe: code-reviewer/security-reviewer; formalizar como gate) |
| 8 | **Cyber/LGPD** | Postura de segurança e papel legal em dia | superfícies públicas, secrets, RLS, LIA/RoPA, retenção | Auditoria trimestral; checklist pré-feature para dados novos; drafts de LIA/aviso | trimestral + por feature sensível |
| 9 | **Cronista** (memória) | O que aprendemos não evapora | fim de sessão/incidente/decisão | lessons.md; wiki (`~/.claude/wiki/pages/stevi/`); decisões com data; poda de docs stale | contínuo, barato |

**Pod irmão (Seatable/Racha):** a equipe mkt-* existente (strategist → creative →
copywriter → AI director → editor) já segue o padrão pipeline-com-gate-humano.
Integração: ela ganha o mesmo trilho (versão + medição de performance por post +
memória) e o Cronista/Pesquisador servem os dois produtos.

## Como cada área que você citou é coberta

- **UI** → Voz do Produtor (fricção real) + Treinador (copy A/B via packs) +
  Revisor (quando virar código). Redesigns ficam atrás do gate S4.
- **Pesquisa** → Pesquisador de Mercado (mensal) + deep-research sob demanda.
- **Produto** → PM do Scorecard (semanal, com tripwire) + Voz do Produtor.
- **Cliente** → Voz do Produtor (produtores) + Coach de Prospecção (parceiros).
- **Prospecção** → Coach de Prospecção, com os guard-rails do roadmap (disclosure,
  número separado, learnings rotulados e pendentes de aprovação).
- **Arquitetura/erros** → Guardião (runtime) + Revisor (mudanças) + a regra
  incidente→check institucionalizada.
- **Cyber** → Cyber/LGPD trimestral + Revisor em todo PR sensível.

## Cadência operacional (a semana da empresa)

- **Diário (5 min, automático):** digest do Guardião no WhatsApp do founder — saúde,
  prospecção (incl. "PARADA há N dias" quando cap=0), leads estourando SLA, falhas.
- **Segunda (30 min, founders):** memo do PM do Scorecard + funil do Coach + fila de
  aprovações (learnings pendentes, candidatos a golden, promoções de pack). Founders
  decidem com cliques, não com leitura de log.
- **Sexta (15 min):** Voz do Produtor entrega o relatório da semana de conversas
  reais; 1-3 itens viram trabalho da semana seguinte se o tripwire permitir.
- **Mensal:** Pesquisador de Mercado (delta competitivo) + revisão da kill list.
- **Por evento:** incidente → Guardião abre post-mortem draft com as duas perguntas
  obrigatórias ("que check pegaria isso? que teste pina o fix?").

## Fases de implementação (subordinadas ao roadmap)

**Fase 0 — esta semana, zero infra nova (só prompts + ritual):**
- Criar os 4 agentes mínimos como arquivos de agente: Guardião, PM do Scorecard,
  Voz do Produtor, Cronista (os outros 5 esperam).
- PM do Scorecard roda já na segunda com queries frescas de tração (a lacuna nº1).
- Guardião assume o post-mortem do dispatch (pré-requisito da religada).
- Cronista consolida lessons.md + abre `wiki/pages/stevi/`.

**Fase 1 — 30d (junto com os pacotes do roadmap):**
- Outcome de fazendeiro entra no trilho (triage_events, retorno/silêncio,
  replied_at no funil) — destrava Voz do Produtor e Coach de verdade.
- Fila de aprovações no painel (learnings pendentes; "promover a golden").
- Juiz cross-family em todos os evals; prompt da Vitória versionado em packs.
- Golden parcial semanal (--limit 12) encadeado no monitor de segunda.

**Fase 2 — 90d (pós-gate, se o scorecard mandar continuar):**
- Champion/challenger para TODOS os prompts da empresa (Stevi, Vitória, mkt-*).
- Ativação de pack com gate duro (golden ≥ campeão registrado, lineage auditável).
- Pesquisador de Mercado e Cyber/LGPD entram na cadência plena.

## Anti-padrões (proibidos por lição própria)

1. **Auto-apply sem gate** — o playbook da Vitória provou o risco (injection).
2. **Juiz da mesma família do gerador** — o repo documenta e ainda viola 2×.
3. **Aprender de dado sem rótulo de outcome** — mineração de texto cru = ruído
   institucionalizado com verniz de aprendizado.
4. **Métrica derivada de regex sobre prosa** — sinal estruturado na origem.
5. **Fato herdado de resumo/compaction usado em promessa outbound** — query fresca
   sempre (lessons 17/jul).
6. **Agente gerando trabalho que viola o tripwire** — o PM do Scorecard existe
   exatamente para frear os outros agentes (inclusive o Claude).
