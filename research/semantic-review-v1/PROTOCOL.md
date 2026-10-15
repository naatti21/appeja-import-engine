# Semantic document review — frozen evaluation protocol

Base: 99ee1dcfa8540620e6853a18adf42b6236d6774d (PR24).
Read PR25 published aggregate report only; no prior EVAL/HOLDOUT case files.

Three independent dimensions: original observation identity; semantic relevance
(administrative / financial / uncertain); evidence role (value / header / context).
Administrative classification never supplies a value, validates a claim, or grants
acceptance. Only an exact whole-observation administrative grammar can lower a
source warning. Reader errors, overlapping sources, duplicate IDs and conflicting
administrative declarations override that grammar. Unplaced observations remain.
The existing source-evidence audit and PR24 scoped inspector remain unchanged.

New UI is read-only, memory-only, separate from applications and frozen demos.
No autoaccept, persistence, network upload, or conversion of unknown data to zero.
PDF text layer is the primary supported path; image-only PDFs require OCR elsewhere.

## Final experiment (lock before execution)
`evaluation/cases.json` contains newly authored source-envelope annotations.
Oracle labels are authored from document intent, not classifier output.
Every case is a separate synthetic document; no PR25 cases or old holdouts used.
Unit: original source ID. Essential warning recall = warned essential IDs / all
essential IDs. Nuisance FPR = warned benign IDs / all benign IDs. False document
block = benign-only documents with correctionRequired / benign-only documents.
False acceptance = essential document not flagged for correction OR any result
with canAutoAccept/canPersist true. Thresholds: 100%, <=10%, <=10%, and zero.
Missing IDs or mutated originals fail integrity. Report counts and denominators.
Compare unchanged v2 source warnings on the SAME fresh final corpus for context;
do not claim comparability to PR25's different families.

Seal cases + protocol with SHA256 before implementation. Keep evaluation outside
Node test discovery. Develop on other examples only. Freeze candidate commit before
first final evaluation. No code changes in response to final metrics. A failure is
FAIL, not an excuse to relax oracle/thresholds. CI failures in development may be
fixed before the final experiment. Test code and oracle are by the implementer:
NOT an external blinded independent assessment. No real-world generalization.

Browser: actual PDF bytes -> PDF.js -> original IDs -> classification -> visible
feedback and source inspection; mobile viewport, malformed file, reset, no storage.
Work browser if reachable; actual Chromium CI with screenshots otherwise.
Physical Android and independent human QA NOT RUN. Release/merge NO-GO.
