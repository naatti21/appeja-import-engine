# YÖAJO 13 — bounded column/document source association

Parent frozen YÖAJO 12 `619c97c8ad0626d923eb993ad569bc8d20493ce0`. Research-only. Protocol committed first at `abd642fe319b92a39cdfb1ff0e56ee11c3afeef1`.

## Delivered in this scoped first correction
A *supplemental* structural verifier `inspectScopedClaims(layout,fields)` records when a typed column heading above a value, or an explicit page-header `Currency: EUR`, has a bounded source-ID and geometric association. It is a read-only evidence proposal, **not** a replacement for the frozen YÖAJO 10 evidence gate or parser. It returns the literal `frozenAudit` for comparison, `supported` structural claim records, and source-specific `issues` when unsafe. `status` always review-required, `canAutoAccept=false`, `canPersist=false`. It never edits observations, financial fields, acceptance or storage.

A column claim uses explicit `sourceRoles.valueIds/headerIds` and `scopedRoles.header='column'`; only one unfragmented value token and one exact, role-specific heading are supported. Same PDF page, bounded above/below distance, horizontal lane and no intervening known competing heading are required. A document-currency claim uses one `contextIds` entry with an exact `Currency: EUR` style prefix near the TOP OF THE SAME PAGE, exact expected `context.currency`, and no duplicated/contradictory page-level currency declarations. Shared page context cannot become a value ID. Any unknown role, malformed bounding box, extra/forged reference, overlapping role or reused value ID blocks.

The field-to-source relationship is **not** proof of gross/net correctness, row identity, semantic ownership, foreign currency conversion, period meaning or instrument price/cost. An unknown heading could still be an unrecognized conflict; known-heading distance thresholds are deliberately conservative. There is no inferred cross-page/global currency inheritance. A page declaration is not a verified account-scoped value. OCR confidence alone never grants semantics. The original frozen gate may still block these sources, by design.

## Files / tests
- `research/scoped-context-v1/PROTOCOL.md`: preregistered hypotheses, negative controls, stop/GO distinctions
- `research/scoped-context-v1/inspect.mjs`: pure read-only structural hypothesis, original-ID evidence, unchanged Y10 audit side-by-side
- `tests/scoped-context-research.test.mjs`: new fictional payroll/holdings/admin table layouts; both valid and unsafe claims
- `tests/e2e/scoped-context.spec.mjs`: genuine synthetic PDF bytes -> real Chromium PDF.js item geometry -> column header structural hypothesis. No changed UI.
- This `README.md`: model, limits, replay guidance.

Reproduce from repo root: `npm test`, then `npm run prepare:pdfjs && npm run test:e2e`. GitHub Actions runs existing Node and Chromium suites on Draft PR; **verify actual job logs and head SHA before PASS**.

## Still open / do not call PASS
- Historical YÖAJO 09 benign document 5/20 = 25% false blocks vs <=10% criterion: **FAIL**. No retrospective tuning, scoring or precision improvement in this branch.
- The YÖAJO 10 / 12 global-currency and distant-heading cases gain only *structural hypothesis evidence*, not automatic resolved imports or reduction in user correction effort.
- Holdings currentPrice/marketValue and image-OCR salary/holdings field semantics: NOT IMPLEMENTED.
- New external independent blind families, natural admin prose and human false-block/false-accept rates: NOT RUN.
- Work manual browser UI remains BLOCKED from previous session; this branch runs CI Chromium separately. Real Android, offline, persistence and app-level integration NOT RUN.
- Main, Palkka, Osakevahti, frozen E, Y09/Y10/Y11/Y12 and shared `src/` unchanged. No merge, deploy, acceptance promotion or auto-save.

## Next decision
Only after audit of this isolated scope result, produce a *separate*, pre-registered independent family experiment with real reader output and explicit false-block cost. A later product adapter may generate scoped claims if its domain semantics and account/period boundaries are proven independently. The smallest additional safe step is a read-only preview of supported *structural hypotheses* next to original evidence; this isn't granted by the current CI.
