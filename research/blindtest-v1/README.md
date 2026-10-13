# Import Engine Blindtest V1 - public DEV archive

Six existing, fictional digital PDFs and their ground truth: three payroll documents and three other tables. No documents were regenerated for archiving. Baseline SHA: `8f28544651a27225c1212228753fbc6c6a265c38`.

Files: `DEV/` contains six PDFs; `ANNOTATIONS/DEV/` contains six JSON annotations. `MANIFEST.json` locks their SHA-256 hashes. `TEST_PROTOCOL.md` defines evaluation, and `VALIDATION_REPORT.md` states actual validation limits.

HOLDOUT inputs, answers, author sources and observations are deliberately absent from this repository, all branches and this archival commit. The evaluator receives a separate private ZIP. Only its SHA-256, document count and version are published.

Annotation `bbox_pt` uses PDF points from the top-left (x0,y0,x1,y1). These are source regions/cells, not exact glyph boxes. `page` is 1-based. Ground truth IDs are not PDF.js item IDs. Numeric `value` strings preserve decimal precision; ISO dates and text IDs are strings. Null is missing/ambiguous, never zero. `role`, `record`, `unit` and source area all matter. `parts` preserves split values. Payroll core has four separate keys; other documents have their own schema.

Single-agent provisional validation only. Synthetic holdout is not a real-world sample. Import Engine NOT RUN; no production GO. All names, companies and figures are invented and marked fictional in the PDFs.
