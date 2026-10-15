# YÖAJO 11 — preregistered read-only reader/role bridge experiment

Date: 2026-10-15. Frozen parent: YÖAJO 10 Draft PR #21 `a4a8922dd9e1cb4c67f3075245a352239245b232`.

## Question, architecture and risk
Can **actual reader output shapes** be converted into lossless source observations before financial labels or numbers are interpreted? The real Palkka `main/pdf-reader.js` emits joined text and discards PDF.js text-item positions. Osakevahti `main/image-reader.js` exposes line aggregates built from Tesseract TSV word rows; it does not return per-word evidence IDs. Neither current app supplies the typed `sourceRoles` consumed by YÖAJO 10.

Candidate bridge: PDF.js text items -> existing `src/layout.mjs`; Tesseract TSV level-5 words -> individually identified, page-normalized observations. Source-only readers do not assign verified payroll/holdings fields, guess table identities, nor authorize import. A separate **explicit claim** is audited using frozen YÖAJO 10; read-only preview remains review-required even when the isolated gate returns candidate-ready.

No modifications to Palkka, Osakevahti, `src/`, old E, old research candidates, production, app deployment or main. No old HOLDOUT or YÖAJO 09 EVAL data, cases or generators consulted for the new tests. The new synthetic fixtures are developer-authored; they are not independent QA.

## Fixed target cases (before implementation)
1. Native PDF.js text items (two pages) preserve source strings, source indices, page IDs and geometry. Flattened text **cannot** be upgraded to spatial verified evidence.
2. Genuine Tesseract **TSV schema** (synthetic word-level TSV, **not actual OCR execution**) preserves every nonempty level-5 word, source IDs, confidence and normalized bounding boxes. Two identical values remain two separate observations. Mixed source lines remain separate words; no concatenation/semantic guesses.
3. Missing dimensions, malformed required header, invalid page/word geometry, duplicate word identity and invalid source refs fail closed without silently losing observations. Invalid payload must not appear candidate-ready.
4. Untyped, unresolved payroll/holdings input goes only to review; an explicitly declared role set with a surplus source ID is rejected with targeted original-ID warnings. Reuse YÖAJO 10's frozen gate without modifications.
5. A small real Chromium/PDF.js byte-stream test uses the existing synthetic PDF generator and bridge on read-only text observations; it must prove actual browser-reader geometry, NOT whole-app integration or an OCR run.
6. Different document-family probes (payroll text, holdings rows, ordinary admin metadata) report legitimate loss of coverage/false blocks; no tuning to the fixture to force acceptance.

## Stop / decisions
PASS for this scoped handoff requires no source text/ID/geometry loss, no surreptitious readiness, no source role inference, and relevant Node + browser test proof at exact SHA. A passing byte-stream/TSV handoff is not an end-to-end app implementation, semantic domain validation, UI test, real image->OCR, offline test, Android or production QA. If any P1 evidence loss appears, stop and retain the failing counterexample. No merges or production integration. Report PASS/FAIL/NOT RUN separately.

Expected changes: new `research/reader-bridge-v1/*`, relevant new unit tests, one browser smoke test; leave existing layers identical.
