# YÖAJO 09 — preregistered source coverage experiment

2026-10-15. Frozen parent `abaa437ecc5ccfc6e293863a0b3a10b8d212ed46` (Draft #19).
This file, generator and corpus digests must be committed BEFORE invoking either gate on the new corpus. No old HOLDOUT bytes, annotations, generators or per-case results may be accessed. Only the six public DEV outputs already in #19 may be replayed as historical regressions, never as the new evaluation denominator.

## Data and independence

Fresh deterministic synthetic source-envelope documents, not rendered PDF/image files. Two disjoint seeds: DEV=902101, EVAL=902903. Eighteen families × five variants = 90 documents per split. Row geometry, ordering, amounts, locales and source IDs vary. Pure fictional values; no actual people/accounts. Generator annotations never enter the gate arguments. Oracle is source intent decided before gate execution, not derived from its outputs.

EVAL must not be executed until the candidate implementation and DEV checks are frozen in a second commit. No fixes after observing EVAL without a new protocol and new EVAL corpus. Same author creates this corpus and implementation: source-independent of previous research, **not external independent QA or author-blind validation**. Variants share family templates; 180 documents are not 180 independent real-world layouts.

## Fixed annotation rules and metrics

Each source observation is annotated as `linked` (correctly verified/completed), `essential` (unresolved financial amount, quantity, unit/sign fragment or financially meaningful unresolved text), `nuisance` (nonfinancial metadata) or `context` (row label). Corrupt links convert their original financial source observation to essential. Context labels are outside both recall and false-positive denominators, but their alerts are reported as review burden.

Warning coverage: number of essential source IDs having either a source-specific preexisting blocking warning or a new source-specific warning / all essential source IDs. A document-wide block alone earns **zero** source coverage. A verified link in a deliberately forged/pending case earns zero coverage. Never count same raw value from different IDs as the same observation.

Nuisance false-positive rate: nuisance source IDs receiving a warning / all nuisance IDs. Warning precision: essential IDs / (essential+nuisance warned IDs); report context warnings separately. Also report essential-miss document rate, benign-only false-block rate, number of emitted warning groups, warnings per document, group sizes, and original-block non-relaxation. Existing targeted warnings counted only when they refer to an existing exact source ID and do not claim to be informational.

## Locked pass/fail conditions (research proposal only)

1. EVAL essential warning recall = 100%; 0 essential-miss documents.
2. EVAL nuisance FPR <=10%, and at least 50% relative reduction vs frozen v1 (when v1 FPR>0).
3. Benign-only documents false-block rate <=10%.
4. No persistence; no promotion of originally blocked documents; no mutation of input.
5. Structural safety cases (missing/duplicate IDs, malformed boxes, invalid link/problemlists) must return a blocking result, not throw or silently drop evidence.
6. Grouping is lossless for warned source IDs and cannot cross pages; input permutation and duplicate raw values must preserve coverage. Group count is a burden proxy, not measured human correction time.

All criteria stand even if the candidate fails. Record baseline and candidate raw outputs, per-family and aggregate counts, denominators, seed, failures and corpus hashes. Full corpus execution success is not threshold PASS. Production, integration and merge remain NO-GO regardless of this result.

## Budget, stop and next experiments

One baseline DEV run, one candidate DEV cycle (bug fixes allowed before freeze), one frozen EVAL comparison, existing Node suite. At most 180 annotated cases plus targeted safety/metamorphic controls. Browser only if browser integration changes (none planned). Existing browser CI is regression evidence, not evaluation of this unintegrated gate. Preserve a counterexample for each gap. Stop after EVAL and required CI; do not tune to EVAL. A failed precision criterion calls for a newly preregistered corpus/independent annotation, not an exemption added to get green.
