# Virada pro Cloud API — checklist

**Data:** 30/jul/2026

## A descoberta que muda o escopo

A virada **já aconteceu**. Não é um plano de futuro, é um inventário de dívida.

Evidência (não doc — dado):

| verificação | resultado |
|---|---|
| `select channel, count(*) from users` | **0 `twilio`**, 7 `cloud`, 8 null (anteriores à coluna) |
| `prospect_messages` inbound | 20 mensagens, última 29/jul 11:10 BRT |
| `pipeline.ts:1039` | grava `adapter.provider` em `users.channel` |
| logs Vercel, 24h | 54 invocações em `/api/webhook`, zero linha de `markRead` — porque não houve tráfego de madrugada, não porque o caminho esteja morto |

Ou seja: **todo inbound entra pelo Cloud API hoje.** O `CloudApiAdapter` recebe
produtor e prospect, `sendTemplate` já leva os disparos da Vitória, os status
callbacks já alimentam o termômetro de saúde do número.

O que o README diz — *"Transporte: Twilio sandbox agora; Cloud API já
implementado e plugável"* (linha 115) — está **velho**, e é o tipo de doc que
custa caro: eu mesmo concluí duas vezes a gravidade errada de um bug por
acreditar nele antes de perguntar ao banco.

**Então o trabalho restante não é virar. É descomissionar o Twilio e limpar o que
o hibridismo deixou pendurado.**

---

## 1. Corrigir os docs primeiro (mais barato, evita o próximo diagnóstico errado)

- [ ] `README.md:115` — trocar "Twilio sandbox agora" por Cloud como transporte
      ativo, Twilio como legado retido (ver §2 pra saber por que ele fica).
- [ ] `docs/deployment/README.md` §5 — hoje é *"(Optional) Meta WhatsApp Cloud
      API"*. Não é opcional, é o que roda. Trocar de "como ligar" pra "como
      está ligado", e mover o Twilio pra seção de legado.
- [ ] `.env.example:39-41` — documenta `WHATSAPP_FROM` como "fonte ÚNICA do
      número". **Nenhum código lê essa var.** A fonte real é `PUBLIC_WA_NUMBER`
      (`.env.example:52`). Remover a var fantasma ou apontar pra certa.

## 2. Twilio: o que ainda depende dele (NÃO desligue antes de checar)

- [ ] `api/twiml-otp.ts` — existe porque registrar número na Meta exige OTP por
      **voz**: a Meta liga, lê o código, o Twilio grava e transcreve (fixo BR de
      voz não recebe SMS). Se um dia trocar de número, **você precisa do Twilio
      de novo**. Desligar a conta é perder a ferramenta de registro.
- [ ] Confirmar que ninguém ainda conversa pelo sandbox. As 8 linhas com
      `channel = null` são anteriores à coluna e não dizem por onde entraram —
      então "zero `twilio`" cobre só o período com a coluna. Checar
      `messages` por wa_id dessas 8 antes de cortar.
- [ ] Env `TWILIO_*` fica. Custo zero mantendo, custo alto redescobrindo.

## 3. O que nunca foi exercitado e vai ser (ou já é, sem ninguém olhar)

- [ ] **`markRead`** — roda a cada inbound. A leitura de log é **assimétrica**, e
      isso é o que esconde falha aqui:
      - sucesso → **não loga nada** (silêncio é a boa notícia)
      - HTTP ruim → `markRead failed <status> (cosmetic, ignored)`
      - `this` perdido → `[bg] ERROR markRead lançou na chamada`
      Foi exatamente aqui que o bug de 29/jul morou 10h. Depois do fix
      (`c63ee02`) ele **ainda não foi exercitado em produção** — nenhum inbound
      desde 29/jul 13:00. A prova hoje é o teste unitário, não o tráfego.
- [ ] **`fetchMedia` é de duas etapas no Cloud** — Twilio entrega URL, Cloud
      entrega *media id* → URL temporária → bytes
      (`cloud.ts:391` vs `twilio.ts:231`). Retestar **foto e áudio**; voz é a
      entrada principal de quem não digita.
- [ ] **Janela de 24h** — resposta livre só dentro dela. Alerta fora exige o
      template UTILITY `WHATSAPP_TEMPLATE_ALERT`; sem ele `alerts.ts:110` lança
      *"fora da janela de 24h e sem template UTILITY configurado"*. Geada e fogo
      chegam de madrugada, que é precisamente fora da janela.
- [ ] **O portão do sandbox não existe mais.** O `join <código>` filtrava quem
      entrava. Agora qualquer número alcança o webhook, e o único freio é o rate
      limit de 15 inbound/60s do `pipeline.ts` — que é por usuário, não global.

## 4. O número público — a armadilha do site estático

`PUBLIC_WA_NUMBER` é lido em 7 lugares (`qr.ts`, `vcard.ts`, `verificar.ts`,
`cards/render.ts`, `growth.ts`, `pipeline.ts`, `contactCard.ts`), **cada um com
fallback hardcoded `'19705509125'`**.

- [ ] **`web/index.html` tem o número hardcoded em 4 lugares e é estático** — não
      lê env nenhuma. Trocar `PUBLIC_WA_NUMBER` e esquecer o site deixa a landing
      apontando pro número morto, que é o pior lugar possível pra isso.
- [ ] Os 7 fallbacks: se a env falhar em produção, tudo volta silenciosamente pro
      número americano. Considere `requireEnv` em vez de fallback — falhar alto é
      melhor que apontar pro número errado.
- [ ] O que já saiu não volta: QR impresso, `.vcf` compartilhado, cards antigos
      com rodapé, legendas de WhatsApp. Cards já enviados carregam o número
      antigo pra sempre.

## 5. Canário — já tem dente, vale saber ler

- [ ] `numberQualityCheck` (`canary.ts:146`) lê `quality_rating`,
      `messaging_limit_tier`, `name_status` da Graph API. `GREEN`/`UNKNOWN` é ok
      (`UNKNOWN` = número novo que a Meta não pontuou; não é alarme).
      `YELLOW`/`RED`/`FLAGGED` é alarme de verdade.
- [ ] `messaging_limit_tier` limita **destinatários únicos por dia** — é o teto
      real do disparo da Vitória, independente do cap interno.
- [ ] `templateChecks` (`canary.ts:176`) checa **shape além de status**, por causa
      do incidente de 13/jul: template aprovado-mas-reformado falha todo envio
      com `#132000` enquanto uma checagem só de status continua verde.

## 6. Verificação — e a lacuna do simulador

- [ ] `GET /api/webhook` → `{ status: "ok", service: "stevi-webhook" }`.
- [ ] **`scripts/simulate-inbound.mjs` não serve pro Cloud**: ele assina
      `X-Twilio-Signature` (linha 63). Não existe simulador que assine
      `X-Hub-Signature-256`, então o caminho que roda em produção **só se testa
      com mensagem real**. Vale um `--cloud` no script — é a diferença entre
      poder ensaiar e ter que usar produção como ensaio.
- [ ] Do celular: foto → triagem; "posso pulverizar hoje?" → pin → Delta T;
      áudio. Confirmar **2 tiques azuis + "digitando"** (é a prova do `markRead`).
- [ ] Logs no **mesmo dia** — retenção é 1 dia no plano Pro.
- [ ] `select channel, count(*) from users group by channel` — a confirmação mais
      barata de que a linha nova entrou por onde você espera.

## 7. Rollback

Os dois adapters coexistem na mesma URL e o handler escolhe por formato de
requisição, então o rollback é de configuração, não de deploy: despontar o
callback da Meta devolve o tráfego pro Twilio **sem redeploy**. Requisito: as env
`TWILIO_*` continuarem lá (§2).

Ressalva: rollback não migra conversa. Quem estava falando por um transporte não
reaparece no outro com histórico — o `wa_id` é a chave, e o número muda com o
transporte.

## 8. Risco que não é técnico

Prospecção fria (Vitória) e atendimento a produtor **no mesmo número**. Um número
flagrado pela Meta leva o canal inteiro do produto junto — não só o outbound.
Isso já é verdade hoje; o que aumenta é a exposição conforme o volume de produtor
cresce. Se algum dia separar, é mais fácil antes de ter base grande nos dois
lados.
