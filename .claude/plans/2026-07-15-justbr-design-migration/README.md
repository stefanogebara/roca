# "Campo Editorial" — design system migrated from just-br.com

**Status: landing + verifier migrated (this commit). Follow-ups below.**
Reference: just-br.com (Framer). Extracted via HTML/CSS token analysis (437 KB
homepage, inline Framer styles) — we adopt the **design language**, never their
identity (no logo/name/copy/imagery). Method: /ui-ux-pro-max (pattern: Minimal
Single Column; style: Exaggerated Minimalism — its generator's blue/Inter
defaults overridden by the extraction, which is the point of a reference site).

## Extracted tokens (frequency-ranked from their CSS)

- **Palette (olive-earth monochrome on warm paper):** ink `#0c0c0c` · brand
  olive `#748145` (50×) · deep olive `#4c5e03` (26×) · dark `#303b0c` · darkest
  `#202410` · light `#95a662` · paper `#fdfcfb` (23×) · olive wash `#f7fbeb`
  (20×) · pale chips `#f0f7d7`/`#e8f4c3` · line `#e3e0dc`. (Their `#09f` link
  blue = Framer artifact, ignored.)
- **Type:** DM Sans (display + body, mostly **weight 400**) + Fragment Mono
  (labels). Display 88/76/58/40px at **-0.03em**, line-height **120%**; body 16;
  mono 12. DM Sans is already Stevi's card font — natural harmony.
- **Shape:** 10px card radius · 999px pills · ONE soft shadow
  `0 4px 50px rgba(97,74,68,.06)`.
- **Spacing:** 8/10/16/24/32 gaps; 80–96px section breaks; card pad 16–24.
- **Voice:** editorial minimal (their h1s are single words).

## Stevi mapping (what changed where)

- `web/styles.css` — legacy var NAMES kept, values re-pointed (zero selector
  churn): `--bone*`→papers, `--green*`→olives, `--terra*`→mid-olive (monochrome;
  terracotta retired), `--wheat`→light olive. Display font → DM Sans 400
  (-0.03em); eyebrows → Fragment Mono 12px caps; radius `--r`→10px; shadows →
  soft diffuse family; contour watermark stroke → olive; 14 hardcoded colours
  hand-migrated (dark-section light text → olive tints).
- `web/index.html` — Google Fonts: Instrument Serif + JetBrains Mono →
  Fragment Mono (DM Sans kept). Structure/content untouched.
- `api/_lib/verifierPage.ts` — same tokens inlined; DM Sans + Fragment Mono
  loaded (display=swap); ✅-emoji badge → mono eyebrow + olive dot (no emoji as
  UI icons); pill CTA with hover/focus/reduced-motion.
- **Kept intentionally:** WhatsApp chat-mockup colours (they simulate WhatsApp,
  not our brand); semantic verdict colours (go/caution/nogo mirror the product);
  emojis INSIDE chat bubbles (that's authentic message content, not UI).

## Contrast (WCAG, on paper #FDFCFB)

`#0c0c0c` ~19:1 ✓ · `#4c5e03` ~7.3:1 ✓ (text-safe) · `#4f4e4b` ~7:1 ✓ ·
`#748145` ~4.1:1 — **large text/decorative only, never body** (enforced by
usage: --terra only on h2 em, eyebrows, decoratives).

## Follow-ups (not in this commit)

1. `web/painel.html` — internal ops console still on the old system (5 refs).
2. `web/og-template.html` + regenerate `og-image.png` (offline render step).
3. **PNG cards palette** (`api/_lib/cards/render.ts` C palette): cream/forest →
   paper/olive so the WhatsApp cards match the web. Higher blast radius (most-
   forwarded artifacts + card tests assert colors?) — do as its own reviewed
   change, swapping C.* values + regenerating goldens.
4. QR poster colors (`api/qr.ts` dark `#14432f` on `#f4efe4`) → olive/paper.
