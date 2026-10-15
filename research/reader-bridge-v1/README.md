# YÖAJO 11 — read-only app source bridge (research)

Source: PR #21 frozen SHA `a4a8922dd9e1cb4c67f3075245a352239245b232`. See `PROTOCOL.md` for preregistered targets and stop rules. **NO-GO production / integration / merge.**

## Actual integration gap (real app readers inspected 2026-10-15)
- **Palkka `main/pdf-reader.js`**: calls real PDF.js `getTextContent()` but flattens the items into line strings; the public `extractPdfText(file)` response is only text. Position, token IDs and source relationships are not returned. Do not retroactively assign certainty to flattened output.
- **Osakevahti `main/image-reader.js`**: Tesseract.js v5 `worker.recognize(..., {text:true,tsv:true})` already receives genuine word-level TSV internally. However, `tsvToLines()` aggregates words and returns only line strings, confidence and pixel boxes; the exported `extractImageText()` returns `{text,lines}`, not the TSV words or immutable word IDs. OCR is also loaded from external CDNs by the current source, so offline is not proven.
- **YÖAJO 10 gate**: supports `sourceRoles.valueIds/headerIds/contextIds`, but current app readers and their domain adapters do not emit them. Value string/number equality plus local geometry are not proof of gross-vs-net, quantity-vs-price or correct account ownership.

## Architecture decision
Do NOT immediately rewrite app parsers or add a learned semantic classifier. Instead add a **non-invasive structured-reader seam** alongside the old text API:
1. For native PDFs retain `items`, page and actual viewport dimensions before line-flattening, feeding the existing LAB `layoutFromPdfItems` geometry. Unsupported coordinates and transformations must block, not be silently estimated.
2. For images retain original Tesseract **level-5 words** and image dimensions; assign one source ID per word, preserving duplicate numbers, raw positions, confidence and source row/address. OCR certainty is not financial-field certainty.
3. A *separate domain-specific resolver* must provide explicit, source-linked `valueIds/headerIds/contextIds`; the shared audit may validate them but must not invent semantics or silently auto-save. The bridge's `inspectReadOnlyHandoff()` is deliberately **always review-required** regardless of isolated gate verdict.
4. Palkka's old string-only API and Osakevahti's already-collapsed line-only API remain legacy/read-only, without fabricated provenance. To use the new shape in products requires separate versioned app changes, an explicit user approval workflow and independent production QA.

Alternatives rejected for now: infer coordinates from text-line order (loses source identity); blindly trust PDF/OCR confidence as truth; insert YÖAJO 10 into production without upstream source-role emitters; offload private payroll/holdings docs to external AI solely for convenience.

## Experiment (new synthetic inputs only)
- `bridge.mjs`: `fromPdfJsTextItems(pages)`, `fromTesseractWordTsv(tsv,pageDimensions)`, `inspectReadOnlyHandoff(layout,fields)`.
- `tests/reader-bridge-research.test.mjs`: source preservation, word repetition, malformed TSV, bad page/box, flat-PDF refusal, untyped role refusal and D1-style surplus amount.
- `tests/e2e/reader-bridge.spec.mjs`: actual Chromium/PDF.js **synthetic PDF bytes** to item observations, plus a browser parsing smoke for *synthetic TSV*. This is NOT image-pixels→OCR and NOT an app UI flow.

Conservative exclusions: PNG/JPEG pixel recognition, page image size/EXIF rotation, real Tesseract runtime, perspective and mixed scans, Unicode/line-break robustness, header-role extraction, finance semantics, operational memory/speed, app persistence/reload, offline, Android and independent QA are **NOT RUN** in this scope. Literal TSV word-parser behavior is not validation of OCR recognition quality.

The 3 known YÖAJO 10 compatibility false blocks (legacy headings, global context and distant columns) are intentionally not tuned here. New source preservation is a prerequisite for investigating them, not a fix. YÖAJO 09's 25% benign-document false-block threshold remains **FAIL**; no prior EVAL data was used here.

## Verification
GitHub Actions runs the existing `npm test` and `npm run test:e2e` on a Draft PR. Verify **exact HEAD SHA, job steps and logs** before claiming PASS; Node / browser results must be recorded separately from actual OCR/Android/external QA. No application repositories or shared `src/` code changed.
