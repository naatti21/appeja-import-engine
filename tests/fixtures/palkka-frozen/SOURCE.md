# Frozen production-candidate payroll parser snapshot

This directory is a **test-only, unchanged** copy of `parser.js` and its direct import `semantic-evidence.js` from `naatti21/Palkan-laskenta` Git commit `550c765413c0916259c67b44ba8dfdb9b3f06da6` (Draft PR #13 candidate, NOT production main).

This is an own-account research benchmark and is NOT a proposed refactor or replacement of the salary application. The app's preview/UI approval, persisted model and multiple other source inputs are not executed. No private payroll data or attachments are used.

`tests/fixtures/legacy-lines.mjs` independently mirrors the `pageItemsToLines()` stage from the same frozen `pdf-reader.js`. The full `parsePayslip({text, lines})` export is invoked in the v0.4 comparative experiment for the overlapping payroll monetary fields; do not claim full application equivalence from these 3 fields.
