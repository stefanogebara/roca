# Named multi-fields — scope

**Status: SCOPED, not started.** This is a plan, not a commitment. It exists so
the work can be executed accurately (and estimated honestly) when there's demand.

## TL;DR recommendation

**Hold the build; keep this ready.** The beachhead (smallholder MG coffee, ~1
talhão) doesn't need it, and the técnico/consultor buyer is already served by
the shipped *location-by-name* (analyze any place ad-hoc). Multi-field is a
*grow-with-the-customer* feature whose payoff is **persistent per-field history**
(caderno + NDVI trend per talhão) — and the caderno is still nascent, so the
payoff is future. Build it when a real farmer asks to track a second field.

When greenlit, execute **Phase 0 → 3 in order** (below). Phase 0 is a pure
de-risking refactor with zero farmer-visible change; Phases 1–3 add the UX
incrementally, each shippable and separately validatable. Do **not** build the
field-selector UX on spec — Phase 2 is where the low-literacy-over-WhatsApp risk
lives and it needs a real multi-field user to validate.

## The core problem

`farms` has `unique (user_id)` — one farm per user
([init.sql:28](../../../supabase/migrations/20260707000001_init.sql)). Everything
downstream quietly relies on that: reads collapse to "the farm", writes upsert
onto the single row.

⚠️ **The load-bearing risk.** Today `getFarm`/`getFarmLocation`'s
`order('updated_at').limit(1)` and every `onConflict:'user_id'` upsert are
*equivalent* to "the one farm" **only because** the unique constraint holds. The
moment it's relaxed, those upserts become **silent overwrites** and those reads
become **silent "arbitrary field" picks** — no error, just wrong data. **De-coupling
these sites IS Phase 0's real work**, not the `alter table`.

## What's already field-ready (good news)

- `farm_derived` (soil + NDVI cache) is keyed by `farm_id` — per-field already.
- `applications.farm_id` exists and is nullable — the caderno record is
  field-capable at the schema level; `insertApplication(userId, app, farmId)`
  already takes it.
- `deleteUserData` wipes `farms` by `user_id` — multi-row-safe for LGPD.

## Schema changes (Phase 0 migration)

```sql
-- Relax one-per-user. (verify the auto-name with \d farms first.)
alter table public.farms drop constraint if exists farms_user_id_key;
-- The farmer's name for the field; null = the unnamed default (single-field case).
alter table public.farms add column if not exists label text;
-- Conversational cursor: which field the current thread is about.
alter table public.users add column if not exists active_farm_id uuid
  references public.farms(id) on delete set null;
-- Field-aware alert dedup (nullable — vazio stays UF-level, per-user).
alter table public.farmer_alerts add column if not exists farm_id uuid
  references public.farms(id) on delete cascade;
```
**Backfill:** existing farms are already 1-per-user → set each user's
`active_farm_id` to their farm; leave `label` null. No data migration risk.

## Core abstraction (the resolver)

The whole feature reduces to one idea: **resolve which field a message is
about**, then everything downstream is already field-scoped (`farm_derived`,
`applications`). New `db.ts` surface:

- `getActiveFarm(userId)` → `active_farm_id`'s farm, else the user's only/most-
  recent. **Replaces `getFarm` at read sites** (deterministic, not "arbitrary").
- `listFarms(userId)` → all fields (for the selector + "meus talhões").
- `resolveFarmFromText(userId, text)` → fuzzy-match a label named in the message
  ("no talhão do córrego") → the power-user path, no selector needed.
- `addFarm(userId, lat, lon, precision, label?)` → **INSERT** a new field.
- `setActiveFarm(userId, farmId)` → move the cursor (called after any resolve).
- `setFarmLocation` → stops upserting-on-user_id; updates a specific `farm_id`
  (the active/target field) — pin-drop flow decides new-vs-move.

## UX interaction model (the hard part)

**Invariant: the single-field experience never changes.** A farmer with one
field sees no selector, no naming prompt, nothing new. Multi-field is progressive
— it only appears at the moment a second field is added.

- **Field 1** — first pin → creates the field, unnamed, active. As today.
- **Adding field 2** — a second pin → detect new-vs-move (distance heuristic: a
  pin >~1 km from the existing field defaults to "new", but always confirm):
  *"Esse é um novo talhão, ou você tá corrigindo a localização do [talhão
  atual]?"*
  - New → *"Show! Como você chama esse talhão? (ex: 'talhão do córrego',
    'lavoura de cima')"* (`awaiting='field_label'`); then also name field 1 if
    it's still unnamed.
  - Move → update the existing field's location (today's behavior).
- **Asking which field** (only at 2+ fields, question with no named field) →
  quick-reply buttons of the labels (existing "buttons are real queries"
  pattern); the tapped label routes back through the pipeline. >3 fields → ask
  by name.
- **Named-field parse** — *"posso pulverizar no talhão do córrego?"* →
  `resolveFarmFromText` → answer directly, no selector.
- **Active-field cursor** — after any resolve, that field becomes active, so
  follow-ups (*"e o vigor?"*) stay on it without re-asking.
- **Management** — *"meus talhões"* (list + which is active), *"renomeia … pra
  X"*, *"apaga o talhão X"*.

## Coupling inventory → change map

From the full sweep. Grouped by phase that touches it.

**db.ts — the coupling core (Phase 0):**
- Silent-overwrite/arbitrary-pick sites to de-couple: `setFarmLocation` (:83,
  `onConflict:user_id`), `getFarm` (:103, limit1), `getFarmLocation` (:242,
  limit1), `setFarmCrops` (:149, `onConflict:user_id`), `getFarmProfile` (:515).
- Fleet readers that become multi-row/user: `listFarmsWithCoords` (:615, one pin
  per field — frost/fire), `listSojaFarmersByUf` (:590), `opsData.ts` farm
  join (:117, keeps an arbitrary field per user).
- Alert dedup without farm scope: `claimFarmerAlert`/`releaseFarmerAlert` (:640).
- `listApplications` (:487) is `user_id`-only — add an optional `farmId` filter.

**Pipeline branches needing a field pick (Phase 2, via the resolver):**
`spray_window` (pipeline:204, reason `handleSpray`:172), `field_health`
(pipeline:208, reason `handleFieldHealth`:86), pin-drop→`buildFarmCard`
(farmcard:109, the write path — Phase 1), stated-location (pipeline:585),
`farm_confirm` (pipeline:575, farmcard:150), `application_log` (pipeline:672,
already stamps `farm_id`), `application_report` (pipeline:627, user-wide list).

**Alerts (Phase 3)** — `runFrostAlerts`/`runFireAlerts` (alerts.ts:215/:162)
iterate per pin, but `frostDedupKey`/`fireDedupKey` (:58/:89) carry **no farm/
coords**, so a multi-field user is deduped to ONE alert even if only one field
is at risk. Fix: bake `farm_id` into the dedup key + name the field in the text.
Vazio (`runVazioAlerts`:121) is UF-level — unchanged.

**Onboarding state** — new `awaiting='field_label'`; `location_precision` stays
a per-field column (already right). Existing `crop`/`farm_confirm` become
active-field-scoped.

**Test fixtures to update:** farmcard.test.ts:33, pipeline.test.ts:127/:356,
reason-spray.test.ts:111 (all mock a single farm).

**Not coupled (no change):** digest, cohort, growth, all of prospect/** (separate
table), the marketing landing (static "SUA LAVOURA" demo).

## Phasing

**Phase 0 — schema + resolver + de-couple (zero UX change).** The migration
above; `getActiveFarm`/`listFarms`/`addFarm`/`setActiveFarm`/`resolveFarmFromText`;
rewrite every `onConflict:user_id` / `limit(1)` site to be `farm_id`-explicit;
swap all `getFarm`→`getActiveFarm` callers; update test fixtures. **No farmer
sees any difference** — still one field, but the constraint no longer load-
bearing. *Effort: ~1 focused session. Risk: low (behaviour-identical, well-
tested); the de-coupling correctness is the load-bearing part.*

**Phase 1 — add & name a second field.** Second-pin new-vs-move confirm + the
distance heuristic; `awaiting='field_label'` capture; name field 1. A farmer can
now hold 2 named fields; questions default to the active (last-touched) field.
*Effort: ~1 session. Risk: moderate — the new-vs-move confirm must not guess
wrong.*

**Phase 2 — field selection in questions.** The selector (buttons) + named-field
parse + active-field cursor, wired into spray/field_health/caderno via the
resolver. **Highest UX risk** (field selection over WhatsApp for low-literacy
users) — validate with a real multi-field farmer before over-building. *Effort:
~1–2 sessions.*

**Phase 3 — per-field alerts + caderno + management.** Frost/fire dedup by
`(user, farm, date)` + field-named alert text; caderno report grouped by field;
`meus talhões` list / rename / remove. *Effort: ~1–2 sessions, spread across
surfaces.*

## Open decisions for the founder

1. **Build now, Phase 0 only, or hold?** (Recommendation: hold until a farmer
   asks; the latent landmine is dormant while the constraint stays.)
2. **Active-field model**: `users.active_farm_id` cursor (recommended) vs an
   explicit `is_primary` flag.
3. **New-vs-move detection**: always ask vs distance-heuristic-default + confirm
   (recommended).
4. **Selection UX**: buttons + named-parse both (recommended), buttons as the
   fallback when >3 fields.

## Anti-scope (do NOT do)

- Field polygons / area drawing (the init comment's "polygon later" is a
  separate, much larger bet — keep point locations).
- A web UI for field management — WhatsApp-only, consistent with the product.
- Building the selector UX before a real multi-field user exists to validate it.
