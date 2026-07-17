# Refactor: `handleInbound` — from a 559-line ladder to an ordered route table

Date: 2026-07-16 · Audit ref: `.claude/plans/2026-07-16-platform-audit` (High #2,
theme 2). **Status: DONE (shipped 2026-07-17).** All milestones landed —
`handleInbound` went from a 559-line ladder to a 67-line orchestrator, every step
verified behavior-identical. Commits: `73a0e5c` (T0), `9897918` (T1), `2faf88d`
(T2), `7cb36b4` (M2), `d820ec5` (M3). Full suite 58 files / 539 green.

## Why

`handleInbound` (`api/_lib/pipeline.ts:354-912`) is the highest-churn, highest-risk
function in the repo: ~559 lines, a 16-branch `if/else if` chain (`:608-842`), 9
mutable `let` accumulators (`:541-556`), and **load-bearing branch order** — the code
comments repeatedly warn "checked BEFORE X" because the fast-path regexes overlap
(financing before application_report before history: `:641,670,694`). Adding an intent
means editing the center of the function; a reordering bug ships silently. `reason.ts`'s
`reason()` (`:379-421`) is the model to aim for: a thin dispatcher over focused handlers.

Now is the right time: the CI gate and the new `webhook.ts` coverage (shipped
2026-07-16) are exactly the safety net a refactor of this file needs.

## Goal / non-goals

**Goal:** decompose the intent ladder into an explicit, ordered, individually-testable
route table, with zero behavior change. Slim `handleInbound` to an orchestrator.

**Non-goals:** changing any reply text, routing decision, side effect, or ordering;
touching the transport/reason/db layers; the deeper Intent-taxonomy unification (split
between `router.ts`'s 5 LLM intents and the ~10 regex intents) — that's optional M3,
flagged but not required.

## Current structure (what the orchestrator actually does)

Three phases, in order:

- **A. Pre-route guards (`:358-539`)** — sequential, each may early-return after handling
  its own send: LGPD delete (`:360`), partner reply (`:381`), upsertUser/fail-closed
  (`:399`), idempotency claim (`:427`), source attribution (`:440`), prospect opt-out
  (`:448`), rate limit (`:458`), media fetch + `effective`/transcript normalization
  (`:474-509`), prospect-agent branch (`:514`).
- **B. Onboarding precompute (`:541-606`)** — the 9 `let`s, then eagerly compute
  `cropAnswer`/`cropsOnly` (+ side effect: capture non-cropsOnly crops `:573`),
  `consentReply`, `confirmYes`, `statedLocation` (guarded so the LLM extract only runs on
  a real location statement / farm_confirm redirect).
- **C. The 16-branch ladder (`:608-842`)** — produces `intent` + `replyText` and
  optionally `pestCard`/`extraCardUrl`/`extraDocUrl`/`extraDocCaption`/`extraDocFilename`/
  `suppressCard`. Order: cropsOnly → consentReply → confirmYes → statedLocation(resolved)
  → statedLocation(ungeocodable) → financing_report → application_report → history →
  application_log → prices → brief → referral → mediaTooLarge → voice-no-transcript →
  location-pin → **else** (field_health regex | `routeIntent` → `reason()`).
- **D. Common tail (`:844-911`)** — `checkOutbound` gate, CONSENT_NOTE on first contact,
  `mediaUrl` selection (gate/suppress/pestCard/extraCardUrl/`cardUrlFor`), referral nudge,
  `sendOrRecord` + buttons, `markConsentNotified`/`markReferralPrompted`/`logMessage`, and
  the second PDF document message (`:898`).

## Target design

```ts
// The read-only-ish context every route receives (built once, phases A+B).
interface RouteContext {
  adapter: TransportAdapter;
  msg: InboundMessage;
  effective: InboundMessage;      // voice→text normalized
  user: User; userId: string; firstContact: boolean;
  media: ChatImage | null; transcript: string | null;
  contactText: string | null; mediaTooLarge: boolean;
  // precomputed onboarding signals (phase B), passed in verbatim:
  cropAnswer: string[] | null; cropsOnly: boolean;
  consentReply: string | null; confirmYes: boolean;
  statedLocation: StatedLocation | null;
}

// Exactly the 8 outputs the ladder produces today — replaces the 9 mutable lets.
interface RouteResult {
  intent: Intent;
  replyText: string;
  pestCard?: PestCardData;
  extraCardUrl?: string;
  extraDocUrl?: string;
  extraDocCaption?: string;
  extraDocFilename?: string;
  suppressCard?: boolean;
}

interface Route {
  name: string;                              // for tests + logging
  match: (ctx: RouteContext) => boolean;     // cheap predicate, NO I/O
  handle: (ctx: RouteContext) => Promise<RouteResult>;  // the branch body, verbatim
}

// ORDER IS PRIORITY — the same order as today's ladder, now explicit in one place.
const ROUTES: Route[] = [
  cropsOnlyRoute, consentRoute, confirmYesRoute,
  statedLocationResolvedRoute, statedLocationUngeocodableRoute,
  financingReportRoute, applicationReportRoute, historyRoute,
  applicationLogRoute, pricesRoute, briefRoute, referralRoute,
  mediaTooLargeRoute, voiceNoTranscriptRoute, locationPinRoute,
];
// The final `else` (field_health | routeIntent → reason) is the fallback, run when
// no route matches — kept as a named function, not in the list.
```

Orchestrator becomes:
```ts
const ctx = await buildRouteContext(adapter, msg, ...);   // phases A survivors + B
const route = ROUTES.find(r => r.match(ctx));
const result = route ? await route.handle(ctx) : await reasonFallback(ctx);
await finalizeAndSend(ctx, result);                        // phase D, verbatim
```

**Why an ordered list, not a `Record<Intent, handler>`:** the branch order is semantics
(overlapping regexes). A keyed map would lose that. The list makes the priority explicit
and greppable, and a route's `match` is the exact predicate from today's `else if`.

## Invariants that MUST be preserved (the refactor's contract)

1. **Order.** `ROUTES` order == today's ladder order, top to bottom.
2. **Eager precompute + its side effects.** `cropAnswer` non-cropsOnly capture (`:573`),
   `resolveConsentReply` (`:583`), and the `statedLocation` LLM-extract guard conditions
   (`:599-606`) run exactly when they do today — moved into `buildRouteContext`, unchanged.
3. **`match` does no I/O.** All awaits stay inside `handle` (or the precompute). Predicates
   are pure over `ctx` so ordering can't accidentally trigger a fetch.
4. **Guards keep their early-return semantics** (LGPD/partner/fail-closed/dup/prospect/
   rate-limit) — they run before context-building and still `return` on handling.
5. **Tail is untouched behavior** — gate → consent note → mediaUrl selection → nudge →
   send → markers → second PDF. Same order, same conditions (`gate.safe`, `suppressCard`,
   `firstContact`, `nudge`).
6. **No reply string, regex, or DB call changes.** Bodies move verbatim.

## Milestones

### M0 — Safety net (characterization tests FIRST, no prod change) ✅ DONE (`73a0e5c`)
`pipeline.test.ts` already locks the onboarding-state branches (crop capture, farm_confirm,
stated location, suppressCard, fail-closed, growth, compliance-vs-card). It does NOT drive
the pipeline through these intent branches — add characterization tests that assert, at the
`handleInbound` level (collaborators mocked, as the file already does), the chosen intent +
reply source + which `extra*`/`pestCard`/`suppressCard` outputs are set + `awaiting`
cleared, for: **financing_report, application_report, history, application_log, prices,
brief, referral (incl. the partner-match → referral_consent branch), mediaTooLarge,
voice-no-transcript, consentReply**, and the **second PDF document send** (`extraDocUrl &&
gate.safe`). These are the behavioral lock the extraction is verified against.

### M1 — Extract the ladder (the core win) ✅ DONE (`9897918` T1, `2faf88d` T2)
Introduce `RouteContext`/`RouteResult`/`Route`, move each `else if` body **verbatim** into a
`handle`, its condition into `match`, assemble `ROUTES` + `reasonFallback`, and replace the
chain + 9 `let`s with the `find`/fallback dispatch. `buildRouteContext` holds phases A-survivors
+ B. Verify: full suite green (M0 tests especially), `tsc` clean.

### M2 — Extract guards + tail ✅ DONE (`7cb36b4`)
Pull phase-A guards into named `guard*` functions returning `handled: boolean`, and phase D
into `finalizeAndSend(ctx, result)`. `handleInbound` becomes a ~40-line orchestrator.
Shipped: `guardDeletionRequest` / `guardPartnerReply` / `guardDuplicateInbound` /
`guardRateLimit` (→ boolean), `resolveUserOrFailClosed` (→ user|null), `fetchInboundMedia`,
`respondAsProspectIfApplicable`, and `finalizeAndSend`. `handleInbound` = 67 lines.

### M3 — Unify the Intent taxonomy ✅ DONE (`d820ec5`) — done now rather than deferred
Each route declares its `Intent` statically (`Route.intent`); the dispatcher stamps it and
handlers return `RouteOutput` (result minus intent). `Intent` is DERIVED from four producer
registries in `router.ts` (`LLM_INTENTS` / `STRUCTURAL_INTENTS` / `FASTPATH_INTENTS` /
`FALLBACK_INTENTS`), so the type and the runtime allow-lists can't drift — the "two
half-maps" (arch audit High #2b) are gone. New guard test `tests/intent-taxonomy.test.ts`
locks `FASTPATH_INTENTS` ≡ the intents ROUTES declare, both directions.

## Task table

| ID | Task | Files | Effort | Risk | Deps | Status |
|----|------|-------|--------|------|------|--------|
| T0 | Characterization tests for the 11 untested branches + 2nd-PDF send | `tests/pipeline-routes.test.ts` (new) | M | none | — | ✅ `73a0e5c` |
| T1 | Define `RouteContext`/`RouteResult`/`Route`; `buildRouteContext` (phases A-survivors + B, verbatim) | `pipeline.ts` | M | med | T0 | ✅ `9897918` |
| T2 | Move 15 branch bodies → `match`/`handle`; assemble `ROUTES` + `reasonFallback` (folded in T3's dispatch swap) | `pipeline.ts` | L | med | T1 | ✅ `2faf88d` |
| T3 | Replace the if/else chain + 9 `let`s with `find`/fallback dispatch | `pipeline.ts` | S | med | T2 | ✅ folded into T2 |
| T4 | Verify: full suite + tsc + a behavior-diff spot check on live-shaped inputs | — | S | none | T3 | ✅ baseline (`73a0e5c`) vs HEAD both green |
| T5 | (M2) Extract phase-A guards + `finalizeAndSend` | `pipeline.ts` | M | low | T4 | ✅ `7cb36b4` |
| T6 | (M3) Unify Intent source of truth | `pipeline.ts`,`router.ts`,`tests/intent-taxonomy.test.ts` | M | med | T5 | ✅ `d820ec5` |

Effort: S<2h, M half-day, L 1-2 days. **M0+M1 (T0-T4) was the shippable unit**; M2 and M3
landed as separate follow-up commits (all shipped 2026-07-17).

## Done signals (all met)
- ✅ `handleInbound` **67 lines** (from 559); zero mutable accumulators in the orchestrator
  (they live in `RouteResult`).
- ✅ `ROUTES` is one ordered list; each route's `match`/`handle` unit-testable in isolation.
- ✅ Full suite green including the M0 characterization tests (**58 files / 539**);
  `tsc --noEmit` clean. ⚠️ CI green not confirmed from the dev box — the GitHub API was
  unreachable (TLS handshake timeouts) throughout the session; `git push` succeeded on every
  commit and the local suite was the gate. Confirm the Actions runs `73a0e5c → d820ec5`.
- ✅ No diff in reply text / routing / side effects — proven by running the T0 characterization
  suite against BOTH the original ladder (`73a0e5c`) and the final code (HEAD); both green.

## Risks & mitigations
- **Behavior drift (the real risk).** → M0 characterization tests written and green BEFORE
  any extraction; bodies moved verbatim (no "while I'm here" edits); verify identical.
- **Order regression.** → single explicit `ROUTES` list with an "ORDER IS PRIORITY" comment;
  a test asserts financing matches before application_report before history on an overlapping
  input ("relatório de aplicações pro banco" / "meu caderno de aplicações").
- **Hidden coupling via the precompute side effects.** → `buildRouteContext` keeps them
  eager and in-order; T1 is reviewed against `:541-606` line by line.
- **Concurrent-session churn on pipeline.ts.** → land T0 first (additive, safe), then do
  T1-T3 in one focused sitting; `git status --short` + explicit-path staging per house rule.

## Rollback
Each task is a separate commit; the extraction (T1-T3) is behavior-identical, so any failure
reverts to the prior commit with no data/state implications (pure code motion). M0 tests are
kept regardless — they have standalone value.

## Open questions (resolved)
1. ~~Ship M2 in the same PR as M1, or as a fast follow?~~ → **Fast follow.** M2 landed as its
   own commit (`7cb36b4`) after M1's T4 verification.
2. ~~Do M3 (Intent unification) now or leave it?~~ → **Done now** (`d820ec5`). Executed as the
   full flow restructure (static `Route.intent` + dispatcher stamps + derived taxonomy), kept
   behavior-preserving and guarded by the new `tests/intent-taxonomy.test.ts`.

## Surfaced during the work (follow-ups, not part of this refactor)
- **PRICE_INTENT gap:** writing the T0 prices test surfaced that `PRICE_INTENT` doesn't match
  "quanto tá a saca do café" (the commodity must follow "quanto tá o/a" directly). Documented
  in the test; spun off as a separate task — behavior-changing, so out of scope for this
  behavior-locking refactor.
