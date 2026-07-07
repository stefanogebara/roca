# Roça 🌱

Assistente agronômico brasileiro que vive no WhatsApp. **Triagem, não prescrição.**

Roça ajuda o produtor a entender a lavoura e saber o que perguntar — ele nunca
prescreve defensivos (isso é ato do engenheiro agrônomo, via receituário). Tudo
que ele afirma sobre agronomia é fundamentado (EMBRAPA/Agrofit/FRAC-BR) ou ele
diz honestamente que não sabe e encaminha para um agrônomo.

Este é o **Stage 0** do dossiê: o loop do WhatsApp ponta a ponta, com dois
caminhos que já entregam valor real.

## O que já funciona (Stage 0 + Stage 1)

- **Triagem de praga/doença por foto** (visão multimodal) com o handoff do
  receituário embutido.
- **Janela de pulverização** ("posso pulverizar hoje?") → veredito Delta T
  (go / atenção / não) com temperatura, umidade, vento e chuva (Open-Meteo).
- **Farm card no pin** — manda a localização e volta: solo (SoilGrids, com
  cache e fallback pra instabilidade do ISRIC), janela de pulverização agora,
  e situação do **vazio sanitário** do estado.
- **Vazio sanitário 2026/27 fundamentado** — janelas por UF da Portaria
  SDA/MAPA nº 1.579/2026 (fonte crua em `knowledge/`); estados com subdivisão
  regional recebem resposta com ressalva; UF desconhecida = silêncio (nunca
  inventar).
- **Áudio (voice note) PT-BR** — transcrição via modelo multimodal e o
  transcript segue o fluxo normal.
- **Consentimento LGPD** na primeira interação (uma vez só) + `"apaga meus
  dados"` funcional.
- **Portão de conformidade** que bloqueia qualquer resposta com cara de
  prescrição (produto + dose) e a substitui por um encaminhamento seguro.

**LLM**: tudo via **OpenRouter** (uma chave, tiers por env):
`anthropic/claude-haiku-4.5` (roteador de intenção), `anthropic/claude-sonnet-5`
(raciocínio/visão), `google/gemini-2.5-flash` (transcrição de áudio).

## Arquitetura

```
WhatsApp (Twilio sandbox)
  → api/webhook.ts          (verifica assinatura, ack em TwiML vazio)
    → _lib/pipeline.ts      (normaliza → roteia → deriva → raciocina → gate → persiste)
      ├─ _lib/router.ts     (classificação de intenção, modelo barato)
      ├─ _lib/reason.ts     (Claude: visão / spray Delta T / Q&A geral)
      ├─ _lib/tools/        (deltaT.ts puro + weather.ts Open-Meteo)
      ├─ _lib/compliance.ts (portão de saída — anti-prescrição)
      └─ _lib/db.ts         (Supabase: users, farms, messages)
```

O transporte é abstraído em `_lib/transport/` (`TransportAdapter`). Hoje:
`TwilioAdapter`. Amanhã: um `CloudApiAdapter` (Meta) é um drop-in — o pipeline
não sabe qual provider está falando.

## Rodar os testes

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest — lógica Delta T + portão de conformidade
```

## Setup (Stage 0)

1. **Supabase**: crie um projeto, rode `supabase/migrations/0001_init.sql` no SQL
   editor. Copie a URL e a `service_role` key.
2. **Twilio WhatsApp Sandbox**: ative o sandbox no console Twilio, pegue o
   `Account SID`, `Auth Token` e o número `whatsapp:+1415...`. Aponte o webhook
   ("When a message comes in") para `https://<seu-deploy>/api/webhook`.
3. **Anthropic**: gere uma `ANTHROPIC_API_KEY`.
4. Preencha `.env` a partir de `.env.example` e faça deploy na Vercel
   (`vercel --prod`). Configure as env vars no projeto Vercel.
5. Do seu próprio celular, entre no sandbox (mande o código de join) e teste:
   - Foto de uma folha → triagem.
   - "posso pulverizar hoje?" → ele pede sua localização → veredito Delta T.

## Escopo (disciplina)

Isto **não** é: ERP de fazenda, marketplace de insumos, plataforma de sensores,
emissor de receituário. É triagem agronômica conversacional. Foco v1: **soja,
milho e pastagem**. Próximos estágios (onboarding "conhece minha terra" com solo
+ farm card, grounding Agrofit/EMBRAPA, café/citros, NDVI) no dossiê, Parte 10.

## Decisões travadas (dossiê Parte 11)

- **Culturas v1**: soja + milho + pastagem.
- **Transporte pós-sandbox**: direto para o WhatsApp Cloud API (sem camada não
  oficial). O adapter deixa isso plugável.
- **Voz**: entrada por áudio (ASR) no Stage 1; respostas em texto por enquanto.
- **Modelo de negócio**: ferramenta gratuita → referência para agrônomo. Por
  isso o consentimento já permite conectar o produtor a um agrônomo depois.
