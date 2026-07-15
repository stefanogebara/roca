# Location decoupling — "onde você está" ≠ "onde é a lavoura"

**Status: DONE + verified, HELD before commit/push** (user decision, 2026-07-15).
The change is complete, reviewed, and green — it is *not* committed because a
concurrent **caderno-de-aplicações** feature (another session) left uncommitted
edits in the same `pipeline.ts` / `db.ts`, and its migration 28 is not in prod.
The two are entangled in those shared files, so they must ship together (or be
split with `git add -p` in an interactive terminal). Nothing of the caderno
work was touched.

## Problem it fixes
A dropped WhatsApp pin was treated as the farm unconditionally. A farmer
messaging from a São Paulo apartment got their rooftop analyzed as "sua
lavoura" (soil, spray verdict, NDVI "vegetação rala") — a confidently wrong
answer, the one thing an agronomy tool must never give. And there was no way to
say where the field is by name (técnico/consultor never standing on it).

## What shipped (all mine, this session)
- **Pin-drop vegetation gate.** `interpretLand()` in `api/_lib/tools/ndvi.ts`
  (NDVI < `VEGETATION_MIN_NDVI` 0.15 → `no_vegetation`; null → `unknown` → FAIL
  OPEN). `buildFarmCard` (`api/_lib/farmcard.ts`) fetches NDVI in parallel
  (time-capped 7s via `withCap`, pre-warms cache), and on no-vegetation returns
  `{text, card:false}` — an honest "não achei vegetação aí, é aí mesmo?" and
  `awaiting='farm_confirm'` — instead of a farm card. `isFarmConfirmYes`
  ("é aí mesmo"/"tá em pousio") keeps the pin; else the state clears.
- **Stated location by name.** `api/_lib/location.ts`:
  `isLocationSettingRequest` (regex gate), `resolveStatedLocation` →
  discriminated union `resolved | ungeocodable | no_place` (cheap-LLM extract →
  `geocodeCityBR`). "minha lavoura fica em Patrocínio-MG" → city centroid
  (`location_precision='city'`, migration 27, applied) + confirm-and-refine.
- **NDVI precision gate.** `reason.ts handleFieldHealth` refuses NDVI at a city
  centroid (asks for the pin); the card path (`cardUrlFor`) skips it too.

## Review fixes (adversarial pass, all applied)
1. **HIGH** — no-vegetation reply still shipped a "SUA LAVOURA" card image →
   `buildFarmCard` returns `{text, card}`; pipeline `suppressCard` gates media.
2. **HIGH** — `sou de/do` over-matched ("sou do João" → "não achei essa
   cidade") → `no_place` vs `ungeocodable` split; only a *named* place earns the
   ask, everything else falls through.
3. **MEDIUM** — city-precision `field_health` still attached an NDVI card of the
   centroid → precision guard in `cardUrlFor`.
   (MEDIUM latency mitigated by the 7s `withCap`.)

## Verification
- `tsc --noEmit` clean; full suite **448/448** (47 files) incl. concurrent work.
- New tests: `landcheck`, `farmcard`, `location`, + pipeline/reason-spray cases.
- Migration **27** (`location_precision`) applied to prod.

## ✅ pipeline.ts RECONCILED with the caderno feature (2026-07-15)
The `pipeline.ts` wiring was briefly clobbered by the concurrent caderno session,
then re-integrated: the current file carries BOTH my location wiring
(`confirmYes`/`statedLocation` precompute, the farm_confirm + resolved +
ungeocodable branches, `suppressCard` + mediaUrl gate, `{text,card}` location
branch, `cardUrlFor` city-precision guard, all imports) AND the caderno
application-log/report branches. No conflict markers. Verified: `tsc --noEmit`
clean, full suite **473/473** (50 files). Nothing left to re-apply.

## To unblock the push
Ship both features together once caderno is ready: apply migration 28, then
commit (ideally two conventional commits, split via `git add -p` in a terminal),
push → deploy. Suggested message for this half:
`feat(location): decouple where-you-are from where-the-field-is — vegetation gate on pin drop + stated location by name`.
