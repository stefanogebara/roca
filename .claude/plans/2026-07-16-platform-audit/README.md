# Stevi / roca — Platform Audit & CEO/CPO Evaluation

Date: 2026-07-16 · Method: 5 parallel read-only auditors (architecture, security,
quality+testing, performance+cost, product) + orchestrator verification of
load-bearing claims. No code modified.

---

## Executive Summary

**Overall engineering health: B+ (strong for stage).** The farmer product is real,
broad, and unusually disciplined on the two things that can kill it — legal
compliance (the receituário line, enforced by a deterministic outbound gate, not a
prompt) and LGPD (masked logs, RLS everywhere, complete deletion cascade). Security
is genuinely good: webhook HMAC fails closed on both transports, zero hardcoded
secrets, parameterized DB access, signed private-report URLs. The test suite is
high quality (53 files, 1,184 behavioral assertions, deterministic). Cost discipline
is exemplary (~4 cron invocations/day). What holds the grade below A: no CI gates the
suite, the core `handleInbound` is a 559-line 16-branch god function, the sole
production entrypoint (`webhook.ts`) has zero tests, and there is no rate limiting on
public compute endpoints.

**Business health: C (validation stage, unmonetized).** There is no payment, pricing,
or paywall code anywhere in the repo (verified). The revenue thesis — an agrônomo
lead marketplace — is instrumented end to end (consent, dossier, SLA, CRM, cold
outreach) but the partner network is still aspirational: the default referral reply
promises "assim que a nossa rede estiver pronta." The product is a validation-stage
concierge, not a monetized marketplace. That is the correct stage to be at; it is not
yet proven.

**Top 3 risks:** (1) `handleInbound` fragility — order-dependent 16-branch router with
no CI net (one bad regex ships silently). (2) Unmonetized + empty partner network —
the business model is unvalidated on both the supply (agrônomos) and revenue sides.
(3) Onboarding rides a +1 US WhatsApp number — trust/deliverability tax at the exact
moment of first contact.

**Top 3 opportunities:** (1) Prompt caching on the system block — the single biggest
per-message cost cut, one file. (2) CI gate (tsc + vitest) — highest-leverage
engineering fix, ~1h. (3) Close the loop from "free triage" to a paid/priced action
before scaling outreach — the caderno/PRONAF rastreabilidade wedge (legally mandatory
for hortifruti under INC 02/2018) is the most defensible thing to charge for.

---

## Repo Map

- **Type:** Brazilian WhatsApp AI agronomy assistant ("Stevi"), PT-BR, transport-agnostic.
- **Stack:** TypeScript (strict), Vercel serverless (`@vercel/node`, Active-CPU),
  Supabase (RLS, service-role only), OpenRouter LLM via plain fetch. No web framework,
  no LLM SDK, no Twilio SDK — deliberately minimal deps.
- **Models** (`api/_lib/env.ts:16-20`): router=`claude-haiku-4.5`, reasoning=`claude-sonnet-5`
  (+vision), transcribe=`gemini-2.5-flash`.
- **Control flow:** `webhook.ts` → verify signature → `handleInbound` (pipeline.ts:354)
  → fast-path regexes | LLM router → `reason.ts` handlers → `checkOutbound` gate → send.
- **Key dirs:** `api/` (functions) · `api/_lib/` (shared, `_`=not a route) ·
  `_lib/tools/` (external data) · `_lib/transport/` (Twilio+Meta adapters) ·
  `_lib/cards/` (SVG→PNG) · `_lib/prospect/` (2,778 LOC B2B outreach — Vitória) ·
  `_lib/gym/` (offline eval) · `api/ops/` (founder console) · `tests/` (53 files).
- **Surprises:** ~50% of the repo is not farmer-facing (prospect CRM + ops + gym);
  `public/` and `web/` are byte-identical committed duplicates; no `.github/` CI.

---

## Audit Report (findings by severity)

### Critical
None. (No forgery vector, no secret leak, no data-exposure path found.)

### High
1. **No CI enforces the suite** — `.github/` missing (verified), no husky. A strict-typed
   53-file suite exists but nothing gates push/merge. Given the order-dependent router, a
   regression ships silently. (quality §8)
2. **`handleInbound` god function** — `pipeline.ts:354-912`, 559 lines, 16-branch
   if/else-if, 9 mutable accumulators, load-bearing branch order (comments warn
   "checked BEFORE X"). Highest-churn, highest-risk file. (arch/quality)
3. **`webhook.ts` has zero tests** — sole production entrypoint; adapter selection, GET
   challenge, and the always-ack-on-error path untested. (testing §6)

### Medium
4. **No rate limiting on public compute endpoints** — `card.ts` (spray/farm/ndvi fire
   external fetches + resvg per request), `report.ts`, `qr.ts` unauthenticated and
   uncapped; vary lat/lon to bypass CDN cache → upstream-quota + compute cost
   amplification. (security §2)
5. **No prompt caching** — `llm.ts:98` sends full system prompt every sonnet call, no
   `cache_control` (verified absent). Biggest per-message cost cut available. (perf §2)
6. **Webhook acks after full processing** — `webhook.ts:115-116` awaits handleInbound
   (2 sonnet-vision calls on photo triage) before ack; can exceed provider timeouts →
   hurts WhatsApp number health rating. Idempotency prevents double-send. (perf §6)
7. **`opsData.countRows` silently returns 0 on DB error** — ops dashboard reads fake
   zeros during a DB hiccup with no signal. (quality §3)
8. **`db.ts` (775 LOC) is a 45-fn hub imported by 33 files**, no repository boundaries;
   the `as unknown as` join casts (614/639) untested. (arch/testing)

### Low
9. Report token not bound to `kind` (caderno token also authorizes `?kind=pronaf` for
   same user — no cross-user exposure). 10. `OPS_SESSION_SECRET` falls back to
   `CRON_SECRET` (couples two trust domains). 11. Hardcoded fallback phone/number-IDs in
   qr/vcard/verificar. 12. `public/`↔`web/` duplication (drift risk, no sync check).
   13. 3× copy-pasted bundled-path resolver. 14. ~6 orphaned scripts. 15. `canary_runs`
   + `digests` not in purge list. 16. describeImage uses reasoning tier for a throwaway
   caption.

### Strengths (preserve)
- Transport abstraction (one URL, provider swap without redeploy) — best decision in repo.
- `checkOutbound` compliance gate as a deterministic legal backstop independent of the LLM.
- Fail-soft discipline everywhere + fail-closed on DB-down (no unmetered LLM spend).
- Idempotency + rate-limit + LGPD-delete correctly ordered before expensive work.
- Grounding: pest answers cite Agrofit, not model memory ("triagem não prescrição").
- Security: HMAC fail-closed, zero hardcoded secrets, RLS everywhere, masked-phone logger,
  complete deletion cascade, signed TTL report URLs, constant-time compares.
- Cron economics (~4/day), render isolated from webhook cold start, tiered models.
- High-quality deterministic tests (behavioral assertions, fake clocks, mocked I/O).
- Very strong type safety (strict, ~4 contained `any` in the whole tree).

---

## Improvement Strategy (themes)

1. **No automated safety net.** Strong suite, zero enforcement. Target: CI gates
   tsc+vitest on every push; core routing can't regress silently.
2. **The core router outgrew its shape.** `handleInbound` should look like `reason.ts`'s
   thin dispatcher. Target: keyed per-intent handler table, single intent source of truth.
3. **Public compute is uncapped.** Target: rate limit + kind-bound tokens on the
   unauthenticated render/fetch surface.
4. **Cost/health headroom left on the table.** Target: prompt caching + ack-first
   background processing — cheaper per message, healthier number.
5. **The business model is instrumented but unvalidated.** Target: a priced action and a
   real (even tiny) partner supply before scaling Vitória's outreach. This is a
   product/GTM decision, not an eng task — flagged in Open Questions.

**Explicitly NOT recommending (stage-inappropriate):** Sentry/APM, structured-JSON
logging, microservice split of prospect vs farmer, repository-pattern rewrite of db.ts,
handler-glue integration tests for every endpoint. Payoff doesn't beat the cost at
solo/validation stage.

**"Done" signals:** CI red on lint/type/test failure · zero High findings · rate limit
on public endpoints · `handleInbound` < 150 lines with a dispatch table · webhook.ts +
transport-send under test.

---

## Task Plan

### Quick wins (high impact, S effort — do now)
- **QW1 — DONE (2026-07-16)** GitHub Actions CI (tsc --noEmit + vitest run) on push/PR.
  `.github/workflows/ci.yml`. (theme 1)
- **QW2 — DONE (2026-07-16)** Prompt caching on the system block: `llm.ts` `buildMessages`
  emits an ephemeral cache breakpoint when `cacheSystem` is set; enabled on the four
  farmer-reasoning Sonnet calls in `reason.ts`. (theme 4)
- **QW3** Add `canary_runs`+`digests` to `purgeExpiredRows`. S.
- **QW4** Bind report token to `kind`; remove hardcoded fallback numbers. S. (security)

### Shipped this week (top-3 from the CEO/CPO readout)
1. CI gate (QW1). 2. Prompt caching (QW2). 3. **Rate limiting on public endpoints
   (M1.1) — DONE:** `api/_lib/httpRateLimit.ts` (best-effort in-memory per-IP fixed
   window, generous cap, env-tunable) wired into `card.ts`/`report.ts`/`qr.ts`, 429 +
   Retry-After. Tests: `tests/http-rate-limit.test.ts`, `tests/llm-buildmessages.test.ts`.
   The original 3rd item (monetization/supply-side) stays a product decision — see
   Open Questions.

### Milestone 0 — Safety net
- **M0.1** CI workflow (= QW1). Accept: PR with a type error or failing test goes red. S. Risk: none.
- **M0.2** Tests for `webhook.ts` (adapter select, GET challenge, error→ack, status harvest)
  + transport `.send`/`fetchMedia`. Accept: handler paths covered; suite green. M. Risk: low.

### Milestone 1 — Correctness / cost / abuse
- **M1.1** Rate limit public endpoints (`card.ts`, `report.ts`, `qr.ts`) — reuse the
  existing farmer rate-limit primitive keyed by IP. Accept: N/min cap returns 429. M. Risk: low.
- **M1.2** Prompt caching (= QW2). Accept: cached-prefix token count drops on 2nd call. S. Risk: low.
- **M1.3** Ack-first + background processing (`waitUntil`) in webhook. Accept: ack < 1s;
  processing still completes; idempotency intact. M. Risk: medium (ordering) — needs the M0.1 net first.
- **M1.4** `opsData.countRows` surfaces DB error instead of 0. Accept: dashboard shows an
  error state, not a fake zero. S. Risk: none.

### Milestone 2 — High-leverage refactor
- **M2.1** Extract `handleInbound` intent branches into a keyed dispatch table (mirror
  `reason.ts`); single `Intent` source of truth shared with `router.ts`. Accept:
  handleInbound < 150 lines; each handler independently unit-tested; pipeline.test green.
  L. Risk: medium — depends on M0.1 (net) + M0.2 (entrypoint coverage). Dependency: M0.

### Milestone 3 — Polish
- **M3.1** Decouple `OPS_SESSION_SECRET` from `CRON_SECRET`. S. **M3.2** Shared
  `resolveBundled()` util (dedupe 3× path resolver). S. **M3.3** Gitignore generated
  `public/` or add a build-sync check. S. **M3.4** Prune orphaned scripts + `scripts/README`.
  S. **M3.5** Downgrade describeImage to a cheap multimodal tier. S.

### Top-3 implementation sketches
- **QW1/M0.1 CI:** `.github/workflows/ci.yml`, Node 20, `npm ci`, `npm run typecheck`,
  `npm test`. Gotcha: vitest needs no secrets (I/O is mocked) — should run clean in CI.
- **M1.2 Prompt caching:** in `llm.ts` chat body, mark the system message with
  `cache_control: {type:'ephemeral'}` (Anthropic-via-OpenRouter). Gotcha: only the stable
  prefix (base SYSTEM_PROMPT) should be cached; the per-request style pack tail breaks the
  cache if inside the same block — put the cache breakpoint after the stable spine.
- **M2.1 Dispatch table:** build `Record<Intent, Handler>` where each handler takes a
  context object ({user, msg, media, date}) and returns {replyText, cards, docs}. Move the
  9 `let` accumulators into that return type. Gotcha: branch ORDER is currently semantics
  (financing before application_report before history) — preserve it by keeping a matcher
  priority list, not by relying on object key order.

---

## Open Questions (need a human decision)

1. **Monetization:** what is the first thing a farmer or partner pays for, and when? The
   caderno/PRONAF rastreabilidade is legally mandatory (INC 02/2018) and the most
   defensible paid feature — is that the wedge, or is it agrônomo-side lead fees?
2. **Partner supply:** the referral marketplace needs agrônomos before it needs more
   farmers. Is Vitória's outreach currently producing signed partners, or just
   conversations? (The code can't tell me the funnel's real conversion.)
3. **The US number:** is a BR WhatsApp number in progress? Onboarding trust depends on it.
4. **Prospect subsystem scope:** keep the B2B outreach engine coupled in the same
   deployment/webhook as the farmer product, or is it worth isolating before it grows?
5. **Deprecation candidates:** orphaned scripts, the `public/`↔`web/` duplication — safe
   to prune, or intentional?
