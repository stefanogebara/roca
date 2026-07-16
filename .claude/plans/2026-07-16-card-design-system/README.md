# stevi card design system — "pro, not vibecoded"

**Date:** 2026-07-16 · **Reference bar:** just-br.com (user-chosen) · **Pilot:** prices card.

## Diagnosis (from live renders vs. the reference)
Same design family (cream ground, deep green, serif numerals, white card) — the gap is execution:
tofu glyphs (▲▼/emoji missing from bundled fonts under resvg `loadSystemFonts:false`), no type
scale, no grid, duplicated labels, no brand anchor, flat single-layer composition, no data-viz.

## Principles (hard rules for every rendered card/PDF)
1. **No font-glyph icons, no emoji in rendered images.** Icons are drawn SVG paths (triangles,
   pills, dots). Emoji stay in WhatsApp *text*, never in PNGs/PDFs.
2. **One type scale, five steps** (at 900px width): display 44 · h1 30 · h2 22 · body 18 ·
   small 15 · micro 12.5. Nothing off-scale.
3. **8px spacing grid, 56px margins, shared baselines per row.** Columns align; numbers use the
   serif on a common baseline with their labels.
4. **One label per element.** Name once; qualifiers (exchange, unit) as a single micro sub-line.
5. **Brand anchor on every card:** "Stevi" logotype (Instrument Serif, deep green) + middot +
   card title (DM Sans, muted). Same position always.
6. **Atmosphere + depth:** soft green→cream vertical gradient wash behind the top of the card;
   white card with a faint offset shadow rect (resvg-safe — no filter dependence).
7. **Data gets a visual:** trends are drawn chips (tinted pill + triangle + %), series get a real
   sparkline — never a fabricated one (only render when ≥3 true data points exist).
8. **Semantic colors ≠ accent.** go/caution/no-go tints are reserved for state; the brand green
   does identity.

## Tokens (implemented in `api/_lib/cards/render.ts` as `T` + helpers)
- Palette adds: `atmoTop #dfe8d3`, `pillGo #e3f2e7`, `pillNo #f7e3df`, `pillFlat #eceae2`,
  `inkSoft #4b564f` (existing `C` palette unchanged — legacy cards keep rendering).
- Helpers: `cardShell()` (bg + atmosphere + shadow + card), `brandHeader()`, `trendChip()`
  (drawn, tofu-proof), `sparkline()` (normalized polyline + endpoint dot), `hairline()`.

## Rollout
1. **Pilot: prices card** (most-forwarded → organic-growth surface) + honest 7-point sparkline
   (Yahoo closes already fetched; converted to R$/saca, packed in the card URL).
2. Then: NDVI, farm, frost, spray, pest cards — recomposed from the same helpers.
3. Then: both PDF templates (caderno + histórico de manejo) pick up the same scale/rules.
4. Landing page (`public/`, `web/`) aligns to the same tokens — separate workstream (in flight).

## Explicitly rejected approaches
- Pinterest-first moodboarding (reference already chosen; taste must land in SVG code).
- Stitch/Figma as the pipeline (they emit app screens, not our resvg templates — fine for
  *exploring* landing-page directions later, not for cards).
