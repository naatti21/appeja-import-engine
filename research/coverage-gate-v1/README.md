# YÖAJO 08 — numeric coverage safety probe (DEV only)

This is a **research-only**, source-linked experiment off frozen E commit `4bbcb110acecbe4cd162115dc699f9b951fe7093`. No changes to E, the shared acceptance contract, domain adapters, Palkka, Osakevahti or production main. No HOLDOUT PDFs or annotations were opened or used to design this probe.

## Question

Can a document be `candidate-ready` when source-visible numbers are neither linked to verified/payline source IDs nor covered by a targeted source warning?

YÖAJO 07's published HOLDOUT aggregate reports 41/75 essential observations without a verified/payline link or targeted warning. This probe **does not** re-use HOLDOUT data; it uses frozen six-document public DEV reader outputs from YÖAJO 06 plus synthetic, in-memory counterexamples.

## Mechanism

`gate.mjs` audits **all** original digit-bearing text observations. It ignores the upstream `material` flag, checks the exact source ID against parser-resolved verified fields and completed paylines, and avoids duplicating existing `UNACCOUNTED_MATERIAL` issues. Previously unwarned numeric tokens get `UNREVIEWED_NUMERIC_OBSERVATION`, with page and source box. Broken IDs or fabricated links fail closed. Never grants persistence, never changes the parser or its evidence.

The gate is intentionally over-conservative: page numbers, document identifiers and other harmless numeric metadata can trigger review. The browser experience, user review effort, OCR fragmentation, hidden essential text **without digits**, and classifier completeness are NOT solved. Do not interpret every new alert as a genuine essential-field detection. This is a counterexample and source-coverage hypothesis, not a production algorithm.

## DEV observations, unlinked numeric tokens not already covered by targeted warnings

| Source | New source-linked alerts | Previous decision |
| --- | ---: | --- |
| P01 | 8 | review-required |
| P02 | 8 | candidate-ready |
| P03 | 7 | review-required |
| T01 | 3 | review-required |
| T02 | 7 | review-required |
| T03 | 5 | review-required |
| **Total** | **38** | No persistence permitted |

Counts are mechanical on original frozen E DEV observations; not 38 verified errors. `P02` is the useful alert-path reproduction: its original decision is `candidate-ready`; the extra review-only gate blocks until the eight token IDs are classified or linked. The gate explicitly leaves already-blocked cases blocked.

## Test execution and release boundary

Run `node --test tests/coverage-gate-research.test.mjs` on Node >=22, or `npm test` in the existing repo. Browser / Android / real independent QA **NOT RUN** unless explicitly evidenced. The existing E frozen artifacts stay unchanged. Draft PR/CI do not confer deployment permission.

Next iteration should use a **new independent annotated corpus**, pre-registered scope and criteria, and measure the true essential warning recall **together with false positive rate, page/row grouping and correction effort**. Improve source classification without silently exempting financial data. Do not tune to or reopen YÖAJO 07 HOLDOUT as a new blind test.
