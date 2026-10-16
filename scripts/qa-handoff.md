# Deterministic QA handoff (reporting only)

Run `node scripts/qa-handoff.mjs /path/to/manifest.json`. It reads existing local
artifacts and prints exactly five Markdown fields. It does not run commands from
the manifest, modify research results, access a remote API, or grant approval.
No dependencies beyond Node are needed by the converter or Node reporter.

Existing workflows retain their text logs and experiment-specific manifests.
This adapter adds the missing common handoff format; it neither replaces those
experiments nor changes workflows, frozen corpora, or acceptance thresholds.

## Inputs and provenance

The JSON manifest has `work`, `lockedTarget` (full lowercase 40-character commit
SHA), `nextAction` (one owner/action, including whether user input is needed), and
`node` / `playwright`. An absent or null runner means NOT RUN. Each supplied runner
entry has these fields:

| Field | Meaning |
| --- | --- |
| `commit` | Actual tested commit; must equal `lockedTarget` |
| `command` | Exact command and selection used for that run |
| `exitCode` | Actual runner process exit, captured before another command runs |
| `report` | Artifact path, relative to the manifest directory or absolute |
| `sha256` | SHA-256 of the report bytes, captured with that run |

Node input is the final native `test:summary` event, emitted as JSON by
`scripts/qa-node-reporter.mjs`. Per-file summaries are excluded; interrupted runs
without a final summary cannot pass. Validated with Node 22.20.0 and 24.19.0.
Playwright input is its native `--reporter=json` output (repository pin 1.57.0).
The converter compares aggregate counts with nested test outcomes and recognizes
expected failures separately from passes. Human-readable TAP/spec/log output and
old research-result JSON formats are deliberately not guessed or scraped.

Record the SHA, command, exit and digest together immediately after a run, from a
clean committed checkout. Keep the original artifacts. Do not attach an old report
to a new SHA. The digest detects changed bytes; it does **not** authenticate the
producer's SHA/command claims or prove complete test selection. This is an
author-supplied handoff, not independent QA or CI verification. A new commit needs
new applicable evidence. Neither QA_STATUS.md's historical PASS counts nor a
branch name supplies evidence for the current target.

## Status rules

- PASS: both supplied runners completed with exit 0, consistent nonzero outcomes,
  and only passing tests. PASS applies only to the recorded commands/selections.
- FAIL: a matching-target command has a nonzero exit, a Node failure, an unexpected
  Playwright outcome, or a Playwright runner error. A failing exit remains FAIL
  even if its report is missing or says PASS.
- PARTIAL: incomplete/unreadable/invalid reports, missing or mismatched provenance,
  unknown exit, cancelled/TODO tests, flaky retries, expected failures, or a mixture
  of passes and skipped/missing checks. Skips and expected failures are counted
  separately. A mismatched commit is unusable evidence for this target.
- NOT RUN: no evidence, zero tests, or all tests skipped. Zero exit alone is not PASS.

Overall precedence: FAIL; otherwise PASS only if both runners PASS; otherwise
NOT RUN if both are NOT RUN; otherwise PARTIAL. Gates always state Draft handoff,
independent QA NOT RUN, user approval NOT GIVEN, merge NO-GO, deployment NO-GO.
These are conservative handoff defaults, not a lookup of GitHub or human approvals.
No input field can turn a test result into permission to merge or deploy.

Exit status: 0 for PASS, 1 for FAIL, 2 for PARTIAL / NOT RUN. Invalid manifest
metadata or CLI usage emits an error on stderr, no handoff, and exits 2. Markdown
metadata is escaped and collapsed to a single line. Identical inputs produce
identical output; no current time, Git lookup or inferred approval is inserted.

## Reproduce a bounded author handoff

Install the existing pinned dev dependencies with `npm ci`. Commit the reporting
change first, then run this Bash example from the repository root. It intentionally
records Playwright as NOT RUN at the handoff level. The focused Node suite itself
exercises native Playwright JSON using temporary synthetic tests without a browser.
It is not Chromium/application validation. The resulting overall status is PARTIAL
and exit 2 when the focused Node tests pass.

```bash
set -eu
test -z "$(git status --porcelain)" || { echo 'Commit or preserve changes first' >&2; exit 1; }
qa_dir=$(mktemp -d /tmp/appeja-handoff.XXXXXX)
target=$(git rev-parse HEAD)
node_exit=0
node --test --test-reporter=./scripts/qa-node-reporter.mjs tests/qa-handoff.test.mjs \
  > "$qa_dir/node.json" || node_exit=$?
test "$target" = "$(git rev-parse HEAD)"
test -z "$(git status --porcelain)"
QA_DIR="$qa_dir" QA_TARGET="$target" QA_NODE_EXIT="$node_exit" node --input-type=module <<'JS'
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const dir = process.env.QA_DIR;
const manifest = {
  work: 'appeja-import-engine: bounded reporting-tool author tests',
  lockedTarget: process.env.QA_TARGET,
  node: {
    commit: process.env.QA_TARGET,
    command: 'node --test --test-reporter=./scripts/qa-node-reporter.mjs tests/qa-handoff.test.mjs',
    exitCode: Number(process.env.QA_NODE_EXIT),
    report: 'node.json',
    sha256: createHash('sha256').update(readFileSync(`${dir}/node.json`)).digest('hex'),
  },
  playwright: null,
  nextAction: 'Independent reviewer: review this exact commit and evidence; user input not required for review.',
};
writeFileSync(`${dir}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
JS
handoff_exit=0
node scripts/qa-handoff.mjs "$qa_dir/manifest.json" > "$qa_dir/handoff.md" || handoff_exit=$?
cat "$qa_dir/handoff.md"
exit "$handoff_exit"
```

For a separately authorized browser run, use the existing research instructions
and installed Chromium, e.g. `npx playwright test tests/e2e/semantic-review.spec.mjs
--reporter=json > /path/to/playwright.json`. Capture that process's actual exit,
tested commit and report digest in the same way; replace `playwright: null` with
its entry. Do not put npm banner/log output in the JSON file. If using additional
reporters, direct Playwright's JSON reporter to a dedicated output file. No browser
run, physical Android check, OCR study, frozen evaluation or independent QA result
is implied by the reporting tool's own synthetic tests.

Focused verification: `node --test tests/qa-handoff.test.mjs` (requires the existing
Playwright dev dependency). Synthetic child runs deliberately fail, skip, retry,
and expect failures; their outcomes are asserted by the enclosing tests.
