# Stevi — Deployment Runbook

How to stand up Stevi from nothing: provision the backing services, set the
environment, run migrations, deploy to Vercel, and wire the WhatsApp webhook.

## Table of contents

- [Live URLs](#live-urls)
- [Prerequisites](#prerequisites)
- [Environment variables](#environment-variables)
- [1. Supabase: schema and migrations](#1-supabase-schema-and-migrations)
- [2. Agrofit data slice](#2-agrofit-data-slice)
- [3. Deploy to Vercel](#3-deploy-to-vercel)
- [4. Point the Twilio sandbox webhook](#4-point-the-twilio-sandbox-webhook)
- [5. (Optional) Meta WhatsApp Cloud API](#5-optional-meta-whatsapp-cloud-api)
- [6. Daily monitor cron](#6-daily-monitor-cron)
- [Verifying the deployment](#verifying-the-deployment)
- [Cost notes](#cost-notes)
- [Known gaps and stale docs](#known-gaps-and-stale-docs)

---

## Live URLs

| Purpose | URL |
|---------|-----|
| Webhook (Twilio + Meta, one endpoint) | `https://roca-black.vercel.app/api/webhook` |
| Health check (GET) | `https://roca-black.vercel.app/api/webhook` → `{ "status": "ok", "service": "stevi-webhook" }` |
| Daily monitor (cron only) | `https://roca-black.vercel.app/api/cron/monitor` |

> The product is **Stevi**; the infra (Vercel project, Supabase project, domain
> `roca-black.vercel.app`) is codenamed **roca**. Renaming the domain would mean
> reconfiguring the Twilio webhook, so it stays as-is for now.

## Prerequisites

- **Supabase** project (Postgres + service-role key).
- **Vercel** account/project (the app is Vercel serverless functions; `@vercel/node`).
- **Twilio** account with the **WhatsApp Sandbox** enabled (Stage-0 transport).
- **OpenRouter** API key (one key serves all model tiers).
- Node.js **>= 20** locally (see `package.json` `engines`).
- Optional, for the endgame transport: a **Meta WhatsApp Business** app (Cloud API).

The Supabase CLI is used for migrations; the Vercel CLI is optional if you deploy
via Git integration.

## Environment variables

Copy `.env.example` to `.env` and fill each value. In production these go in the
Vercel project's Environment Variables. Required vars are read lazily via
`requireEnv` **at request time** (in `api/_lib/env.ts` and `db.ts`/`llm.ts`), so a
missing var surfaces as a per-request error and a `403`/failed reply — not a
boot-time crash. Set them before taking traffic.

| Variable | Required | Used by | Meaning |
|----------|----------|---------|---------|
| `OPENROUTER_API_KEY` | **Yes** | `llm.ts` | OpenRouter bearer key; every LLM call (router, reasoning, vision, transcription). |
| `ROCA_ROUTER_MODEL` | No (default `anthropic/claude-haiku-4.5`) | `env.ts` | Cheap-tier slug for intent classification + crop/pest extraction. |
| `ROCA_REASONING_MODEL` | No (default `anthropic/claude-sonnet-5`) | `env.ts` | Flagship slug for grounded Q&A and vision. |
| `ROCA_TRANSCRIBE_MODEL` | No (default `google/gemini-2.5-flash`) | `env.ts` | Audio-capable slug for PT-BR voice transcription. |
| `TWILIO_ACCOUNT_SID` | Yes (Twilio path) | `twilio.ts` | Twilio account SID; used for send and media basic-auth. |
| `TWILIO_AUTH_TOKEN` | Yes (Twilio path) | `twilio.ts` | Twilio auth token; keys the inbound `X-Twilio-Signature` HMAC-SHA1 and the outbound send. |
| `TWILIO_WHATSAPP_FROM` | Yes (Twilio path) | `twilio.ts` | Sender in `whatsapp:+…` form. Sandbox default `whatsapp:+14155238886`. |
| `SUPABASE_URL` | **Yes** | `db.ts` | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | `db.ts` | Service-role key (server-only; bypasses RLS). Never expose client-side. |
| `CRON_SECRET` | **Yes** (for the cron) | `cron/monitor.ts` | Bearer secret the daily monitor requires; Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. |
| `WHATSAPP_CLOUD_TOKEN` | Meta path | `cloud.ts` | Graph API access token; used for send and media resolution. |
| `WHATSAPP_CLOUD_PHONE_NUMBER_ID` | Meta path | `cloud.ts` | Graph phone-number id in the send URL. |
| `WHATSAPP_CLOUD_VERIFY_TOKEN` | Meta path | `cloud.ts` | Token echoed back during Meta's GET subscription challenge. |
| `WHATSAPP_APP_SECRET` | Meta path | `cloud.ts` | App secret that keys the inbound `X-Hub-Signature-256` HMAC-SHA256. |

> **Do not commit `.env`.** Only `.env.example` is committed (empty values). The
> service-role key and provider tokens are secrets; if any leaks, rotate it.

## 1. Supabase: schema and migrations

Migrations live in `supabase/migrations/`:

- `20260707000001_init.sql` — `users`, `farms`, `farm_derived`, `messages`, the
  `farms.updated_at` trigger, and RLS enabled (no public policies) on all four.
- `20260707000002_monitor.sql` — `monitor_runs` (daily-monitor audit trail), RLS
  enabled.
- `20260707000003_conversation_state.sql` — adds `users.awaiting` (nullable text),
  the conversation-state flag used by crop capture.

Apply them with the Supabase CLI (link the project first if you haven't):

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Alternatively, paste each file into the Supabase SQL editor in filename order. After
migrating, copy `SUPABASE_URL` and the `service_role` key into your env.

> RLS is on with **no** public policies by design: all reads/writes are via the
> service role from server code. The anon/public key cannot read farmer data.

## 2. Agrofit data slice

The reasoning path grounds pest answers in a local JSON slice of the MAPA Agrofit
registry. At runtime `api/_lib/tools/agrofit.ts` reads **`api/_lib/data/agrofit.json`**,
and `vercel.json` ships that exact file with the function via `includeFiles`.

The build script `scripts/agrofit-extract.mjs` writes its output to
**`knowledge/agrofit/registry-slice.json`** — a *different* path from the runtime
file. The two are byte-identical today, which means there is a **manual copy step**
between building the slice and deploying:

```bash
node scripts/agrofit-extract.mjs                     # -> knowledge/agrofit/registry-slice.json
cp knowledge/agrofit/registry-slice.json api/_lib/data/agrofit.json   # -> runtime location
```

If you rebuild the slice and forget the copy, the deployed bot keeps serving the old
grounding data. See [Known gaps](#known-gaps-and-stale-docs) and
[the knowledge-base doc](../knowledge-base/) for details on building the slice.

## 3. Deploy to Vercel

The app is plain Vercel functions — no framework build. Configuration is in
`vercel.json`:

```jsonc
{
  "functions": {
    "api/webhook.ts":      { "maxDuration": 60, "includeFiles": "api/_lib/data/agrofit.json" },
    "api/cron/monitor.ts": { "maxDuration": 30 }
  },
  "crons": [ { "path": "/api/cron/monitor", "schedule": "0 11 * * *" } ]
}
```

Notes:

- `api/webhook.ts` sets `export const config = { api: { bodyParser: false } }` so it
  can read the raw request bytes for signature verification. Keep this — parsed
  bodies would break both HMAC checks.
- Only files under `api/` **not** starting with `_` deploy as functions
  (`api/webhook.ts`, `api/cron/monitor.ts`). Everything in `api/_lib/` is library
  code bundled into those functions.
- `includeFiles` is what makes `agrofit.json` present in the function's filesystem
  at runtime.

Deploy via the Vercel Git integration (recommended — one build per push) or the CLI:

```bash
vercel --prod
```

Set every production env var from the [table above](#environment-variables) in the
Vercel project settings before sending real traffic.

## 4. Point the Twilio sandbox webhook

1. In the Twilio Console, open **Messaging → Try it out → Send a WhatsApp message**
   and activate the sandbox.
2. Note the sandbox number (`whatsapp:+14155238886` by default), your `Account SID`,
   and `Auth Token`. Put them in the Vercel env (`TWILIO_ACCOUNT_SID`,
   `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`).
3. Set **"When a message comes in"** to
   `https://roca-black.vercel.app/api/webhook` (HTTP **POST**).
4. From your phone, join the sandbox (send the join code), then test:
   - a leaf photo → pest triage;
   - "posso pulverizar hoje?" → it asks for your location → Delta T verdict;
   - drop a location pin → the farm card.

Twilio signs each request; the webhook verifies `X-Twilio-Signature` against
`TWILIO_AUTH_TOKEN`. If verification fails you get `403` and no reply — a wrong or
missing auth token is the usual cause.

## 5. (Optional) Meta WhatsApp Cloud API

The Cloud API adapter (`api/_lib/transport/cloud.ts`) is implemented and unit-tested;
it coexists with Twilio at the **same** webhook URL (the handler picks the adapter by
request shape). To switch the endgame transport on:

1. Create a Meta app with WhatsApp, get the **permanent access token**
   (`WHATSAPP_CLOUD_TOKEN`), **phone number id** (`WHATSAPP_CLOUD_PHONE_NUMBER_ID`),
   and the **app secret** (`WHATSAPP_APP_SECRET`). Choose a verify token
   (`WHATSAPP_CLOUD_VERIFY_TOKEN`). Set all four in Vercel.
2. In the Meta app's WhatsApp configuration, set the **Callback URL** to
   `https://roca-black.vercel.app/api/webhook` and the **Verify Token** to your
   `WHATSAPP_CLOUD_VERIFY_TOKEN`. Meta sends a `GET` with `hub.mode`,
   `hub.verify_token`, `hub.challenge`; the webhook echoes the challenge when the
   token matches.
3. Subscribe to the `messages` webhook field.

Inbound Cloud requests are verified via `X-Hub-Signature-256` (HMAC-SHA256 over the
raw body, keyed by `WHATSAPP_APP_SECRET`). See [the webhook doc](../webhook/) for
the full contract and the differences from Twilio.

## 6. Daily monitor cron

`api/cron/monitor.ts` runs once a day (Vercel Cron, `schedule: "0 11 * * *"` =
**11:00 UTC**, i.e. 08:00 in Brazil, UTC−3). It:

- lists vazio-sanitário transitions (start/end) within the next 7 days across all
  grounded UFs, and
- checks whether the 2026/27 calendar is likely stale (a new-season portaria is due),

then records the run in `monitor_runs`. It requires `CRON_SECRET`: Vercel Cron sends
`Authorization: Bearer <CRON_SECRET>`; anything else gets `401`. Set `CRON_SECRET` in
Vercel, and the cron is registered automatically from `vercel.json` on deploy. Cost is
**one invocation per day** by design.

## Verifying the deployment

- **Health:** `GET https://roca-black.vercel.app/api/webhook` returns
  `{ status: "ok", service: "stevi-webhook" }`.
- **Signed inbound without a phone:** `node scripts/simulate-inbound.mjs "posso
  pulverizar hoje?"` posts a correctly-signed Twilio request to the live webhook and
  prints the status/latency. Add `--location=-12.5,-55.7` for the farm card,
  `--media-url=<url> --media-type=image/jpeg` for the vision path, or
  `--bad-signature` to confirm a `403`. (Reads `TWILIO_AUTH_TOKEN` from `.env`.) See
  [the testing doc](../testing/).
- **Data:** confirm rows land in `users`/`messages` in Supabase, and that a cron run
  appears in `monitor_runs`.

## Cost notes

Stateless compute means cost scales with **invocations + active CPU**, not uptime
(Vercel Fluid/Active-CPU pricing). The levers already applied here:

- **One cron/day** (`0 11 * * *`) — never poll more often than needed.
- **maxDuration ≤ 60 s** (webhook 60, monitor 30).
- **Cheap guards first** — signature check and early returns run before any LLM
  call; the router uses the cheap tier and caps output at 12 tokens.
- **Per-user rate limit** — `pipeline.ts` drops a user's traffic above 15 inbound
  messages/60 s (counted in the `messages` table) *before* any media fetch or LLM
  call, so a flood or an echo loop can't run up cost. No env/config; the limit is a
  constant in code.
- **One deploy per push** via Git integration (no duplicate deploy hooks).

## Known gaps and stale docs

Surfaced during documentation; **not fixed here** (docs-only task):

1. **Agrofit build→runtime path mismatch.** `scripts/agrofit-extract.mjs` writes
   `knowledge/agrofit/registry-slice.json`, but the runtime reads
   `api/_lib/data/agrofit.json` (shipped by `vercel.json`). The undocumented manual
   copy step (see [step 2](#2-agrofit-data-slice)) is easy to forget. The comment in
   `agrofit.ts` ("Rebuild with scripts/agrofit-extract.mjs") does not mention the
   copy. Consider having the script write both paths, or a `postbuild` copy.
2. **Root `README.md` setup steps are stale.** It tells you to run
   `supabase/migrations/0001_init.sql` (the real files are
   `20260707000001_init.sql` and `20260707000002_monitor.sql`) and to generate an
   `ANTHROPIC_API_KEY` — but the app authenticates to OpenRouter via
   `OPENROUTER_API_KEY`; `ANTHROPIC_API_KEY` is not used anywhere in the app. Trust
   this runbook and `.env.example` over the root README.
3. **`scripts/check-key.mjs` validates `ANTHROPIC_API_KEY`** directly against the
   Anthropic API — a leftover diagnostic from before the OpenRouter migration. Use
   `scripts/check-openrouter.mjs` to validate the key the app actually uses.
