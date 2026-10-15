# YÖAJO 13 — scoped-source association protocol (pre-implementation lock)
Date: 2026-10-15; base frozen YÖAJO 12 `619c97c8ad0626d923eb993ad569bc8d20493ce0`.

## Architectural options and decision
- Blindly relax YÖAJO 10's same-row restriction: REJECT. Enables unrelated financial fields/context to be claimed as "handled".
- Hardcoded labels/metadata suppressions: REJECT. The 25% benign-document block failure in YÖAJO 09 is historical evidence, NOT permission to tune on old EVAL.
- **Explicit scoped, source-linked role hypothesis**: CHOSEN as a supplemental read-only structural proof. Require an explicit source `valueIds`, named `headerIds` with a *column scope*, or a `contextIds` with an exact *document currency scope*. Never infer role from confidence alone; never mutate YÖAJO 10 nor suppress its warnings or issue a candidate-ready import. Provide original-ID negative evidence for all rejected cases.

## Fixed acceptance / negative oracles (defined before new implementation)
1. Safe column: supported exact semantic label above target value on SAME page, with x overlap and within a bounded y distance, no intervening competing headers. Structural linkage supported but `canAutoAccept=false`, `canPersist=false`.
2. Safe document context: explicit `Currency: EUR` (not bare EUR) in page header (top <=16%), on SAME page as source value, no second conflicting/duplicated currency declaration. Reference must match declared field context. Scope may be shared across independent fields on same page without using it as a value token. No cross-page/foreign account inheritance.
3. Block: column header in wrong lane, wrong field label, ambiguous nearby headings, duplicate candidate header, missing geometry, different page, distant beyond bounds, source-ID forged/extra/duplicate, amount in header/context, overlapping geometry, cross-field reused value ID; duplicate/contradictory currency marker; page-2 value citing page-1 currency.
4. No silent source loss: original observations and exact IDs remain intact, input immutable under all positive/negative cases. Unlinked ordinary admin prose and metadata must not be automatically declared safe or be used as evidence.
5. Preserve inherited decision: expose `frozenAudit` as the literal unchanged YÖAJO 10 verdict. New structural support NEVER upgrades frozen upstream review to ready, never relaxes a block or persistence. Invalid input fails closed.
6. Distinct synthetic layouts: new manually authored payroll table, holdings table and administrative/document-header layouts with unrelated amounts and distractor labels. Developer-authored and not external independent QA; numbers of scenarios are unit tests, not independent documents/real-world FPR.
7. Browser smoke: Chromium must import the new research wrapper, demonstrate a supported association and a blocked adjacent/cross-page one. Existing Node/Chromium regressions must remain passing.

## Limits / stop
No old HOLDOUT PDFs, annotator data or YÖAJO 09 EVAL used for tuning. YÖAJO 12 app code, actual Palkka/Osakevahti apps, shared `src/`, frozen E/Y09/Y10/Y11, and product acceptance must remain unchanged. This is a structural **hypothesis**, not a semantic verification or complete parser/UI integration. OCR holdings semantics, current price/value extraction, real Android, manual Work UI interaction, independent blind-family evaluation, false-block rates, UI correction time, offline remain **NOT RUN** in this bounded patch. The old 25% >10% benign-document gate remains **FAIL**. Full GO/merge/deploy expressly forbidden. Record exact SHA, PASS/FAIL/NOT RUN; stop after the bounded study and CI.
