# stevi backlog — re-prioritized for Brazilian-market fit

**Date:** 2026-07-16 · **Basis:** 4-stream BR market research (segments, regulation, competitors, per-feature fit) reality-checking the tomiyasu16 (Hokkaido) audit. Supersedes the flat audit backlog.

## The thesis this backlog encodes
The blog gave us the right **philosophy** (WhatsApp/voice-native, near-zero data entry, compliance + agrônomo handoff) — validated independently by every serious Brazilian competitor — but its **hardware/maker features are Japan artifacts** that don't fit Brazil. Our one shipped feature, the **caderno de aplicações**, is the **most defensible wedge in the set**. Prioritize the wedge; drop the artifacts.

**Two hard constraints from the research:**
1. **Not first.** "WhatsApp AI agronomist" is a contested category — **On Agri** (near-identical, paid R$147+/mo) and **RAImundo** (Embrapa/MAPA, *free*, smallholder-targeted) are already live. WhatsApp-first is table stakes, not a moat. Differentiation must be **conversational compliance records + all-in-one bundle below R$147 + agrônomo handoff**.
2. **Necessity is segment-specific.** The caderno de campo is *legally mandatory* only for **hortifruti** (INC 02/2018, enforced with fines + load seizure); it's credit/credibility elsewhere. Paying willingness concentrates in **commercial-family / médio produtor in coffee, dairy, horticulture** — not broadacre (over-served) and not subsistence (under-monetizable).

---

## P0 — NOW (the wedge; this is the product)

| # | Item | Status | BR rationale | Effort |
|---|---|---|---|---|
| 1 | **Caderno de aplicações — harden for a beachhead** | BUILT (Ph 0-2) | The only place a *farmer* generates a compliance record conversationally. Legally mandatory for hortifruti; credit tool for coffee. This is the moat — make it airtight. | — (polish) |
| 2 | **PRONAF / crédito-rural report variant** | backlog | **Brazil-only, no Japan analog.** R$89B/yr family-ag credit needs auditable records; nearly free on top of the caderno data. Highest leverage new build. | S–M |
| 3 | **Voice-first capture — make it frictionless** | BUILT-ish | Revealed preference: every BR competitor pitches "send a voice note" to beat *morte por digitação*. This is the adoption unlock for the low-literacy family farmer. | S |
| 4 | **Pick the beachhead: hortifruti OR coffee** (GTM decision, not code) | decision | Hortifruti = caderno is a legal *must* (sharpest wedge). Coffee = biggest family-ag value + heat-alert fit. **Horticulture is where both align** — the natural first beachhead. | decision |

## P1 — NEXT (deepen the wedge + segment fit + GTM)

| # | Item | Status | BR rationale | Effort |
|---|---|---|---|---|
| 5 | **AGROFIT product-level enrichment** (was Ph 2.4) | backlog | Upgrades the caderno verdict from "presença" to a real per-product/dose compliance check — strengthens the one moat competitors don't have. | M (data) |
| 6 | **Heat-stress alert → re-target to COFFEE flowering** | backlog (reframe) | Broccoli>30°C doesn't translate to broadacre, but maps almost literally to café flowering (>30°C, +1.2°C trend since 2010). Reuses the frost-card pattern. Segment fit for a coffee beachhead. | S |
| 7 | **Vision pest ID — reframe, don't reinvent** | backlog (reframe) | Plantix already owns free photo-ID. Differentiate: AGROFIT-grounded + **ends in an agrônomo handoff** (receituário law — never "spray this") + auto-logs to the caderno. The integration is the edge, not the diagnosis. | M |
| 8 | **Distribution test: cooperativa / revenda B2B2C** | GTM | How ManejeBem et al. actually monetize thin-ARPU smallholders. Pure B2C subscription fights RAImundo's "free." | GTM spike |
| 9 | **Positioning vs On Agri / RAImundo** (copy + pricing below R$147) | GTM | Lead on compliance-caderno + bundle + price. Don't sell "generic WhatsApp agronomist" — that fight is crowded. | GTM |

## P2 — LATER / opportunistic

| # | Item | Status | Note |
|---|---|---|---|
| 10 | **NDVI — make delivery proactive** | BUILT | Imagery is commoditized (all competitors have free Sentinel-2). No new capability — differentiate by *pushing* dips into the thread + bundling with spray/pest, not a dashboard. |
| 11 | **Field-polygon storage → per-zone NDVI** | backlog | Only matters for broadacre (100s–1000s ha). Deprioritize unless we chase médio/broadacre — not the core segment. |
| 12 | **Commodity price cards** | BUILT | Table stakes, zero moat. Keep as engagement/retention glue. |
| 13 | **Grower-to-grower content/video growth loop** | backlog | Unvalidated hypothesis (no BR evidence either way). Test cheaply before investing. |

## KILLED — Japan artifacts (do not build)

| Item | Why it dies in Brazil |
|---|---|
| **GPS "onde trabalhei hoje" tractor-log** | Broadacre-only (needs autosteer-equipped machines); useless to the family-farmer core. |
| **Third-party IoT / SwitchBot sensor bridge** | BR ag-IoT is pilot-stage; no retail ecosystem to integrate; 16% good-quality rural connectivity. |
| **Chat-triggered actuation (vent motors)** | No BR actuator/hardware market; a DIY-maker Japan pattern with no analog. |
| **DIY 3D-printed farm parts via AI** | Pure Hokkaido maker artifact. Brazilian parts run through dealers/coops. |

---

## Sequencing logic
- **Everything in P0 compounds the moat** (compliance record) that no competitor has, at the price tier below the paid incumbents.
- **P1 #5–7 make the wedge sharper and segment-specific**; **P1 #8–9 answer "how do we sell it against free RAImundo and paid On Agri."**
- **P2 is defensive/glue** — keep parity (NDVI, prices) without pretending they're differentiation.
- **Killed items are a distraction tax** — they consume build time on features Brazilian farmers can't/won't use.

## Open strategic questions (owner: founders)
1. **Beachhead:** hortifruti (legal necessity, harder GTM) vs coffee (bigger value, softer necessity)? Horticulture bridges both.
2. **Channel:** direct-to-farmer B2C vs cooperativa/revenda B2B2C (or both, phased)?
3. **Pricing floor:** how far below On Agri's R$147.90/mo, given RAImundo is free?
4. **Moat durability:** On Agri could add a caderno; RAImundo could add breadth. What compounds our lead — data (farmers' own history), agrônomo network, or coop lock-in?

## Sources
Full research + citations in the four completed streams (segments, regulation, competitors, per-feature fit) from the 2026-07-16 validation; headline sources: IBGE Censo Agropecuário 2017, MAPA INC 02/2018, Lei 14.785/2023, Radar AgTech Brasil 2025, ABMRA/PwC connectivity surveys, On Agri, RAImundo (Embrapa/MAPA/MDA).
