# Virada pro Cloud API — checklist

**Criada:** 30/jul/2026 · **Atualizada:** 03/ago/2026

## Estado: um item aberto que importa

A virada **já tinha acontecido** quando esta checklist nasceu — ela nunca foi um
plano de futuro, e sim um inventário de dívida. Em 03/ago quase tudo foi fechado.

**O que sobra é UM item, e é o maior do produto: foto e áudio nunca passaram
pelo Cloud.** Ver §3.

Medido em 03/ago (`messages` por kind, inbound):

| kind | total | via cloud | mais recente |
|---|---|---|---|
| text | 943 | 904 | 03/ago |
| location | 6 | 2 | 09/jul |
| **image** | **1** | **0** | 07/jul |
| **voice** | **1** | **0** | 07/jul |

A única foto e o único áudio que o Stevi já recebeu vieram pelo **Twilio**, antes
da virada. `CloudApiAdapter.fetchMedia` — o de duas etapas, media id → URL
temporária → bytes — **nunca rodou em produção**. É a promessa principal da
landing ("manda foto da praga") sem exercício nenhum no transporte que carrega
904 das 943 mensagens.

---

## 1. Docs desatualizados — ✅ FEITO (`658a980`)

- [x] `README.md` — transporte ativo é o Cloud, com o dado que sustenta
      (`users.channel` sem uma linha `twilio`). O Setup também mandava um dev novo
      configurar o sandbox como principal; agora começa pelo Cloud.
- [x] `docs/deployment/README.md` — §5 deixou de ser *"(Optional) Meta WhatsApp
      Cloud API"* e virou *"active transport"*; §4 virou *"legacy path — kept, do
      not delete"* com o motivo. TOC e anchors conferidos.
- [x] `.env.example` — "origem/destino" virou LEGADO/ATIVO, com o porquê de o
      Twilio seguir preenchido no próprio arquivo.

> Nota: uma versão anterior desta checklist listava aqui uma var fantasma
> `WHATSAPP_FROM`. **Não existe** — todo hit é `TWILIO_WHATSAPP_FROM`, e o
> comentário "fonte ÚNICA" pertence ao `PUBLIC_WA_NUMBER`, correto como está. Veio
> de um `grep -o` casando sufixo e de uma janela de `sed` cortada. Ver
> `tasks/lessons.md`.

## 2. Twilio: fica — ✅ DECIDIDO

- [x] **Não desligar.** `api/twiml-otp.ts` é a ferramenta de registro de número
      novo na Meta: ela liga, lê o código em voz, o Twilio grava e transcreve
      (fixo BR de voz não recebe SMS). Desligar a conta é perder isso.
- [x] Ninguém conversa pelo sandbox. As linhas legadas (`channel = null`) são
      **números de teste** — `+5511999990000` é o default do próprio
      `simulate-inbound`, e as outras seguem o mesmo padrão sintético. Nenhum
      produtor real ficou pra trás no Twilio.
- [x] Env `TWILIO_*` fica. Custo zero mantendo, custo alto redescobrindo.

## 3. O que nunca foi exercitado

- [ ] **`fetchMedia` no Cloud — ÚNICO ITEM REALMENTE ABERTO.** Twilio entrega
      URL, Cloud entrega *media id* e exige duas chamadas (`cloud.ts:391` vs
      `twilio.ts:231`). Zero fotos e zero áudios passaram por aqui (tabela no
      topo). Voz é a entrada principal de quem não digita, e foto é a promessa da
      landing.

      **O simulador NÃO cobre este caso** — e é bom saber por quê: `--cloud
      --media-id` precisa de um id real da Meta, que só existe depois de alguém
      mandar mídia de verdade. Id inventado faz o `fetchMedia` falhar na Graph
      API. Diferente da assinatura e do `markRead`, este só se prova com uma foto
      de verdade, do celular.

- [x] ~~`markRead`~~ — **verificado em produção** em 30/jul 11:12, depois do fix
      do `bind` (`c63ee02`). O log é assimétrico e é isso que esconde falha aqui:
      - sucesso → **não loga nada** (silêncio é a boa notícia)
      - HTTP ruim → `markRead failed <status> (cosmetic, ignored)`
      - `this` perdido → `[bg] ERROR markRead lançou na chamada`

      Apareceu `markRead failed 400` — o catch INTERNO dele, prova de que o `this`
      sobreviveu (o 400 é a Meta recusando o `wamid.SIM…` inventado do simulador).

- [x] ~~Janela de 24h~~ — `WHATSAPP_TEMPLATE_ALERT` está setado na Vercel
      (Preview + Production, conferido em `vercel env ls`). Sem ele
      `alerts.ts:110` lançaria em geada/fogo de madrugada, que é justamente fora
      da janela.

- [ ] **O portão do sandbox não existe mais** (informativo, não tem ação). O
      `join <código>` filtrava quem entrava; agora qualquer número alcança o
      webhook, e o único freio é o rate limit de 15 inbound/60s do `pipeline.ts`
      — que é por usuário, não global.

## 4. O número público — ✅ FEITO (`0bdf67d`) + env setada (03/ago)

- [x] `web/index.html` era estático com o número cravado em 4 lugares. O
      `build-web.mjs` agora substitui no build e avisa alto quando a env falta.
- [x] Os 7 fallbacks silenciosos → tudo passa por `api/_lib/waNumber.ts`. Mantive
      o fallback (era decisão consciente: env vazia não pode APAGAR a volta do
      produtor pro canal); o defeito era o silêncio e a duplicação.
- [x] **`PUBLIC_WA_NUMBER` setada na Vercel** (Production + Preview) em 03/ago.
      Estava ausente — o aviso novo pegou isso na primeira requisição. Valor
      conferido na Meta antes de cravar: `display_phone_number: +1 970-550-9125`,
      igual ao fallback. Verificado depois do redeploy pelo `.vcf` servido.
- [ ] O que já saiu não volta (informativo): QR impresso, `.vcf` compartilhado,
      cards antigos com rodapé. Só vira problema no dia da migração pro número BR.

## 5. Canário — ✅ VERIFICADO em produção (03/ago)

Disparo manual do `/api/cron/monitor` gravou 19 checks, todos verdes, em
`canary_runs`. O que vale saber ler:

- [x] `numberQualityCheck` — devolveu `GREEN` hoje. `GREEN`/`UNKNOWN` é ok
      (`UNKNOWN` = número novo que a Meta não pontuou). `YELLOW`/`RED`/`FLAGGED`
      é alarme de verdade.
- [x] `templateChecks` — checa **shape além de status**, por causa do incidente
      de 13/jul: template aprovado-mas-reformado falha todo envio com `#132000`
      enquanto uma checagem só de status continua verde.
- [x] **Sonda assinada nova** (`webhook assinado (Cloud)`) — o probe antigo é GET,
      e o handler responde GET no topo: nunca toca seleção de adapter nem
      verificação de assinatura. Um `WHATSAPP_APP_SECRET` errado faria todo inbound
      virar 403 com o canário verde. A sonda nova exercita isso sem causar
      trabalho (envelope sem mensagens e sem statuses).
- [x] **O canário não cai mais junto com o vigiado** (`4f77bfa`). Ele importava
      uma string do `pipeline` e afundava no mesmo `ERR_REQUIRE_ESM` que derrubou
      o webhook por 24h — tinha sonda no webhook desde 12/jul e não alertou uma
      vez. Agora a queda dele vira finding, e um teste de topologia proíbe o
      import de voltar.
- [ ] `messaging_limit_tier` limita **destinatários únicos por dia** — é o teto
      real do disparo da Vitória, independente do cap interno. Sem ação hoje;
      vira restrição quando o volume subir.

## 6. Verificação — ✅ FEITO, menos a mídia

- [x] `GET /api/webhook` → `{ status: "ok", service: "stevi-webhook" }`.
- [x] `scripts/simulate-inbound.mjs --cloud` — assina `X-Hub-Signature-256`,
      `--media-id`, `--voice`, `--url=` pra apontar num preview, `--dry-run`. Os
      builders viraram `scripts/simulate-payload.mjs`, puros, e
      `tests/simulate-inbound.test.ts` alimenta os **adapters de verdade** com o
      que o simulador monta — é o que impede o simulador de desgarrar do
      verificador e devolver 200 no ensaio enquanto a produção 403.
- [x] Inbound real de texto verificado ponta a ponta (30/jul): `in` 11:12:39,
      `out` 11:12:45 com intent `spray_window`.
- [ ] **Do celular: foto e áudio.** É o item §3 — o que falta.
- [x] `select channel, count(*) from users` — 19/19 no formato canônico.

## 7. Rollback e identidade — ✅ DECIDIDO (`15ca19a`)

Os dois adapters coexistem na mesma URL e o handler escolhe por formato de
requisição, então o rollback é de configuração, não de deploy: despontar o
callback da Meta devolve o tráfego pro Twilio **sem redeploy**. Requisito: as env
`TWILIO_*` continuarem lá (§2).

**O racha de `wa_id` foi fechado.** O Twilio entrega `+5511…` e a Meta entrega
`5511…`; `upsertUser` gravava o valor cru, então o mesmo produtor viraria duas
linhas em `users` — histórico, culturas, fazenda e consentimento LGPD divididos.

Decisão: canônico é **só dígitos, com código do país, sem `+`** — o que a Meta já
entrega e o que 13 das 19 linhas já eram. `canonicalWaId()` aplica nos dois
pontos de entrada (`upsertUser` e a busca por wa_id), e formatar pro fio virou
responsabilidade de cada transporte.

- [x] Migração aplicada: 6 linhas normalizadas, **zero colisões** medidas antes
      (por isso sem merge e sem decidir qual consentimento vence). Tabelas filhas
      referenciam `users.id` (uuid) — nada ficou órfão. Estado: 19/19 canônicos.
- [x] **O conserto quase virou outro bug:** o Twilio monta
      `To: whatsapp:${msg.to}` e sem `+` isso é inválido; as linhas legadas
      roteiam por Twilio, então normalizar sem tocar no adapter quebraria o alerta
      de geada delas. O adapter recoloca o `+`, com teste que falha se alguém
      desfizer.
- [x] Sem CHECK constraint de propósito: restrição rígida transformaria formato
      inesperado em upsert recusado, e `upsertUser` devolvendo null faz o pipeline
      responder desculpa ao produtor. A garantia vive no código, com teste.

## 8. Risco que não é técnico — aberto por escolha

Prospecção fria (Vitória) e atendimento a produtor **no mesmo número**. Um número
flagrado pela Meta leva o canal inteiro do produto junto — não só o outbound.
Isso já é verdade hoje; o que aumenta é a exposição conforme o volume de produtor
cresce. Se algum dia separar, é mais fácil antes de ter base grande nos dois
lados.
