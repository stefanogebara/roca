# Stevi — Documentation

Stevi is a production WhatsApp agronomic assistant for Brazilian farmers: send it a
leaf photo, a voice note, a "posso pulverizar hoje?", or a location pin, and it
replies in plain Brazilian Portuguese with grounded agronomic triage. It runs as a
handful of stateless Vercel functions in front of Supabase, reasons through
OpenRouter-hosted LLMs, and grounds every pest/disease answer in the official MAPA
Agrofit registry. Its defining constraint is **triagem, não prescrição** (triage,
not prescription): Stevi helps a farmer understand their field and know what to
ask, but never prescribes a defensivo — under Brazilian law that is the exclusive
act of a licensed agronomist via the *receituário agronômico*.

> **Naming.** The product is branded **Stevi** to users. The infrastructure —
> repo folder, Vercel project, Supabase project, and the live domain
> `roca-black.vercel.app` — is still codenamed **roca**. Both names refer to the
> same system; you will see `roca`/`ROCA_` in env vars, package name, and URLs.

## Documents

Each document lives as a `README.md` inside a topic subdirectory (this repo's
tooling keeps documentation in `README.md` files rather than arbitrary `.md`
names).

| Doc | What it covers |
|-----|----------------|
| [Architecture](./architecture/) | The end-to-end message loop, transport-adapter abstraction, tool layer, LLM tiers, data model, and the stateless-compute / stateful-DB principle. Includes the prime directive and prescription boundary as first-class design constraints. |
| [Deployment](./deployment/) | Runbook: prerequisites, every environment variable, running migrations, deploying to Vercel, pointing the Twilio (and Meta) webhook, and the daily-monitor cron. |
| [Knowledge base](./knowledge-base/) | How agronomic grounding stays honest and current: the Agrofit registry slice, the vazio-sanitário calendar, the source files under `knowledge/`, and how to refresh each. |
| [Webhook](./webhook/) | Inbound/outbound message contract, Twilio HMAC-SHA1 signature validation, the Meta Cloud API HMAC-SHA256 path, and how each message kind is handled. |
| [Testing](./testing/) | The vitest suites, how to run them, the `simulate-inbound.mjs` live harness, and the verification philosophy. |

## Quick orientation

- **Entry point:** `api/webhook.ts` (one Vercel function serving both Twilio and
  Meta Cloud API at the same URL).
- **Core logic:** `api/_lib/pipeline.ts` orchestrates the loop; `api/_lib/`
  holds the router, reasoner, compliance gate, transport adapters, tools, and DB
  layer.
- **Focus crops (v1):** soja (soy), milho (corn), pastagem (pasture).
- **Language:** all farmer-facing text is Brazilian Portuguese; code and docs are
  English.

> This documentation was written against the code as committed and is accurate to
> it. Where the code and the root `README.md` disagree, or where a runtime path is
> not fully wired, this suite flags it explicitly (see the "Known gaps" sections in
> KNOWLEDGE_BASE.md and DEPLOYMENT.md).
