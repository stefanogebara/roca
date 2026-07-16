# PRONAF / crédito-rural support report

**Status:** proposed · **Date:** 2026-07-16 · **Origin:** P0 item in the BR-fit backlog (`2026-07-16-brazil-fit-backlog`). Brazil-only leverage; ~free on the caderno.

## 1. The load-bearing scope constraint (read first)

stevi **cannot produce a PRONAF application** — and must not imply it does. A real crédito-rural / PRONAF dossier needs a **DAP/CAF**, a **projeto técnico with an agrônomo's ART**, an active **CAR**, ZARC compliance, and the **bank/cooperativa's own analysis**. Those are government/agronomist/lender artifacts.

What stevi *can* produce — and what no competitor offers conversationally — is a **supporting activity record**: the farmer's own structured season history (applications + manejo) plus what stevi knows about the farm, formatted so the farmer hands it to their **agrônomo / cooperativa / bank** as documented input for the projeto técnico and underwriting.

Same posture as the caderno and the receituário: **stevi produces the record; the professional and the lender make the decision.** Every surface says so.

**Hard line — do NOT collect over WhatsApp:** CPF, DAP/CAF number, CAR number, bank details, or income figures. That's sensitive PII/financial data, an LGPD liability, and unnecessary — the report is a *manejo* record, not a credit form. Farmer identity beyond what we already have (name, município/UF, crops) is optional and self-declared only.

## 2. What it reuses vs. what's new

This is **largely a report-template variant**, not new infrastructure — the whole Phase 1/2 report stack is reusable:
- **Reuse as-is:** `reportToken.ts` (signed HMAC+TTL URLs), transport document delivery (`mediaType:'document'`), the pipeline PDF second-send, `listApplications`/`getActivityLog`/`getFarmProfile`/`getFarm`.
- **Reuse with a variant:** `report/pdf.ts` (pdf-lib primitives) and `cards/applications.ts` (report model) — parameterized by report *kind*.
- **New:** a financing report composer (farm-ID header + season aggregates + the application table), a financing PDF template, an intent + trigger, and a `kind=pronaf` branch on the report endpoint.

## 3. What the report contains

A one/two-page PDF (+ optional PNG summary), titled *"Histórico de Manejo da Safra — apoio ao crédito rural (PRONAF)"*, with:

1. **Identificação (what stevi knows / farmer optionally confirms):** producer name, município/UF, crops, coarse location, safra period, irrigated y/n, planting date. No CPF/DAP.
2. **Resumo da safra (aggregates — the underwriting-relevant evidence):** number of applications, area under management (from `applications.area_ha`), crops managed, activity span, count of pest triages / satellite reads / spray consults (from the activity log) — i.e. evidence of **active, documented management**.
3. **Registro de aplicações:** the caderno table (date · crop · product · dose · target · MAPA cross-ref) — the existing Phase 1 content.
4. **Framing footer (legal guardrail):** *"Documento de apoio, gerado a partir dos registros do produtor. NÃO é o projeto técnico, a DAP/CAF, o CAR nem a solicitação de crédito — leve ao seu agrônomo/cooperativa/banco. A responsabilidade técnica (ART) e a análise de crédito são deles."*

## 4. Data reality (grounded in the schema)

| Have | Source | Lack (stays off-platform) |
|---|---|---|
| producer name, UF | `users` | CPF |
| crops, irrigated, planting_date | `farms` | DAP/CAF number |
| coarse location (lat/lon) | `farms` | CAR number, área total registrada |
| application history (crop, product, dose, area_ha, target, date) | `applications` | produtividade / income figures |
| activity counts (triages, satellite, spray, referrals) | `messages` (`getActivityLog`) | bank/lender data |

The aggregates come entirely from data we already hold — no new capture required for the MVP.

## Phase A — MVP (financing-framed report on existing rails)

- **A.1 Composer** `report/financing.ts` (pure + tested): `buildFinancingReport(user, profile, farm, applications, activity)` → a model with the identificação header, safra aggregates, and the (reused) application lines.
- **A.2 PDF template:** a financing variant in `report/pdf.ts` (reuse the table/font primitives; new header + aggregates block + financing footer). Sanitize/gate-safe as before.
- **A.3 Endpoint:** extend `api/report.ts` with `&kind=pronaf` → financing composer + template; same token verification, same `private, no-store`. (Token signs `userId` only; `kind` is a non-sensitive query param.)
- **A.4 Intent + trigger:** `isFinancingReportRequest` — `relat[óo]rio (pro|para o) (banco|pronaf|financiamento|cr[ée]dito)`, `documento pro cr[ée]dito rural`, `pra pegar (o )?cr[ée]dito`. New `financing_report` intent; pipeline branch mirrors `application_report` (safe caption + signed PNG/PDF via `extraCardUrl`/`extraDocUrl`, empty-state nudge). Receituário-style honest redirect if the farmer asks stevi to "fazer o PRONAF": explain we build the supporting record, not the application.
- **A.5 Tests:** composer (aggregates, empty season), template renders a valid PDF, caption/empty gate-safe, intent regex incl. confusables (not "preço do crédito"...).

**Phase A ships the whole feature for a farmer who's been logging** — reusing ~all of Phase 1/2.

## Phase B — light enrichment (optional, self-declared only)

- Conversationally confirm/fill the identificação header the farmer *wants* on the doc: nome completo, município, cultura/área da safra. Stored on the existing farm/user rows. **No CPF/DAP/CAR prompts.** Effort: S.

## Phase C — cooperativa / revenda B2B2C (gated on the GTM decision)

- A co-branded / batch variant a cooperativa técnico can pull for their associados (ties to the backlog's B2B2C distribution test). Only after Phase A validates the doc is useful and the channel decision is made. Effort: M+.

## Open decisions (need a human/agrônomo, not code)

1. **Template validation — the #1 risk.** What does a real cooperativa/bank credit desk actually want in a supporting *manejo* doc? Build Phase A thin and put it in front of one agrônomo/cooperativa partner before polishing. The report's value is empirical, not assumed.
2. **How much identity to put on the doc** (name/município only, vs. more) — balance usefulness vs. the no-sensitive-PII line.
3. **Beachhead alignment:** PRONAF = agricultura familiar. This reinforces a **coffee/dairy/hortifruti family-farmer** beachhead (not broadacre). Confirm before building B/C.
4. **"Activity" breadth:** applications only, or the full manejo history (triages, satellite, spray consults) as management evidence? Leaning full history — it's stronger underwriting signal and already logged.

## Effort & sequencing

| Phase | Scope | Effort | Ships |
|---|---|---|---|
| A | financing composer + PDF template + endpoint kind + intent/pipeline + tests | S–M | usable supporting doc, reuses Phase 1/2 |
| B | self-declared identificação enrichment | S | a fuller header |
| C | cooperativa B2B2C variant | M+ | channel play — gated on GTM |

Phase A is the whole MVP. Validate with one agrônomo/cooperativa (open decision #1) **before** B/C.

## Risks
- **Overpromise** (farmer thinks it's the PRONAF application) → explicit framing on every surface; the honest redirect.
- **Template mismatch** → ship A thin, validate with a real credit desk fast, iterate.
- **PII creep** → hard line against CPF/DAP/CAR/bank data; self-declared identity only.
- **LGPD** → same signed-URL / `private, no-store` / deletion-cascade discipline as the caderno (the `applications` data already cascades; no new sensitive table).
