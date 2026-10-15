# YÖAJO 09 — calibrated source coverage, research only

**Result: improvement demonstrated; locked research thresholds FAIL; production/merge NO-GO.**

Parent: Draft PR #19 `abaa437ecc5ccfc6e293863a0b3a10b8d212ed46`.
Preregistration and both corpus digests committed BEFORE gate comparison: `c8ee1eb56cb19faaf1cf9e019a57a654b65c9191`.
Candidate code and DEV controls frozen BEFORE EVAL: `7fa1ddf445c9ae0b4155687492f283e244d42961`.
Later commits may add this report/results only; source digests in RESULTS.json protect the freeze.

## Experiment and scope

The old gate is a source-coverage wrapper, not the parser. It suppresses any source ID claimed by a verified field or any payline, detects ASCII digits only, and regards a source-specific upstream warning as coverage without checking an inconsistent ready decision. It alarms on ordinary document/page/version numbers. Fake accountedEvidenceIds do **not** bypass its gate (positive control); raw source IDs in forged verified/payline entries do.

New `auditSourceCoverage` remains a separate research wrapper. It warns on all nonempty unresolved source observations (including text, Unicode numbers, standalone signs/units), not just ASCII numeric tokens. Narrow exact metadata grammars with top/footer geometry leave an explicit source-linked exemption trail. Everything else remains review-only. No learned model, confidence threshold or oracle annotation enters this code.

Verified-field source text must independently reproduce its value; pending or numerically unreproducible payroll rows cannot consume evidence. Completed payroll arithmetic requires an exact numeric multiset, so one matching source value cannot stand for multiple cells or hide an extra financial number. Valid exact existing source warnings are retained and block even if the upstream decision incorrectly says ready. `accountedEvidenceIds` is never authority. Invalid structural data fails closed. Missing geometry gets no metadata exemption. Warning groups preserve every warned source ID and cannot cross pages or transitively chain across rows.

**This is not semantic provenance verification.** A numeric match does not prove gross vs net, quote vs cost, identity, currency, account or correct row role. String/date source equality is intentionally narrow. Additional values, unsupported number formats and longer labels may create conservative warnings. Broad unlinked-text warnings and the synthetic-only metadata grammar can create substantial real-document noise. No financial correctness claim follows from this coverage experiment.

## Locked EVAL results

90 new documents, seed 902903; DEV had 90 documents, seed 902101. Neither uses any previous HOLDOUT data or generator. The two seeds vary values/positions/order/IDs within the SAME 18 templates: this is a source-independent new synthetic corpus, **not unseen-family generalization, author-blind testing, or external independent QA**. This author designed the oracle and implementation. DEV/EVAL aggregates happen to match because every family has exactly five instances; per-case IDs and values differ. EVAL was run after freezing candidate code; no post-EVAL tuning was performed.

| Metric | Frozen v1 | Candidate v2 |
|---|---:|---:|
| Essential source warning coverage | 50/85 = 58.8% | 85/85 = 100% |
| Documents with at least one missed essential source | 30/65 | 0/65 |
| Nuisance source false-positive rate | 200/290 = 69.0% | 5/290 = 1.7% |
| Essential/(essential+nuisance) warning precision | 20.0% | 94.4% |
| Benign-only documents falsely blocked | 20/20 = 100% | 5/20 = 25% |
| New per-source warnings | 240 | 85 |
| Emitted warning groups | 240 (ungrouped) | 65 |
| Context-label warnings (outside precision denominator) | 0 | 5 |
| Upstream blocks relaxed / persistence granted | 0 / 0 | 0 / 0 |

The frozen recall, nuisance-FPR and safety invariants pass on EVAL. **Benign-document false blocking FAILS** (25% > preregistered 10%). All five retained false-block examples are in `COUNTEREXAMPLES.json` (`eval-archive-number-0`…`-4`). Source text `Archive copy <integer>` is unclassified nonfinancial metadata; the conservative gate intentionally warns. It was not added to an allowlist after seeing EVAL. High token precision must not hide this document-level failure.

Grouping independently reduces candidate warning cards 85 → 65 (23.5%) while preserving all 85 source warning IDs. This is an interface burden proxy only: **human reading/correction time was not measured**, and no UI was built. Old-vs-new group count 240 → 65 combines classification and grouping, so it cannot be attributed to grouping alone.

## Test evidence and reproducibility

Local Node v24.19.0: targeted candidate controls 11/11 PASS; full parent + new Node suite **101/101 PASS**. The 11 tests include 12 malformed-input mutations, source-value/payline counterexamples, all DEV annotations, exact/location-limited metadata, original-block preservation, no mutation, duplicate values, missing geometry and page-safe grouping/permutation checks. Test count is distinct from 180 annotated document comparisons and is not claimed independent QA.

Run from repository root:

```sh
npm test
node research/coverage-gate-v2/evaluate.mjs dev qa-output
node research/coverage-gate-v2/evaluate.mjs eval qa-output
```

The generator recreates both corpora; SHA-256 is checked before evaluation. Raw outputs belong in Actions artifacts, not Git history. `RESULTS.json` keeps concise counts, source/result digests and locked criteria; source annotations are reproducible from the committed generator.

The new `YOAJO 09 - preregistered source coverage` workflow uploads both complete comparisons, logs and a checksummed manifest for **14 days**, on PASS or FAIL. Its threshold assertion is deliberately **advisory** (`continue-on-error`): read step outcome and `researchThresholdsPass=false`, not only a green workflow badge. The manifest retains `independentQA=NOT RUN` and `productionDecision=NO-GO`.

Existing browser regressions may run on the new Draft PR in GitHub CI. They do not import this candidate gate or measure its new corpus. No Playwright-specific change is needed for this pure-envelope experiment; a browser rendering/OCR experiment would be a different pre-registered source-extraction test. Local pixels→OCR, new real PDF extraction, physical Android, offline, persistence/reload, UI usability and external independent acceptance remain **NOT RUN**.

## Remaining uncertainty and next justified experiment

Stop here under the fixed protocol: the expected evidence exists and one criterion fails. Do not reopen/tune to old HOLDOUT or turn the failed threshold into a passing unit test. The useful next experiment is an independently annotated NEW corpus with ordinary benign prose, administrative IDs, date ranges, multirow headers, legal footers and deliberately ambiguous financial/metadata neighbors. Compare abstention and narrowly justified classifier rules, with document-level false blocks and source-role validation as separate endpoints. Use new layout families and an external evaluator to address the current generator/author correlation. Only then consider a source-linked review UI and measure actual correction time.

No changes to `src/`, `demo/`, shared acceptance contract, old E, old coverage gate, existing tests, package dependencies, main or production apps. Only new research files/tests and one research CI workflow. No merge or deployment.
