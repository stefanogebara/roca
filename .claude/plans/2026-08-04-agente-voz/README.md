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

## Adendo (04/ago, noite) — os modelos chineses que o Stefano lembrou

Dois modelos distintos que se misturam pelo nome:
- **MiniCPM-o 4.5** (OpenBMB, open source, 9B): primeiro open source FULL-DUPLEX
  omni-modal — escuta enquanto fala, decide quando interromper/parar, tempo
  real. Vira o motor candidato da Opção C (self-host). Ressalvas: GPU dedicada
  (~US$150-400/mês, MAIS caro que EL gerenciado no nosso volume), pt-BR
  conversacional sem benchmark, turn-taking em português só se valida testando.
- **MiniMax Speech 2.6/2.8** (API fechada): voz ultra-humana, latência <250ms
  ponta a ponta, fração do preço do ElevenLabs — desafiante direto nas Opções
  A/B. Cotar os dois no piloto.

Os três vetos (Luo -80%, 0303, colheita) não dependem do motor de voz —
recomendação inalterada: ligação esperada e atendimento de produtor.

## Adendo 2 (04/ago, noite) — tour na conta real do Stefano (ElevenAgents)

- Plano CREATOR (US$22/mes, renova 28/ago), 5.356/300.000 creditos usados.
- JA INCLUI 250 min/mes de chamadas de agente + 10 concorrentes: o piloto de
  10 ligacoes pt-BR (~40 min) custa ~ZERO no plano atual. Excedente US$0,12/min
  (curiosidade: Pro/Scale pagam 0,08 no excedente — Creator e o degrau caro).
- Plataforma ElevenAgents separada da criativa (switcher no topo): Agents
  (templates + assistente "Architect"), Phone Numbers (importa Twilio/SIP,
  vazio hoje), analytics nativos (custo/conversa, LLM cost, success rate,
  CSAT, response time), config por agente com Workflow, Tools, LLMs, Knowledge
  Base, Evaluation.
- Conclusao operacional: quando o quadrante "ligacao esperada" tiver leads, o
  piloto nao exige nem upgrade de plano — so importar um numero Twilio BR e
  montar o agente. Barreira de custo: eliminada; os tres vetos de negocio:
  inalterados.


---

## Adendo 3 (04/ago, noite) — Estudo: voz nivel Sesame/GPT e o caminho pt-BR

Pergunta do founder: "quero voz igual Sesame/GPT — estude elas ou modelos open source".

**O que faz a Maya (Sesame) soar humana**: CSM — prosodia condicionada no contexto
da CONVERSA inteira (texto+audio dos dois lados), treinado em ~1M h de dialogo.
O CSM-1B aberto (Apache 2.0) e so a fundacao menor, **essencialmente ingles** —
nao serve pra pt-BR sem fine-tune caro. Nada novo aberto em 2026 (viraram app iOS).

**OpenAI gpt-realtime**: speech-to-speech nativo + conector SIP oficial (Twilio).
PORA: thread oficial (jun/2026) documenta qualidade FRACA em portugues ao telefone
(nomes errados, G.711 8kHz), vozes sem sotaque BR nativo. ~$0,05-0,12/min.

**Open source pt-BR (ago/2026)**: Chatterbox Multilingual v3 (MIT, pt-BR dedicado)
e o melhor TTS aberto; Kyutai TTS 1.6B agora fala pt; Qwen3-Omni e o unico
"gpt-realtime aberto" com pt (GPU parruda). Dia/CSM/Orpheus: ingles. Nenhum supera
EL Multilingual v2 + PVC em naturalidade pt-BR hoje.

**Dentro do EL**: v3 (audio tags, 70+ linguas) NAO roda em agentes/tempo real —
"v3 realtime" e roadmap sem data. Agents = Flash v2.5 / Multilingual v2.

**Veredito (ganho / custo / risco)**:
1. **Ficar no EL + PVC de voz brasileira REAL em tom de conversa** (a clonagem da
   Vitoria ja planejada e exatamente isso) + prompt de registro emocional. A maior
   parte do "soa dublado" vem da voz generica + texto do LLM, nao do motor TTS.
   Teto honesto: "humano bom de call center", nao Maya — prosodia contextual de
   conversa nao existe em produto comprado hoje.
2. Piloto paralelo OpenAI Realtime via SIP (50 ligacoes A/B) — SO depois do PVC,
   e com a queixa pt documentada em mente.
3. Rebuild Pipecat/LiveKit + Chatterbox/Qwen3-Omni: semanas de engenharia pra
   empatar com o que o EL ja da; so por custo em escala.

**Acoes aplicadas na hora**: prompt ganhou registro de giria (nunca forcar
regionalismo) e tom-acompanha-assunto (entusiasmo fora de hora soa falso).
**Acao founder**: gravar a Vitoria 1-3h em TOM DE CONVERSA (nao locucao) pro PVC.


---

## Roteiro de gravacao — clone da voz da Vitoria (05/ago)

O objetivo NAO e locucao bonita. E capturar a Vitoria FALANDO DE VERDADE —
sotaque, ritmo, risada, hesitacao. O clone herda o que ouvir.

### Setup (2 min)
- Celular serve. Gravador de voz normal, formato .m4a ou .wav.
- Comodo silencioso, SEM eco (quarto com cama/cortina > sala vazia). Janela
  fechada, ar e ventilador DESLIGADOS.
- Celular a ~20cm da boca. Volume de conversa normal.
- Teste de 15s, ouvir com fone: sem eco, sem estouro? Segue.

### O que gravar — minimo 3 min uteis (IVC); ideal 15-30 min (ja serve pro PVC)
Tom de CONVERSA, como no telefone com uma amiga. Pode errar, rir, pausar.
1. (2-3 min) Papo livre: como foi o dia, um caso engracado, um perrengue.
2. (2-3 min) Simulacao de ligacao (a parte mais valiosa): fingir que liga pra
   um parceiro da Stevi — se apresentar, perguntar como chegam clientes,
   reagir ("ah, entendi...", "que bom!"), se despedir.
3. (2-3 min) Numeros e termos por extenso em frases faladas: "a saca ta dois
   mil e quatrocentos", "amanha as quatorze horas", "arroba", "lavoura", "Stevi".
4. (1 min) Emocoes: uma frase animada, uma seria, uma risada de verdade.

### O que NAO fazer
- NAO ler texto corrido com voz de locutora — o clone sai "dublado".
- NAO gravar com musica/TV/gente ao fundo. NAO sussurrar nem gritar.

### Depois de gravar
1. Salvar os arquivos numa pasta (ex.: gravacoes-vitoria na home do Stefano).
2. Conferir na chave EL a permissao de ESCRITA em Voices (mesma tela dos
   webhooks) — sem ela o clone e bloqueado.
3. Mandar o caminho da pasta pro Claude, que roda:
   - npm run el:clone -- <pasta>  -> cria o clone + vitoria-clone-teste.mp3
   - os dois ouvem a amostra; aprovou ->
   - npm run el:clone -- <pasta> --aplicar  -> agente passa a falar com a voz dela
4. Ligacao de validacao no +55 11 5028-1932.

Consentimento: voz da Vitoria, cofundadora, gravada por ela pra este fim.
No PVC (30min+, qualidade maxima) o voice captcha tem que ser feito por ELA
no dashboard — agendar 10 min juntos.
