# Stevi 🌱

Assistente agronômico brasileiro que vive no WhatsApp. **Triagem, não prescrição.**

Stevi ajuda o produtor a entender a lavoura e saber o que perguntar — ele **nunca
prescreve defensivos** (isso é ato do engenheiro agrônomo, via receituário). Tudo
que ele afirma sobre agronomia é fundamentado (EMBRAPA / Agrofit-MAPA / FRAC-BR /
Fundecitrus) ou ele diz honestamente que não sabe e encaminha para um agrônomo.
Essa honestidade é o produto, não uma limitação.

> **Nome:** o produto é **Stevi** para o produtor. Os identificadores de infra
> (pasta do repo, projeto Vercel/Supabase `roca`, domínio `roca-black.vercel.app`)
> seguem como `roca` — invisíveis pro produtor; renomear o domínio exigiria
> reconfigurar o webhook. Trocar depois é barato.

## O que funciona (verificado em produção)

| Caminho | O produtor manda… | Stevi responde |
|---|---|---|
| **Triagem por foto** | foto de uma folha/praga | ID provável + confiança honesta, fundamentado no Agrofit, com o handoff do receituário |
| **Janela de pulverização** | "posso pulverizar hoje?" + localização | veredito Delta T (✅/⚠️/🚫) de temperatura, umidade, vento e chuva, + melhor janela hoje |
| **Farm card no pin** | a localização | solo (SoilGrids), clima agora, e o **vazio sanitário** do estado — "ele conhece minha terra" |
| **Saúde da lavoura (satélite)** | "como está minha lavoura?" | leitura de **NDVI** (Sentinel-2) do vigor da vegetação no seu ponto, com leitura honesta |
| **Captura de cultura** | "planto soja e milho" | anota as culturas no perfil da fazenda |
| **Áudio** | um áudio (voice note) | transcreve em PT-BR e responde normalmente |
| **Q&A geral** | dúvida de manejo | resposta fundamentada (MIP) ou "procure um agrônomo" honesto |
| **Encaminhamento** | "me indica um agrônomo" | registra o interesse (consentido) e orienta o que levar ao agrônomo |
| **LGPD** | "apaga meus dados" | apaga tudo, na hora |

**Culturas fundamentadas no Agrofit:** soja, milho, pastagem, **café** e **citros**
(ferrugem, ferrugem asiática, lagarta-do-cartucho, greening/HLB, cancro cítrico, …).

**Guarda-corpos:**
- **Prime directive** — nunca inventar agronomia. Sem base → "procure um agrônomo".
- **Portão de conformidade** — bloqueia qualquer resposta com cara de prescrição
  (produto + dose) e a substitui por encaminhamento seguro.
- **Grounding Agrofit** — respostas de praga citam o registro oficial (ingredientes
  ativos registrados, sem dose), não a memória do modelo.
- **LGPD** — consentimento na 1ª interação (uma vez), dados mínimos, exclusão funcional.
- **Rate limiting** — 15 msgs/60s por número, com aviso único e sem loop de resposta.

## Arquitetura

```
WhatsApp  ──(Twilio sandbox  |  Meta Cloud API)──►  api/webhook.ts
   │  corpo lido cru (bodyParser off) → assinatura verificada → adapter por formato
   ▼
_lib/pipeline.ts   normaliza (ASR) → rate-limit → roteia → deriva → raciocina → gate → persiste
   ├─ transport/     TwilioAdapter + CloudApiAdapter (mesma URL, drop-in)
   ├─ router.ts      classificação de intenção (tier barato)
   ├─ reason.ts      visão 2-passos (ID→Agrofit→resposta) / Delta T / NDVI / Q&A
   ├─ farmcard.ts    solo + clima + vazio sanitário no pin
   ├─ transcribe.ts  áudio PT-BR
   ├─ compliance.ts  portão de saída anti-prescrição
   ├─ tools/         deltaT · weather · soil · geo · calendar · agrofit · crops · ndvi
   └─ db.ts          Supabase: users · farms · farm_derived · messages · monitor_runs · referral_requests

api/cron/monitor.ts  1×/dia — transições de vazio sanitário + validade do calendário
```

O transporte é abstraído em `_lib/transport/`. **Twilio e Meta Cloud API coexistem
na mesma URL** — o webhook escolhe o adapter pelo formato da requisição, então virar
pro Cloud API é só apontar o webhook da Meta pra cá (sem redeploy). O compute é
stateless por mensagem; o estado vive no Supabase.

**LLM via OpenRouter** (uma chave, tiers por env): `anthropic/claude-haiku-4.5`
(roteador), `anthropic/claude-sonnet-5` (raciocínio/visão), `google/gemini-2.5-flash`
(transcrição).

## Site

Landing page em `web/` (estática, pt-BR, sem build) — copiada pra `public/` por
`node scripts/build-web.mjs` e servida na raiz do domínio, ao lado das funções `/api`.

## Testes & verificação

```bash
npm install
npm run typecheck        # tsc --noEmit  (~5s)
npm test                 # vitest: deltaT, compliance, calendar, agrofit,
                         #         twilio-signature, cloud, crops, referral
node scripts/simulate-inbound.mjs "posso pulverizar hoje?"   # inbound Twilio assinado
node scripts/simulate-inbound.mjs --location=-12.5,-55.7     # pin → farm card
node scripts/simulate-inbound.mjs --media-url=<img> --media-type=image/jpeg
```

Filosofia: lógica pura é testada em unidade; o comportamento é verificado **ao vivo**
contra o webhook em produção + as linhas no Supabase (o simulador assina requisições
Twilio reais). Documentação completa em [`docs/`](./docs/).

## Setup

1. **Supabase** — crie o projeto e rode as migrações (`supabase db push`).
2. **Twilio WhatsApp Sandbox** — ative, pegue `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`,
   e aponte "When a message comes in" para `https://<deploy>/api/webhook`.
3. **OpenRouter** — gere `OPENROUTER_API_KEY`.
4. Preencha `.env` a partir de `.env.example`, configure as env vars na Vercel, deploy.
5. Do seu celular: entre no sandbox (`join <código>`) e teste foto, "posso pulverizar
   hoje?", um pin e um áudio.

Runbook detalhado (env vars, migrações, cron, transição pro Cloud API):
[`docs/deployment/`](./docs/deployment/).

## Escopo (disciplina)

**Não** é: ERP de fazenda, marketplace de insumos, plataforma de sensores, emissor
de receituário. **É** triagem agronômica conversacional, honesta sobre a linha da
prescrição. Próximo horizonte (dossiê Parte 10): NDVI/Sentinel-2, o warm-handoff real
pro agrônomo (com consentimento específico + DPA), e mais culturas.

## Decisões travadas (dossiê Parte 11)

- **Culturas**: soja, milho, pastagem, café, citros.
- **Transporte**: Twilio sandbox agora; Cloud API já implementado e plugável (mesma URL).
- **Voz**: entrada por áudio (ASR); respostas em texto.
- **Modelo de negócio**: ferramenta gratuita → encaminhamento pro agrônomo (lead-gen),
  nunca comissão por produto prescrito. O `referral_requests` já registra o opt-in.
