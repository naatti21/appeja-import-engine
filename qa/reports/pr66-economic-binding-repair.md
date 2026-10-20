# P1-66-01: explicit economic-role binding (developer QA, pending independent review)

Base: PR #66, `b33b0440a927a7313cb058f7529ba1c8aa5b38e6`.
Work request: https://github.com/naatti21/appeja-import-engine/pull/66#issuecomment-6282406156

## Reproduction and cause

The exact two Work drawings (1100×1000, right-offset NAV/GAV plus date, price and units, no total value) were rendered to PNG and read by the real local Tesseract fin+eng and eng paths, through the file picker and mobile review UI, before changing source. Both falsely promoted the price to `value`. Of four initial real-OCR cases, NAV, GAV and wider-font NAV failed; the left-offset control passed. Original PNGs, OCR observations, UI screenshots and logs are retained outside Git in `/tmp/pr66-fix/red/` and `red.log`.

OCR read the label and price correctly. The compact adapter's asymmetric x0 test silently discarded right-offset headings. Unique numeric-source ownership then proved only that a token was used once, not that it represented a holdings total. This is a field-role binding error, not an OCR substitution error.

## Repair contract

`fund-role-binding.mjs` separates economic evidence from layout discovery. Label/number candidates carry page, card, normalized label text, source IDs and bounding boxes. Symmetric interval intersection and vertical field boundaries determine candidate edges. Multiple columns, conflicting roles, unknown labels and cross-card claims withhold a proposal. A dangling price-role label also blocks **unlabelled fallback**, even without a safe geometric edge. It does not erase a separately proven labelled NAV in another column (the unchanged P1-64 control).

Labelled observations need a matching role edge within their card. Compact totals retain the existing narrow discovery requirements: holdings section, unique monetary line directly above units in their column, two agreeing local OCR reads. They additionally need no conflicting economic evidence. No geometric tolerance was increased. Binding only demotes existing proposals; it does not promote shifted NAV/GAV into observed fields.

Unknown OCR fragments strictly enclosed within a recognized label's pixels remain `nestedEvidence`, rather than an independent label edge. Recognized competing economic roles are never excluded this way. This handles Tesseract's extra two-pixel fragment inside the five-card `Keskikurssi` labels without losing the actual source observation. A dedicated countertest keeps an enclosed NAV conflicting.

Names containing Value or Price are not treated as field labels merely because of that word. The entire label must consist of recognized financial phrases and allowed numeric/date context. Names remain unverified observations; this change cannot prove instrument identity.

## Tests and limits

New tests cover exact Work PNGs, independent left-offset/wide-font variants, one and five genuine compact totals, new Value/Price names, cross-card orphan-label attack/control, dangling labels, nested OCR fragments, section headings and competing monetary columns. Each browser case performs PNG → local OCR twice → parser → actual mobile review. Evidence, image hashes and correct/wrong/withheld counts are emitted as artifacts. Existing P1-64/P1-65 fixtures and #55 frozen RED oracles are unchanged.

During development the graph initially withheld five valid GAV fields because of nested OCR fragments. The existing five-card test failed (15/20 numeric fields); the source repair restored 20/20 without changing that test or fixture. New compact controls recognize 1/1 and 5/5 total values; the cross-card attack withholds its second value, while the control preserves both. These are bounded synthetic measurements, not real-bank compatibility or production accuracy claims.

The inherited-red CI job separately prepares the existing pinned PDF.js dependency before running the ordinary browser suite. Missing PDF.js is a test setup defect, not an expected product failure. The job still propagates actual inherited failures; no tests are skipped to make CI green.

Final exact-SHA full-suite results, inherited failure-name comparison, CI links and artifact hashes belong in the delivery handoff. Passing this focused suite is not approval: inherited red tests must stay visible, and independent Work review is NOT RUN by this implementation.

## Privacy and gate

Only fictional drawings. OCR assets and processing remain local; browser tests reject external requests. No financial persistence, lookup, issuer rules, production configuration or app changes. `canPersist:false`, empty candidates/actions and unverified identity remain enforced. Neither current LAB nor other applications are modified or published.

GO only for independent review of this bounded correction; NO-GO for integration/release until review and existing safety findings are resolved. Unsupported layouts or OCR disagreement remain uncertain. Remaining risks include document/card segmentation, missing or unreadable labels and the limited representativeness of synthetic fixtures.
