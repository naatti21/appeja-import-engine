# Issue #38 — bounded structure-learning experiment

**Status: PARTIAL / NOT READY for LAB or application integration.** This work intentionally retains failing real-pixel recall assertions. A green unit suite is not an acceptance decision. No Palkka or Osakevahti release, financial storage, external data service or deployment is included. Related to #38; do not automatically close the issue.

## Independent assessment and locked sources

- Engine base: `feature/compact-mobile-review-20261017`, `ce3ae5731e7c8f09b2641b58fc2e4550e9c8477f`. `main` remains README-only. This branch was selected because it contains the current compact review and positional parser; the proposed PR targets this base, not a release branch.
- Palkka: read-only checkout of `naatti21/Palkan-laskenta@607a74a7334ce7130cb1261c009c08056c9e3b6d`. Read `learning.js`, its tests, `app.js` profile application/storage, and `model.js` backup sanitization. None changed.
- Engine: `import-observations.mjs`, `positioned-holdings.mjs`, `review-draft.mjs`, `numbers.mjs`, `demo/mobile-source-review.mjs`, OCR staging, real OCR tests, acceptance contract and QA status. Existing frozen evaluation files and acceptance criteria remain unchanged.

Palkka has a useful separation between local corrections, bounded selectors and application. It abstains when selectors produce contradictory values and sanitizes backups. However, selectors derive from hashes of textual labels and nearby headings; hashes of low-entropy personal/source text are not anonymization. Equal amounts can select several semantically different occurrences. Repeated confirmation can increase counts without proving distinct documents; application logic also counts successful automatic parses as profile trust. Fixed confidence numbers do not establish measured recognition probability. Its payroll-specific field list, label hashes and automatic reinforcement should not be copied to a holdings engine.

Engine already preserves unique source IDs, normalized source geometry and original OCR text. Its positional holdings parser requires an eight-column header. Vertical cards often have no such header, so correct OCR alone cannot produce holdings. The compact review fallback avoids a giant correction form but does not learn field positions. Reusing canonical observations and `parseNumber` is appropriate; weakening the table parser or treating raw OCR lines as holdings is not.

A genuine-pixel experiment additionally demonstrated a separate OCR problem: the Finnish/English Tesseract model changed synthetic Q-prefixed tickers to O-prefixed strings with high reported confidence. Some English `Quantity` labels became `Ouantity`. Layout learning cannot establish a correct security identity from those strings.

## Implemented boundary

`src/structure-learning.mjs` is a generic, versioned structural-memory core. A profile stores only a bounded sequence of closed role tokens, three role-to-slot positions and `provisional/active/conflict` state. Limits: 16 profiles, 16 slots per profile, 16 undo entries. No company/broker dictionaries, raw labels, source IDs, boxes, values, images or text hashes enter persisted profiles.

Only explicit confirmation can teach. Two distinct document contents in one session activate a profile. Re-reading the same dataset (even with new source IDs or geometry) does not strengthen it. Document fingerprints exist only in volatile memory; they are not anonymized data and must never enter logs or exports. Reloaded provisional profiles need two new in-session confirmations. Imported backup profiles lose active trust. Conflicting mappings quarantine the profile until an explicit undo or reset. Inference never teaches itself.

`src/mobile-card-holdings.mjs` implements a deliberately narrow, single-column vertical-card adapter. It groups canonical words into visual lines and separates cards by vertical gaps; binding is by ordinal role positions, not stored pixel coordinates. Every proposed name, source identifier and quantity retains source IDs. It requires a labelled positive quantity, and either a checksum-valid source ISIN or a labelled ticker plus MIC-shaped listing code. These are **source identifiers, not independently verified market instruments**. Currency/account are never guessed, page boundaries clear account context, duplicate identities on one account are withheld, and different explicit accounts/listings remain separate. Current price never becomes purchase price. Purchase price remains missing even when a cost-looking line exists: cost extraction is outside this experiment.

The OCR confidence cutoff of 85 is an exclusion heuristic, not a calibrated probability. Unknown material, malformed geometry, low OCR confidence, duplicate quantities, conflicting mappings and unsupported cards remain unresolved. Finnish, English and Swedish label forms are supported in this bounded adapter; unrestricted multilingual recognition is not claimed.

`corroborateOcrIdentities` compares a multilingual reading with an English reading locally. Disagreement withholds a card; it never substitutes Q/O or repairs a ticker. Agreement is not independent QA, independent OCR, or market verification. The experiment offers an explicit English-only OCR mode as well; that mode does not have cross-language corroboration and still requires review.

`demo/structure-learning.html` is a separate, unpublished experiment. The existing LAB page and deployment packaging are unchanged. Default review shows at most three proposed cards and an unresolved count; three teaching selectors appear only on demand. Batch review marks visible source proposals reviewed in memory; it neither learns nor permits financial persistence. Missing cost/market verification is shown on every proposal. The image is revocable, cancel invalidates in-flight results, and files are not uploaded.

Learning storage is opt-in under `import-engine:structure-learning:v1`, separate from application portfolios. Export/restore accepts only the canonical schema, size bounded to 16 KiB at the UI boundary. Failed writes roll back the in-memory profile mutation; forgetting removes the stored profile. No cross-application profile sharing is implemented. `canPersist:false` applies to all financial results, including after teaching and batch review.

## Tests and measurement definitions

New tests use fictional sources, not copies of user holdings or bank screenshots. Two mobile layouts reorder identity and quantity and include account headers, menus, current price/value, day return and cash balance. Three imports per layout change values; independent cases also replace all company names/listing codes, test Swedish labels, non-Latin names, separate accounts/listings, duplicate rows, invalid ISIN checksums, uncertain quantities, overlapping columns, absent boundaries, blocking source issues, replay, conflicts, undo and privacy.

The genuine pipeline renders synthetic PNG pixels, uploads them through the experiment, runs the staged browser Tesseract worker, parses its actual TSV/geometry, resolves cards, and teaches through the UI. It does not replace recognition with mock TSV. Separate UI-only tests use synthetic TSV and are labelled accordingly. Measurements compare name, identifier and quantity together **within each resulting card**, not anywhere in the document.

- Structural-only held-out cases: 6/6 exact rows after two teaching imports; 0 wrong proposals, 0 unresolved. They do not measure OCR accuracy.
- Genuine OCR: four three-import sequences (English/Finnish × ticker/ISIN), 36 source rows total. Final held-out denominators are 12 source rows. The strict recall requirement remains 3/3 for each sequence; failing sequences are not skipped or marked expected failures.
- Correction effort is automated interaction evidence, not human testing: successful teaching uses three source-field selections plus a confirmation per teaching import. Repeated third-import selections can drop from 3 to 0, but unresolved OCR/identity rows still need separate source review. A missing repair path is not counted as zero user effort.
- Elapsed browser test timings include OCR and automated UI interaction on a cloud machine. Human time saved and physical Android performance: **NOT MEASURED**.

See `qa/reports/issue38-structure-learning.md` for executed results, failures and exact scope. Test artifacts contain synthetic material only. The isolated `structure-learning-qa.yml` runs Node 22 and genuine OCR on a PR/dispatch, has read-only repository permissions and no deploy job. Its strict failing recall tests are intentional evidence of unfinished work, not release approval.

## Remaining problems / acceptance gate

1. True mobile recognition coverage is inadequate. Q/O errors and low-confidence source words cause real-pixel failures. The safeguards trade recall for fewer false proposals; do not lower confidence thresholds or replace letters to hide these failures.
2. The correction UI teaches existing source roles; it does **not** yet repair a badly read ticker/quantity or complete absent purchase prices. These inputs cannot become complete imports here.
3. A semantic name/header swap with identical abstract role order is not distinguishable from the stored structure. Learning is a proposal aid, not semantic verification. Names containing digits, unlabelled quantities, unknown languages, multi-column cards, wrapped/overlapping cards and unsupported broker views can be withheld. This is not a universal broker parser.
4. A checksum-valid ISIN need not exist, and a ticker/MIC-shaped pair need not identify a real listing. No Yahoo/external lookup or company-name matching was added. Independent instrument verification and account/broker integration remain outside scope.
5. Distinct document contents do not prove independent human evidence; a user can change values or confirm the wrong slot. Volatile fingerprints protect simple replay only. No probabilistic confidence is invented.
6. Backup restore deliberately re-teaches trust. Concurrent tabs do not reconcile profile writes; use one teaching tab. The experiment has no production integration, original bank image evaluation or physical-device acceptance.

**Recommendation: keep Draft / continue repair, do not close #38 and do not publish to LAB.** Next technical action: independent review of the failed real-OCR identity cases and the smallest explicit, source-bound correction path. Do not ask the user to perform another phone test at this stage.
