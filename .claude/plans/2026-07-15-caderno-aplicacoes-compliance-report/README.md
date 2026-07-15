# Caderno de Aplicações — the compliance/record report generator

**Status:** proposed · **Date:** 2026-07-15 · **Origin:** audit opportunity #1 (note.com/tomiyasu16 #45)

Farmer decisions locked:
- **v1 purpose:** *rastreabilidade / caderno de aplicações* — a factual application logbook for the
  farmer's own records, buyers, and certification. (Financing/PRONAF and agrônomo-packet framings
  are follow-ons, not v1.)
- **Delivery:** **both** a PNG summary card (in-chat) **and** an attached PDF document.

---

## 1. The load-bearing constraint: record, never prescription

stevi's prime legal directive is *"triages, never prescribes"*, enforced in code by
[`compliance.ts`](../../../api/_lib/compliance.ts) (`checkOutbound`) and the `receituário`
handoff in [`pipeline.ts`](../../../api/_lib/pipeline.ts) (`REFERRAL_REPLY`). The receituário
agronômico legally requires a CREA-registered agrônomo's signature.

Therefore this feature **must not** produce a prescription or anything that reads as one. It is a
record of applications **the farmer declares they already made** — past tense, their own data —
with AGROFIT used to **cross-reference** (is this active/product registered for this crop?), never
to recommend a product or dose.

Framing rules baked into every surface:
- The document title is *"Caderno de Aplicações — declarado pelo produtor"*, not "receituário".
- Every row is attributed to the farmer's own declaration + date.
- AGROFIT annotations are factual presence checks (*"ingrediente ativo consta no registro MAPA
  para soja"*), never *"aplique"*. No dose recommendation, no "correct" product.
- A footer states it is a self-declared record, not a technical/legal certification, and that
  product/dose decisions belong to the agrônomo via receituário.

This keeps the feature on the legal side of the same line the whole product already respects.

---

## 2. The gate collision and its (already-established) solution

The report necessarily contains the farmer's declared `"Priori Xtra 0,3 L/ha"` — dose + brand,
exactly the shape `checkOutbound` blanks out. The pipeline already solves this class of problem:
the **pest card "carries the exact product/group data the gate just blocked"** by shipping it as a
rendered `mediaUrl` while the outbound *text* stays safe (pipeline.ts:702–708).

The report follows that pattern:
- The **rendered document** (PNG + PDF) holds the dose/brand — it never passes through `checkOutbound`.
- The **outbound text** is only a safe caption (*"Aqui está seu caderno de aplicações 📄"*). It
  passes the gate cleanly; no special-casing of the gate required.

This is deliberate and correct: the gate exists to stop *stevi prescribing*, not to stop stevi from
handing the farmer back a logbook of what the farmer themselves recorded.

---

## 3. Prerequisite gap: there is no application data yet

[`caderno.ts`](../../../api/_lib/caderno.ts) v1 only tallies *intents* from the message log
(pest_triage, spray_window…). It captures **zero structured application events**. A report over that
is empty. So structured capture is **Phase 0**, not optional.

---

## Phase 0 — Capture structured application records

**Goal:** turn a farmer's free-text/voice declaration ("apliquei Priori Xtra 0,3 L/ha na soja
contra ferrugem ontem") into a structured row, with zero forms.

### 0.1 Data model — new migration `..._applications.sql`
New table `applications` (mirrors the `.from('table')` repository style in `db.ts`):

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid fk → users | cascade delete (LGPD) |
| `farm_id` | uuid fk → farms null | resolved when known |
| `applied_on` | date | parsed from "ontem"/"dia 3"; defaults to message date |
| `crop` | text null | canonical crop key when resolvable |
| `product_name` | text null | brand **as declared** |
| `active_ingredient` | text null | if the farmer named it |
| `dose_text` | text null | verbatim declared dose ("0,3 L/ha") — never normalized/recomputed |
| `area_ha` | numeric null | |
| `target` | text null | pest/disease/weed named |
| `source` | text | `'declared_text' | 'declared_voice'` |
| `raw_text` | text | the original message, for audit + reparse |
| `created_at` | timestamptz default now() | |

Add to the LGPD deletion cascade (`deleteUserData`) — verify the new table is covered.

### 0.2 db.ts helpers
`insertApplication(userId, row)`, `listApplications(userId, {sinceIso?})`,
`countApplications(userId)`. Same shape as existing `logMessage` / `getActivityLog`.

### 0.3 Intent + fast-path (pipeline.ts)
Add a **fast regex** `isApplicationLog(text)` in the pipeline (like `isHistoryRequest`,
`isPriceRequest`) — past-tense application declarations only, so it never eats a *question*:
- Match: `apliquei`, `pulverizei`, `passei (o|veneno|produto)`, `fiz (uma )?aplicaç`, `joguei`.
- **Must not** match `posso aplicar?`, `quando pulverizar?` → those stay spray_window/general.
Add `'application_log'` to the `Intent` union (router.ts) as a regex-matched-only intent (like
`history`, `prices` — never returned by the LLM router).

### 0.4 Extractor (new `tools/applicationParse.ts`, pure + unit-tested)
Cheap-tier LLM structured extraction (JSON) from the declaration → `{applied_on, crop,
product_name, active_ingredient, dose_text, area_ha, target}`, all nullable. Deterministic
post-processing: relative-date resolution ("ontem"), crop canonicalization via existing
`normalizeCrop` (agrofit.ts). Fail-soft: a partial parse still stores `raw_text` so nothing is lost.

**Compliance note:** this is *inbound* farmer data → `checkOutbound` does not apply. Confirmation
reply ("✅ Anotei: soja · Priori Xtra · 0,3 L/ha · contra ferrugem · 14/07") echoes the farmer's own
words; keep it factual/past-tense so it also reads clean.

### 0.5 Voice synergy (free)
A voice note already transcribes to text upstream (pipeline.ts:445) and flows through the same
text path → voice application logging works with no extra code. This is audit opportunity #2 landing
for free.

**Phase 0 tests (TDD):** `applicationParse` table-driven cases (full/partial/date-relative/negation
"não apliquei"/question-not-a-log); `isApplicationLog` positive+negative incl. the spray_window
confusables.

---

## Phase 1 — Report generation + AGROFIT validation + PNG summary

### 1.1 Report intent + fast-path
`isApplicationReportRequest(text)` — `relatório de aplicaç`, `caderno de aplicaç`,
`relatório de agrotóxico`, `histórico de pulverizaç`. Add `'application_report'` intent.
Special redirect: if the farmer says "receituário", answer honestly — *"o receituário quem assina é
o agrônomo; o que eu monto é o seu caderno de aplicações pra você levar pra ele"* — then offer the
report + the existing referral.

### 1.2 Validator (new `tools/applicationValidate.ts`, pure + unit-tested)
For each application row, annotate against AGROFIT using existing primitives in
[`tools/agrofit.ts`](../../../api/_lib/tools/agrofit.ts):
- **Active-ingredient presence:** does the declared active appear in the crop's registered `ativos`
  (via `lookupPest`/`groundedHit` over the crop+target)? → `registrado | nao_encontrado`.
- **Brand presence:** is `product_name` in the MAPA brand slice (`agrofit-brands.json`, already
  loaded by compliance.ts)? → `marca_consta | marca_nao_consta`.
- Verdict per row is one of: `✅ consta no MAPA`, `⚠️ não localizei no registro (confira com o
  agrônomo)`, `— sem dados suficientes`. **Never** a dose judgment.

> **Data limitation (must be stated honestly, and is a real Phase-2 item):** the bundled
> `agrofit.json` is indexed *crop → pest → {ativos, classes, products}*. It supports a **presence
> check**, not a full product↔crop↔target↔legal-dose validation. So v1 says *"consta / não
> localizei"*, and the document footer is explicit that this is an informational cross-reference,
> not a compliance certification. A true per-product legal check needs a richer extract (§Phase 2.4).

### 1.3 Composer (new `cards/applications.ts` builder, pure + unit-tested)
`buildApplicationsReport(profile, rows, validations)` → a structured model (header with
farm/crop/UF/period, per-row lines, totals, footer). Reused by both the PNG and the PDF renderers so
they never diverge.

### 1.4 PNG summary card
Extend the `/api/card` endpoint with `type=applications` (hand-authored SVG → PNG via
[`cards/render.ts`](../../../api/_lib/cards/render.ts), same brand fonts). A compact summary: last
N applications + counts. This is the in-chat glanceable artifact.

### 1.5 Wire into pipeline
New branch in the `handleInbound` if/else chain. `replyText` = safe caption; `extraCardUrl` = the
applications PNG (like the prices branch). Empty-state reply when no applications logged yet
(mirrors `buildHistoryReply`'s empty path — nudge them to log one).

**Phase 1 tests:** validator table cases (registered / not-found / brand-only / no-data);
composer snapshot; empty-state; caption passes `checkOutbound`.

---

## Phase 2 — PDF document + transport + secure delivery

### 2.1 PDF renderer (new dep)
resvg is PNG-only, and headless browsers are deliberately avoided. Use **`pdf-lib`** (pure JS, no
native binaries — Vercel-safe) to compose a one-page A4 document from the same report model as §1.3:
title, farm identity, period, application table (date · crop · product · dose · area · target ·
MAPA cross-ref), and the legal footer. Bundle the brand TTFs (already shipped for cards).

### 2.2 Transport: document support (real change, both adapters)
`OutboundMessage.mediaUrl` is **image-only** today; the Meta Cloud adapter hardcodes
`image: { link }` ([cloud.ts:245](../../../api/_lib/transport/cloud.ts)). To attach a PDF:
- Add `mediaType?: 'image' | 'document'` and `filename?` to `OutboundMessage` (types.ts).
- **cloud.ts:** when `mediaType==='document'`, send `document: { link, filename, caption }`.
- **twilio.ts:** `MediaUrl` already auto-types by content-type — a PDF works as-is; pass filename
  where supported.
- Keep the existing image path untouched (default `mediaType='image'`).

### 2.3 Multi-media delivery
The pipeline ships a single `mediaUrl` per reply. For "PNG in-chat **and** PDF attached", the report
branch sends **two messages**: the PNG card reply (existing rail) followed by a second
`document` send with the PDF. Add a small helper so the second send reuses `sendOrRecord`'s
retry/record/alert discipline. (Alternative: PDF-only with a rich first page and drop the PNG — but
the farmer chose both.)

### 2.4 AGROFIT enrichment (optional, unblocks a real per-product verdict)
Extend `scripts/agrofit-extract.mjs` to also emit a product-level slice
(product → crop → target → registered dose range) from the MAPA *produtos formulados* dataset. Lets
§1.2 upgrade from "consta/não consta" to a genuine per-line registration + dose-plausibility check.
Sizeable data task; gated behind whether v1's presence-check proves insufficient in the field.

### 2.5 Security / LGPD — signed, expiring report URLs (**required, not optional**)
Pest/price cards encode non-identifying data in public query params. An application report is
**identifiable personal data** (farm + chemical history). It must **not** sit at a guessable public
URL. Design:
- Generate the report behind a **short-lived signed token** — either an HMAC-signed param with a TTL
  (stateless, uses an existing secret) or a one-row `report_tokens` table (token, user_id, expires_at).
- The `/api/card?type=applications` and PDF endpoints require a valid unexpired token; reject
  otherwise. WhatsApp fetches within the TTL; the link dies after.
- Covered by the LGPD deletion cascade; the report reflects only the requesting user's own rows
  (row-level scoping by `user_id`).

**Phase 2 tests:** PDF composes without throwing and embeds fonts; cloud adapter emits a `document`
payload when `mediaType==='document'`; token verify accepts fresh / rejects expired+tampered;
report endpoint 401s without a token.

---

## 4. Files touched (map)

**New:** `supabase/migrations/2026071500001*_applications.sql` ·
`api/_lib/tools/applicationParse.ts` · `api/_lib/tools/applicationValidate.ts` ·
`api/_lib/cards/applications.ts` · (Phase 2) `api/_lib/report/pdf.ts` · report-token util ·
tests under `tests/`.

**Edited:** `api/_lib/db.ts` (helpers + deletion cascade) · `api/_lib/router.ts` (Intent union) ·
`api/_lib/pipeline.ts` (two fast-paths + branches + PDF second-send) · `api/card.ts` (new type) ·
`api/_lib/transport/types.ts` + `cloud.ts` + `twilio.ts` (document support) ·
`api/_lib/caderno.ts` (optional: fold applications into "meu histórico") · `vercel.json` (bundle any
new data/fonts) · `scripts/agrofit-extract.mjs` (Phase 2.4).

---

## 5. Sequencing & effort (rough)

| Phase | Scope | Effort | Ships value |
|---|---|---|---|
| 0 | capture (migration, parser, intent, confirm) | S–M | logging works; voice free |
| 1 | validate + compose + PNG + pipeline wire | M | usable in-chat report |
| 2 | PDF + transport doc + signed URLs | M | forwardable/printable paperwork |
| 2.4 | AGROFIT product-level enrichment | M (data) | real per-line compliance verdict — only if needed |

Phase 0→1 is the MVP a farmer can use. Phase 2 makes it "paperwork". 2.4 is deferred until the
presence-check proves too weak in practice.

## 6. Open decisions / risks
- **Report token strategy:** stateless HMAC+TTL (simplest, no table) vs `report_tokens` table
  (revocable, auditable). Lean HMAC+TTL for v1.
- **AGROFIT presence-check sufficiency:** acceptable for a *self-declared record*; revisit if
  farmers/buyers expect a certified compliance verdict → then 2.4.
- **Voice-note mis-parse:** dose/product ASR errors → always show the parsed record back for the
  farmer to confirm/correct before it's trusted in a report; store `raw_text` for reparse.
- **Scope creep to financing/PRONAF:** deliberately out of v1; the record model is a superset, so
  the PRONAF/agrônomo-packet variants are later template mappings over the same `applications` data.

## 7. Test discipline
Every pure module (`applicationParse`, `applicationValidate`, report composer, token verify) is
TDD'd with table-driven cases before wiring. Follow the repo's existing vitest layout under
`tests/`. The one non-negotiable: the safe-caption path must be proven to pass `checkOutbound`, and
the parser must be proven **not** to log questions as applications.
