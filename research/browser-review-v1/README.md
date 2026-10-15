# YÖAJO 12 — isolated read-only import review

Base: Draft PR #22 `63bc172e5fbc732b52fa667b0d62650a45ed39bc`. Work branch `research/yoajo12-browser-review`, Draft PR #23. Final exact-SHA QA handoff, CI/ZIP links and expiry are in the [PR conversation](https://github.com/naatti21/appeja-import-engine/pull/23). This is an isolated research UI, not production integration or permission to merge.

## Run

Node >=22:

```sh
npm ci
npm test
npm run prepare:pdfjs
node research/browser-review-v1/stage-pdf.mjs
# Optional actual image OCR; no service/CDN fallback:
npm install --no-save --no-package-lock --ignore-scripts --no-audit --no-fund tesseract.js@5.1.0 @tesseract.js-data/eng@1.0.0
node research/browser-review-v1/stage-ocr.mjs
python3 -m http.server 4175 --bind 127.0.0.1
# Open http://127.0.0.1:4175/research/browser-review-v1/ in an accessible test browser.
```

```sh
npx playwright install --with-deps chromium
Y12_REAL_OCR=1 npm run test:e2e -- --grep Y12
```

The dedicated workflow checks out exact PR HEAD and uploads logs, screenshots and per-file SHA-256 manifest for **14 days**, even on failure. OCR asset manifest records exact staged bytes. Top-level test-only package versions are pinned; transitive OCR packages are not lockfile-pinned, so future supply-chain/build reproducibility remains a limitation. Existing generic browser CI tests a merge ref; the final handoff distinguishes that ref from exact-head Y12 CI.

## Source architecture

| Layer | Safe responsibility | Authority limit |
|---|---|---|
| Immutable original observations | PDF.js original items/page/box; CSV actual sourceLine plus logical cell; OCR original words/boxes/confidence | No correction changes original content or IDs |
| Parser proposals | Unchanged payroll section/table adapters and holdings CSV adapter | Proposals can disagree; conflicts retain all candidates/sources, no winner chosen |
| Draft edits / explicit roles | User declares proposed value and value/header/context IDs separately; revert deletes only draft | Typed roles checked by unchanged Y10 gate through unchanged Y11 read-only bridge |
| Review UI | Show warnings, source/raw location, original page/image highlight and corrected draft | Never accepts, saves, exports or uploads a document |

Original `src/`, `demo/`, acceptance criteria, Y09/Y10 gates, Y11 bridge and production repositories remain unchanged. CSV currently lacks current-price/current-value semantics; unknown cells remain visible. OCR uses English words only, does not classify salary/holding fields. Standalone JPEG is accepted but codec/degradation performance has not been measured. Unsupported rotated/cropped PDFs are visibly blocked rather than assigned false coordinates. Scan-only PDF automatic raster OCR is not implemented.

## Actual evidence levels

Work cloud browser initialization and real URL opens were attempted: loopback refused; terminal.local blocked; file URL explicitly forbidden by browser policy. No workaround or browser security change. **Work manual application interaction BLOCKED.** No Work screenshot of a successful import exists. CI screenshots document a separate actual headless Chromium run, not Work interaction. A 360/412 CSS-pixel desktop Chromium viewport is mobile-size emulation, **not physical Android or a mobile browser engine**.

The tests exercise actual file inputs, actual PDF bytes/PDF.js, real image pixels to local Tesseract WASM, visible text/errors, draft edit/revert, source page/image highlighting, stale-result clearing, malformed/oversized inputs, plain-text handling of imported HTML, source pagination, touch-target size and horizontal overflow. Same author wrote the UI and tests; **external independent human QA NOT RUN**. Actual reading/correction time, accessibility with assistive technology, offline reload, full browser network/storage instrumentation (all worker origins/IndexedDB), large-document performance and physical touch/keyboard behavior are NOT RUN. Observed page requests contain no uploads or nonlocal requests; storage assertions cover localStorage/sessionStorage, while OCR cacheMethod=none and no storage code is enabled.

## Reproducible findings

Fixtures are deterministic literals, not pseudo-random draws: case IDs below are their reproduction keys (seed: `literal`, no RNG). Tests construct expected output before import. Fresh UI fixtures do not import Y09 EVAL/HOLDOUT generator or annotations. Y10 minimal compatibility structures are reproduced because the user explicitly requested them; they are not a new blind generalization set.

| ID | Reproduce / expected | Observed / disposition |
|---|---|---|
| Y12-01 | Base demo should offer end-to-end file/source/correction review | Base only has presets/CSV textarea, no file upload/revert/source preview. New separate research screen supplies these flows. Base demo unchanged. |
| Y12-02 | `syntheticPayrollPdf([{fullSlip:true}])`: gross 3200, YTD 42000; source button must display original value/page/box | First exact-head browser run `943e2637b69f37157d349b74b143141bf573a782`: FAIL, gross missing and source button silent. Existing table parser is now included alongside section proposals; conflicting values retained. No acceptance grammar relaxed. |
| Y12-03 | CSV row 2 missing Buy Price must not display matching-source state | Initial research UI could display a match for a missing field. Non-verified/unsourced proposals now always need review; source button disabled when no source exists. Browser regression asserts missing-cost warning. |
| Y12-04 | PDF rotate=90 or nonzero crop origin must not claim valid normalized source coordinates | Review found direct bridge use bypassed parent reader's metadata guard. New UI rejects these PDFs with visible error and clears stale results. Regression covers rotated, cropped and corrupt PDFs. |
| Y12-05 | Genuine Tesseract v5 output must preserve strict word TSV structure | Real engine returns headerless 12-column TSV. Strict normalizer adds canonical header only after validating levels/column count; malformed text rejected. Actual pixels→word boxes passed first CI run. |
| Y12-06 | CSV blank source line must retain actual line 3, not logical row 2 | Source display explicitly shows both line 3 and R2C2; independent Node/browser checks. |
| Y12-08 | PDF source preview must render in the locked Chromium | Second CI head `c4bd7f130777912d306f3a1d62ffab4da2919e22`: FAIL, standard PDF.js rendering used unsupported `Map.getOrInsertComputed`; malformed-PDF flow also remained reading. UI now uses the official legacy build of the SAME locked PDF.js 6.4.299 (included compatibility polyfills), prepared only for this research screen. Original demo/vendor preparation and version unchanged. |
| Y12-09 | Unsupported PDF error and clear must finish; next CSV must work | Third head `a54f510f3be387e425cf75f2ef557fe5a13261d7`: PDF preview fixed, but rejection still FAIL. Root cause: PDF.js 6.4 document proxy has no `destroy()`; cleanup threw before showing the error. Research UI now retains/destroys the loading task (the versioned API), clears the proxy separately, and checks stale load revision. Added successful PDF→clear→CSV regression; rejection oracle unchanged. |
| Y12-07 | Correction 8→800 with the same source must stay blocked and revert to 8 | Original remains frozen; exact gate warns; revert discards draft only. Invalid numeric draft leaves prior proposal/source intact and shows actionable error. |

First red Y12 run: https://github.com/naatti21/appeja-import-engine/actions/runs/38794004655 — 8 PASS / 1 FAIL, actual OCR PASS. Red artifact: https://github.com/naatti21/appeja-import-engine/actions/runs/38794004655/artifacts/12001736385 (expires 2026-10-29T19:27:58Z). Manifest exact head and every included file hash verified after download. This failure is retained and is not a passing result for the corrected head. Final re-test counts and ZIP are added to PR #23 after execution.

## Known false blocks and remaining release blockers

1. Flat healthy local heading+date: default warning remains. An explicit user role draft `valueIds=['date'], headerIds=['head']` can satisfy the frozen source check; restore returns the warning. This is a manual review path, not automatic role inference or proof of real financial semantics.
2. Global currency above a value: remains blocked. UI explains unsupported document-scope binding; not silently exempted.
3. Distant column header: remains blocked. UI explains unsupported column binding; not silently exempted.
4. Y09's previously published benign-document false blocks remain **5/20=25%, above its fixed 10% cap**. We read the published summary, not optimize on the underlying EVAL. Fresh `Archive copy 7042` display probe retains the warning. Grouping/expansion reduces initial visual clutter only; no claim that classification precision, warning recall, human speed or benign-document acceptance improved.

Next priorities: independently validated column/document context roles, semantics for OCR words and investment price/value/cost, new independently annotated document families for nuisance measurement, accessible Work/manual browser path and actual Android/human correction-time evidence. Production and integration remain **NO-GO**. No merges, deployment or automatic storage.

`QA_ARCHIVE.md` and `qa/HANDOFF_TEMPLATE.md` are absent from the pinned base; no substitute was invented. The available Playbook v1.9.2 project file and #22 handoff govern reporting.
