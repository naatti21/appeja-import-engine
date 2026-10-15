# Semantic review: practical PDF triage

From frozen PR24 `99ee1dcfa8540620e6853a18adf42b6236d6774d`.
No changes to src, previous research, application code or acceptance gates.

Run `npm ci`, `node research/browser-review-v1/stage-pdf.mjs`, then
`python3 -m http.server 4175 --bind 127.0.0.1` and visit
`http://127.0.0.1:4175/research/semantic-review-v1/`.
Use the synthetic salary PDF button, or upload a synthetic native-text PDF.
Generate bytes with `reviewPdf([{lines:[...]}])` in `example-pdf.mjs`.

## Architecture

| Dimension | Authority | UI consequence |
| --- | --- | --- |
| Value evidence | Existing unchanged source gate: consumes complete IDs/text | Cannot be supplied by metadata classification |
| Header/context evidence | PR24 structural scope model only; no semantic approval | Cannot turn an unknown value into a verified one |
| Relevance | New whole-observation administrative grammar | Only exact safe metadata becomes informational |
| Unknown/financial/conflict | Conservative fallback, preserving occurrence IDs | Correction/clarification required |

Original observations are returned intact; original array index disambiguates
malformed duplicate IDs. No inferred joins of split numeric or administrative
fragments. Reader issues, overlap or conflicting recognized declarations override
administrative matches. Numeric identifiers require an explicit ID label and an
alphabetic prefix. Dates with financial meaning are not administrative timestamps.
PDF page counters are checked against actual page and page count.

The new screen supports PDF import, source text, ID and page highlight, responsive
layout, reset, failure recovery, and example bytes. Corrections mean repairing the
source and reimporting; no inline metadata dismissal or financial acceptance.
CSV/OCR remain in the prior tool with their unchanged safety behavior. Financial
field extraction is NOT added here: financial content stays actionable, even when
it is actually correct. Do not interpret source triage as financial validation.

## Evidence and limits

Development tests: `node --test tests/semantic-review.test.mjs`.
Full Node: `npm test`. Actual browser:
`npx playwright test tests/e2e/semantic-review.spec.mjs`.
Final experiment ONLY after freeze: `node research/semantic-review-v1/evaluation/run.mjs`.
Locked protocol/annotations predate implementation (local preregistration commit
424c127; exact file hashes in evaluation/LOCK.json).

Work browser attempt: local test URL ERR_CONNECTION_REFUSED; CI Chromium is the
allowed fallback. No bypass of network/URL restrictions. Screenshots in dedicated
Actions artifact, retained 14 days. Mobile viewport is not real Android.

Metadata grammar is intentionally narrow. Arbitrary layouts, multilingual notices,
split administrative text, scanner-only PDFs, rotated/cropped pages, invisible
PDF text vs rendered-image differences, and the meaning/correctness of financial
values remain limitations. Text-layer content can differ from visual PDF content;
this is why even an all-informational result cannot authorize financial import.
Up to 5 MiB / 20 pages / 2000 text elements supported in this research UI.
No external independent QA or user timing study. No production GO.
