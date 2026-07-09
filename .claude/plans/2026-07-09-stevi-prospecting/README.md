# Stevi Prospecting — B2B intermediaries + farmer opt-in

Adapted from the Olívia/"prospect-bot-template" design, **curated for Stevi** with two
deliberate divergences driven by the product's reality (decided 2026-07-09):

1. **Target agri intermediaries, not individual farmers.** Cooperativas, revendas
   agrícolas, sindicatos rurais and agrônomos have *public business* WhatsApp numbers and
   are legitimately contactable B2B; they also *aggregate* farmers, so they're the natural
   distribution channel. Cold-blasting individual farmers = LGPD exposure + near-certain
   Meta quality-rating collapse on our fresh number. Farmers arrive by **opt-in** instead.
2. **Farmer acquisition is inbound (opt-in).** A `wa.me` link / QR ("manda um oi pra
   Stevi") drives user-initiated conversations — which is what WhatsApp's policy wants and
   keeps the number healthy.

## Hard compliance rails (non-negotiable — the number is fresh, quality UNKNOWN)
- **Business-initiated sends REQUIRE a Meta-approved template.** No template → no send.
- **Conservative pacing** (fresh-number safe): daily cap start **20** (ceiling **60**, below
  Olívia's 80), batch size 8, batch delay ~45s.
- **Business hours** BRT, Mon–Fri 09–18 (no weekend/night blasts).
- **Opt-out is a hard blocklist**, checked before every send; inbound "sair/parar/não
  quero" auto-adds.
- **Global per-phone dedup** — never message the same number twice (send ledger).
- **E.164 validation, never fabricate a number.** Invalid → `wa_status=invalid`, never sent.
- Every send tracked (sent/delivered/read/replied/failed); failures alert founders.

## Data model (Supabase)
- `prospects` — B2B intermediary: name, kind (`coop|revenda|sindicato|agronomo`), city, uf,
  phone (E.164), wa_status (`pending|valid|invalid`), source (`manual|csv|search`),
  status (`discovered|ready|contacted|replied|discarded`), send fields (sent_at, send_status,
  wamid, template_used), notes, timestamps. UNIQUE(phone).
- `prospect_optouts` — phone (E.164, UNIQUE), reason, created_at. Hard block.

## Phases
- **P1 (this turn):** migration + pure, tested safety core — E.164 validation (BR default),
  eligibility (status/wa_status/optout/dedup), pacing (cap + business hours + batch). No send
  yet. This is the part that, if wrong, bans the number — so it lands first, fully tested.
- **P2:** Meta template create+approve (Graph API) + a template sender + the dispatch engine
  (CLI/cron-triggered, honouring P1 rails) + send ledger.
- **P3:** ops surface — a "Prospecção" tab in /painel: import (manual/CSV), review, "Disparar",
  history. Reuses the leads-CRM patterns.
- **P4:** farmer opt-in funnel — public `wa.me` link/QR + landing section + simple attribution.

## Reuse from the existing codebase
Cloud API transport + token, `retry.ts`, `alert.ts`/founder ping, `opsAuth` guard, the
/painel tab + leads-CRM UI patterns, `maskWa`.
