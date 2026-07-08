# Stevi — Knowledge Base & Grounding

How Stevi's agronomic claims stay honest and current. This is the operational side
of the prime directive: *never invent agronomy*. Everything Stevi asserts about
pests, products, or the season is either grounded in an official source or withheld.

## Table of contents

- [Sources at a glance](#sources-at-a-glance)
- [The `knowledge/` folder](#the-knowledge-folder)
- [Agrofit registry slice](#agrofit-registry-slice)
  - [What it is](#what-it-is)
  - [How the slice is built](#how-the-slice-is-built)
  - [Slice structure](#slice-structure)
  - [How it's used at query time](#how-its-used-at-query-time)
  - [Refreshing when the registry updates](#refreshing-when-the-registry-updates)
- [Vazio sanitário calendar](#vazio-sanitário-calendar)
  - [What it is](#what-it-is-1)
  - [How it's encoded](#how-its-encoded)
  - [Refreshing each season](#refreshing-each-season)
- [The daily monitor](#the-daily-monitor)
- [Known gaps](#known-gaps)

---

## Sources at a glance

| Grounding | Source of truth | Lives in code as | Refresh cadence |
|-----------|-----------------|------------------|-----------------|
| Registered products per crop/pest | Agrofit / MAPA "produtos formulados" open dataset | `api/_lib/data/agrofit.json` (runtime) built from `knowledge/agrofit/produtos_formulados.csv` | when the registry updates |
| Soy vazio sanitário windows | Portaria SDA/MAPA nº 1.579/2026 | `VAZIO_SOJA_2026` in `api/_lib/tools/calendar.ts` | **every season** (new portaria) |
| Agronomic reasoning priors | EMBRAPA / FRAC-BR doctrine | prose in `api/_lib/prompts/system.ts` | as doctrine changes |

## The `knowledge/` folder

Raw and derived grounding artifacts:

```
knowledge/
  SOURCES.txt                        provenance notes (URL + retrieval date per source)
  portaria-sda-mapa-1579-2026.txt    extracted text of the vazio-sanitário portaria
  agrofit/
    produtos_formulados.csv          ~369 MB MAPA open dataset (local input; large)
    registry-slice.json              built slice (~548 KB) — the extract script's output
```

`SOURCES.txt` records where each source came from and when — for the portaria:
the EMBRAPA-hosted PDF URL and a retrieval date of 2026-07-07. Keep it updated when
you refresh a source; provenance is part of the grounding contract.

> The 369 MB `produtos_formulados.csv` is a bulky local input, not something the
> function needs at runtime — only the compact `registry-slice.json` (copied to
> `api/_lib/data/agrofit.json`) ships. Treat the CSV as a build-time artifact.

## Agrofit registry slice

### What it is

Agrofit is MAPA's official registry of agricultural pesticides. Stevi uses a
**pre-extracted slice** of the "produtos formulados" open dataset to answer, for a
given crop and pest, *what is officially registered* — active ingredients, product
classes, and a count of registered products — **without** any dose or application
instruction. This turns a pest answer from model memory into cited fact, and keeps
Stevi on the legal side of the prescription boundary (it reports what exists; it
never says "apply this").

The slice is filtered to **`SITUACAO=TRUE`** rows only — products with an *active*
registration. Dosages are deliberately stripped during extraction.

### How the slice is built

`scripts/agrofit-extract.mjs` streams the ~369 MB CSV (it never loads it whole) and
keeps only rows that (a) are `SITUACAO=TRUE` and (b) match a focus crop or "todas as
culturas". For each `(crop, pest)` it accumulates:

- scientific name(s) (`PRAGA_NOME_CIENTIFICO`),
- product class(es) (`CLASSE`, e.g. Fungicida, Inseticida, Herbicida),
- active ingredient **names** (`INGREDIENTE_ATIVO`), with parenthetical
  dosage/description removed by `cleanActive` so only the active name remains,
- a count of matching registered products.

Focus crops are matched by regex on the `CULTURA` column: `soja`, `milho`, a
pasture group (`pastagem|pasto|capim|forrage|braqui`), `café` (`Café`), and
`citros` (`Citros`/`Limão`). Rows tagged "todas as culturas" are kept in a
separate `todas` bucket and unioned into every crop at query time. `MODO_DE_ACAO`
is intentionally dropped (it's inconsistent free text, not the FRAC/IRAC group —
the model infers groups from the actives instead).

Run it from the repo root:

```bash
node scripts/agrofit-extract.mjs
# writes knowledge/agrofit/registry-slice.json and prints seen/kept counts + size
```

**Then copy the slice to the runtime location** (the script does not do this):

```bash
cp knowledge/agrofit/registry-slice.json api/_lib/data/agrofit.json
```

`api/_lib/tools/agrofit.ts` reads `api/_lib/data/agrofit.json` at module init (a
runtime `readFileSync`, deliberately not a static `import` — importing a ~550 KB JSON
literal made `tsc` take minutes), and `vercel.json` ships that file with the function
via `includeFiles`. There is also a profiling helper, `scripts/agrofit-profile.mjs`,
that reports row counts, column consistency, and `SITUACAO` value distribution for a
fresh CSV.

### Slice structure

```jsonc
{
  "meta": {
    "source": "Agrofit / MAPA — produtos formulados (dados.agricultura.gov.br)",
    "generated_from": "produtos_formulados.csv",
    "filter": "SITUACAO=TRUE (registro ativo)",
    "crops": { "soja": 741, "milho": 614, "pastagem": 20, "cafe": 531, "citros": 567, "todas": 224 }
  },
  "data": {
    "soja": {
      "ferrugem asiática": {
        "pest": "ferrugem asiática",
        "sci": ["Phakopsora pachyrhizi"],
        "classes": ["Fungicida"],
        "ativos": ["azoxistrobina", "..."],   // names only, no doses; capped at 30
        "products": 123                          // count of active registrations
      }
    },
    "milho":     { /* … */ },
    "pastagem":  { /* … */ },
    "todas":     { /* “todas as culturas” bucket */ }
  }
}
```

The counts in `meta.crops` are pest-keys per crop, not product counts. `source` is
surfaced to the model in the grounding block so the citation is explicit.

### How it's used at query time

On a pest question (`api/_lib/reason.ts` → `pestGrounding`):

1. The cheap tier extracts `{crop, pest}` from the farmer's text.
2. `lookupPest(normalizeCrop(crop), pest)` searches the crop bucket **and** the
   `todas` bucket, scoring candidates accent- and hyphen-insensitively (so
   "lagarta-do-cartucho" == "lagarta do cartucho"), with the crop-specific bucket
   weighted above `todas`. If nothing clears a **confidence floor of 50**, it
   returns `null` — Stevi would rather say nothing than mis-ground.
3. A hit becomes a `groundingBlock`: the registered actives (no doses), classes, and
   product count, plus a FRAC/IRAC rotation nudge and a restatement that product and
   dose are the agronomist's call. This block is injected into the reasoning prompt
   labelled "use this as base, don't invent".

The **photo triage path** grounds the same way: `handleVision` first identifies the
pest from the image as structured data, then feeds `{crop, pest}` through the same
`lookupPest`/`groundingBlock` so the composed answer cites the registry — unless
confidence is low, in which case it stays with an honest "not sure, send a better
photo / see an agronomist" rather than grounding a guess.

### Refreshing when the registry updates

1. Download the current `produtos_formulados.csv` from the MAPA open-data portal
   (`dados.agricultura.gov.br`) into `knowledge/agrofit/`.
2. (Optional) `node scripts/agrofit-profile.mjs` to sanity-check columns and the
   `SITUACAO` distribution.
3. `node scripts/agrofit-extract.mjs` to rebuild `registry-slice.json`.
4. **Copy** it to `api/_lib/data/agrofit.json`.
5. Update `knowledge/SOURCES.txt` with the new retrieval date, and redeploy.

## Vazio sanitário calendar

### What it is

*Vazio sanitário* is a legally mandated period with no live soy in the field during
the off-season, to break the green bridge that carries Asian soybean rust
(*Phakopsora pachyrhizi*) into the next crop. The windows are set **per state (UF)**
every season by a MAPA portaria and **change every year**. Stevi uses them to tell a
farmer whether their state is currently in vazio, and the daily monitor uses them to
flag imminent transitions.

### How it's encoded

`api/_lib/tools/calendar.ts` holds `VAZIO_SOJA_2026`: a per-UF table of
`{ start, end, regional }` ISO-date windows for the **2026/2027** season, pinned from
**Portaria SDA/MAPA nº 1.579, de 09/04/2026** (raw text in
`knowledge/portaria-sda-mapa-1579-2026.txt`). Behaviour:

- **`vazioStatus(uf, date)`** — returns a WhatsApp-ready PT-BR line stating whether
  vazio is active and citing the portaria. States where the portaria subdivides by
  region carry `regional: true`; for those the table stores an *envelope* window
  (earliest start → latest end) and the reply **hedges** ("varia por região…
  confirme a data exata"), rather than asserting one date.
- **Unknown or null UF → silence** (`known: false`, `line: null`). Never invent a
  date for a state that isn't in the table.
- **`upcomingTransitions(date, withinDays)`** — vazio starts/ends within N days
  across all UFs (feeds the monitor).
- **`isCalendarStale(date)`** — true once the date is ~2 months past the latest
  window end, i.e. the season's portaria is likely superseded.

The `tests/calendar.test.ts` suite pins several of these (MT active on 2026-07-07,
GO inclusive boundaries, PR regional hedge, unknown UF silent).

### Refreshing each season

When MAPA publishes the next season's portaria (typically early in the calendar
year, before the off-season):

1. Extract the new portaria's text into `knowledge/` (there's a one-off helper,
   `scripts/extract-pdf.mjs <src.pdf> <out.txt>`), and update `knowledge/SOURCES.txt`.
2. Replace `VAZIO_SOJA_2026` in `api/_lib/tools/calendar.ts` with the new per-UF
   windows (rename the constant and the `SOURCE_LINE` to the new portaria number;
   update the `fmt` year-suffix logic if the season crosses into a new year).
3. Update `tests/calendar.test.ts` expectations to the new dates.
4. Redeploy. The daily monitor's staleness flag is your reminder that this is due.

## The daily monitor

`api/cron/monitor.ts` is the "legitimate 24/7": one scheduled function, one digest
per day (see [the deployment doc](../deployment/) for the cron/auth setup). It reads
only from the grounded calendar table — no fragile scraping — and each run records
`upcomingTransitions` (next 7 days) and the `isCalendarStale` flag into
`monitor_runs`. When `stale` is true it emits a finding telling the operator to fetch
the new portaria and rerun the Agrofit extract. This is how staleness becomes a
visible signal instead of silent rot.

## Known gaps

Surfaced during documentation; **not fixed here**:

- **Extract output ≠ runtime path.** `agrofit-extract.mjs` writes
  `knowledge/agrofit/registry-slice.json`, but the code reads
  `api/_lib/data/agrofit.json`. The manual copy is required and undocumented in the
  code comments (the `agrofit.ts` header says only "Rebuild with
  scripts/agrofit-extract.mjs"). Easy to rebuild and forget to copy.
- **Season constant is year-named.** `VAZIO_SOJA_2026` and the `fmt` helper's
  `y !== 2026` special-case bake the 2026/27 season into names/logic; refreshing
  next season means touching both, not just the data.
