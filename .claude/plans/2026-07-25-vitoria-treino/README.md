# Treino conversacional da Vitória — currículo e plano (25/jul/2026)

Objetivo: a Vitória (agente de prospecção B2B no WhatsApp) precisa CONVERTER —
levar um prospect de "respondeu" até "call de 15 min marcada" ou "piloto com 10
produtores" — sem nunca violar os hard rules (preço, promessas, disclosure).
Hoje: 0 replies em 29 envios; todo treino até aqui foi sintético e sem rótulo
de outcome. Este plano fecha isso.

## O funil que ela opera (e a meta por estágio)

```
template aprovado → REPLY → qualificação → avanço (call 15min | piloto 10 produtores) → HANDOFF founder
                    (meta: manter viva)   (meta: 1 pergunta por turno)  (meta: propor no turno 2-3)
```

Por segmento (alinhado ao flight-plan):
- **agronomo/consultoria** — pitch lead-gen: "produtores qualificados da sua
  região"; avanço = call; preço NUNCA (escala pro Stefano; parceiro nº2+ entra
  com framing "primeiros 10 grátis, depois R$50" — mas quem fala é humano).
- **cooperativa/revenda** — pitch distribuição: "devolvo o produtor pro SEU
  técnico, com dossiê pronto"; JAMAIS o pitch de lead-gen (concorrência).
  Avanço = call com o gerente técnico.
- **fazenda** — fora de escopo da Vitória; encaminhar pro fluxo produtor.

## As 12 habilidades do currículo (ordem de treino)

1. **Disclosure de IA na 1ª resposta** — "sou a assistente digital da equipe
   da Stevi" — natural, sem pedir desculpa. (Hoje: só se perguntam. Mudar.)
2. **Proveniência LGPD** — responder "de onde pegou meu número?" com a fonte
   real registrada no prospect (Google Places/indicação), sem inventar.
3. **Explicação do +1** — verdade sem promessa de prazo: "operamos com número
   internacional enquanto registramos o brasileiro".
4. **Qualificação em 1 pergunta/turno** — região de atuação, culturas,
   nº de produtores atendidos, dor atual (nunca interrogatório).
5. **Objeção "é golpe/robô?"** — admitir automação + âncora de verdade
   verificável (/verificar, CREA do responsável, site).
6. **Objeção "quanto custa?"** — hard rule: não cita preço; UMA frase de
   enquadramento ("modelo simples, o Stefano te explica em 5 min") + escala.
7. **Objeção "já tenho agrônomo/uso outro sistema"** — não competir: a Stevi
   ALIMENTA o técnico dele (dossiê/caderno), não o substitui.
8. **Objeção "manda material"** — mandar o link certo (1 só) + converter em
   micro-compromisso ("te chamo quinta pra ouvir o que achou?").
9. **Avanço de estágio no turno 2-3** — pedir a call/piloto cedo e de forma
   leve; detectar "sim social" vs compromisso real (data/hora).
10. **Silêncio e bump** — o que dizer no D+3 sem repetir o pitch (novidade
    concreta: card de geada da região, preço do café da semana).
11. **Handoff com contexto** — resumo de 3 linhas pro founder assumir sem ler
    a thread (quem, dor, estágio, próximo passo combinado).
12. **Encerramento digno** — "não tenho interesse" fecha com porta aberta e
    SEM bump futuro (marcar não-perturbar).

## Como treinar (usando a infra que JÁ existe)

1. **Versionar o prompt dela** na infra `style_packs` (hoje é string hardcoded
   em `agent.ts:61-99`) — pré-requisito de qualquer A/B honesto.
2. **Personas novas no prospect-gym** (`api/_lib/prospect/gym.ts`): cética-
   ocupada (coop), detector-de-golpe (revenda), gerente técnico curioso,
   agrônomo sobrecarregado, "manda material" crônico, compliance officer
   (pergunta LGPD). Cada persona com critério de VITÓRIA simulada = avanço de
   estágio sem violação.
3. **Juiz cross-family** (gemini via ROCA_JUDGE_MODEL — 1 linha em
   `prospect/gym.ts:224`) julgando PAREADO (champion vs challenger), com veto
   duro: citou preço, prometeu prazo do +55, não fez disclosure, pitch de
   lead-gen para coop.
4. **Métrica do gym**: % de simulações com avanço de estágio + 0 violações
   (não "nota de simpatia" 1-5 absoluta, que não detecta delta).
5. **Quando o funil religar**: rotular threads reais com outcome
   (replied → call → partner → optout) e minerar SÓ contrastando ganhas vs
   perdidas (o learn.ts atual mina sem rótulo — ruído com verniz).

## Sequência proposta (aguarda ok do usuário para código)

| # | Item | Tipo | Esforço |
|---|---|---|---|
| 1 | Disclosure de IA na 1ª resposta + template | prompt/copy | S |
| 2 | Prompt da Vitória versionado em style_packs | código | M |
| 3 | 6 personas novas + critério de avanço no gym | código/prompt | M |
| 4 | Juiz cross-family pareado no prospect-gym | código | S |
| 5 | Rodada de gym baseline → coaching → re-rodada | operação | S |
| 6 | (pós-religada) rótulo de outcome + mineração contrastiva | código | M |

O passo 5 só faz sentido depois de 1-4; rodar gym no prompt atual repetiria o
"teatro" que a auditoria apontou (nota absoluta, juiz da mesma família).
