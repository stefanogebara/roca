# Agente de voz por ligação — estudo de viabilidade (04/ago/2026)

Pedido do Stefano: avaliar agente conversacional por telefone (foco ElevenLabs)
para falar com leads B2B com voz natural e latência baixa. Pesquisa do agente
stevi-pesquisa-infra-apis (fontes no fim).

## Veredito em uma linha
Tecnologia pronta e barata (~R$300-450/mês para 100 ligações); o risco decisivo
NÃO é técnico — é que cold call por IA que se identifica é o pior quadrante
medido em experimento de campo (-80% de conversão), e no Brasil não se
identificar é indefensável (LGPD/CDC). O quadrante bom existe: LIGAÇÃO
ESPERADA (lead que já conversou com a Vitória e aceitou receber a ligação).

## O que o ElevenLabs Agents oferece
- Plataforma completa: agente + prompt + knowledge base (RAG) + function
  calling + telefonia (Twilio nativo OU SIP trunking próprio, G711/G722,
  número BR via provedor — EL não vende número) + batch calling.
- pt-BR real no Flash v2.5 (vozes BR nativas); SEM benchmark independente de
  CONVERSA pt-BR — piloto interno de 10 ligações antes de decidir.
- Latência: "75ms" é claim (só o TTS). Medição independente (Cekura): 1,73s
  p50 por turno completo — o MELHOR entre 6 plataformas, mas não é ChatGPT.
- Custo: ~US$0,08-0,12/min de agente + telefonia; ligação de 4 min entre
  US$0,35-0,55; 100 ligações/mês em torno de US$50-80 (~R$280-440).

## A engenharia da latência (por que ChatGPT parece instantâneo)
- Speech-to-speech nativo (gpt-realtime): áudio para áudio sem texto no meio,
  300-500ms até o primeiro som.
- Cascata otimizada (EL): STT, LLM e TTS com streaming em tudo + VAD/barge-in;
  bem feita fica em ~600-800ms — suficiente ao telefone, onde a própria rede
  PSTN soma 100-300ms. Orçamento: VAD 150-300 + STT 50-100 + LLM TTFT 150-400
  + TTS TTFA 100-200.

## Alternativas
- Pipecat (OSS, 13,4k stars, quickstart de bot telefônico pronto) e LiveKit
  Agents (SIP nativo) são os frameworks; Vapi/Retell (~US$0,07-0,33/min real)
  são gerenciadas; quase todas plugam EL como TTS.

## Brasil — o campo minado regulatório
- Prefixo 0303 (telemarketing ativo, INCLUI prospecção outbound na regra
  original): obrigatoriedade REVOGADA pela Anatel em ago/2025; MPF recomendou
  RESTABELECER em jan/2026. Instável — desenhar assumindo que volta.
- Risco prático maior: operadoras bloqueiam número com padrão robocall
  (chamadas curtas/massivas), independente do 0303.
- LGPD: gravação exige aviso + base legal documentada (legítimo interesse B2B
  defensável com LIA); voz é dado biométrico (sensível) em leitura corrente —
  minimizar retenção de áudio. Não há lei "declare-se robô", mas transparência
  LGPD + CDC tornam esconder indefensável.

## Arquiteturas (100 ligações de 4 min/mês)
- A) EL Agents + Twilio — zero infra nossa; Vercel só recebe webhooks e grava
  no Supabase. ~US$50-80/mês. 1 semana até piloto. ESCOLHA PARA PILOTO.
- B) Retell/Vapi com voz EL — ~US$30-55 + telefonia; melhor analytics de
  outbound; mais um vendor.
- C) Pipecat self-host (Fly ~US$6 + Telnyx + Deepgram + EL) — ~US$25-45/mês
  mas 2-4 semanas de engenharia; só depois de A provar valor.
- Restrição de base: Vercel serverless NÃO sustenta a mídia da chamada
  (WebSocket de minutos). Vercel/Supabase ficam com webhooks e persistência.

## Eficácia — a parte que decide
- Luo et al. 2019 (Marketing Science, 6.200 ligações reais): bot NÃO revelado
  vende como vendedor proficiente; revelado NO INÍCIO, -79,7% de compras;
  revelado ao FINAL, sem efeito. Disclosure é decisão de desenho.
- Mercado (vendors, com sal): IA não melhora connect rate; humano converte
  mais por discagem; híbrido IA+humano reporta o melhor pipeline.
- Implicação Stevi: cold call por IA identificada é o pior quadrante. O
  quadrante bom é a ligação ESPERADA: lead que respondeu à Vitória no WhatsApp
  e aceitou "te ligo amanhã às 10h" — disclosure sem surpresa, IA qualifica e
  agenda, humano fecha.

## Recomendação (estrategista)
1. NÃO construir cold call por IA agora — três vetos independentes: Luo et
   al., 0303 instável, e agosto/colheita (ninguém atende).
2. QUANDO houver leads respondendo no WhatsApp: piloto com a Opção A no
   quadrante "ligação esperada" (10 ligações internas de teste de pt-BR
   primeiro; a conta ElevenLabs do Stefano entra aqui, com chave gerada por
   ele).
3. A tese de voz mais forte pro Stevi talvez nem seja prospecção: é ATENDER
   PRODUTOR (voice-first já é tese do produto — cafeicultor prefere falar a
   digitar). Ligação inbound/esperada de produtor não tem 0303, não tem cold
   pressure, e o disclosure é da casa. Reavaliar quando a demanda real de
   produtor existir (plano 2026-08-04-estrategia-prospeccao).

## Fontes
ElevenLabs docs (SIP trunking, models) - Cekura (pricing/benchmark 1,73s p50)
- Softcery (12 plataformas; S2S vs cascata) - Prompt Bench (latency budgets) -
OpenAI gpt-realtime - pipecat-ai/pipecat + quickstart-phone-bot - Anatel 0303
+ Agencia Brasil (revogacao ago/2025) + MPF (recomendacao jan/2026) - Khomp
(gravacao x LGPD) - Telnyx BR - Rhino (AI vs human SDR) - Luo et al. 2019,
Marketing Science 38(6), DOI 10.1287/mksc.2019.1192.
