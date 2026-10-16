# Opt-in CI handoff pilot

Base: PR #28 / `codex/qa-handoff-pilot` at
`c94f92461a46f5ede58eb946f04024f314670ba3`.
Approved scope: https://github.com/naatti21/appeja-import-engine/pull/28#issuecomment-6214221362.

## Reuse and overlap checked before implementation

PR #16 was inspected read-only at `ae05453977f8e01f08ea55940194ad57077fa946`:
`scripts/qa-artifact-manifest.mjs`, `QA_ARCHIVE.md`, `qa/HANDOFF_TEMPLATE.md`, and
its archive workflows. No branch merge, cherry-pick or source import is needed.

| Existing piece | Pilot choice |
| --- | --- |
| PR #16 tested SHA, SHA-256, run URL, raw logs, 14-day artifacts | Reuse these conventions in the existing five-field manifest/artifact path |
| PR #16 developer-automated / independent QA NOT RUN / production NO-GO | Preserve the same separation and closed gates |
| PR #16 regex parsing of Node/browser text logs | Do not duplicate: pilot #1 already validates native Node summary and Playwright JSON |
| PR #16 archive report / PR-comment template | Use pilot #1's five fields; no second permanent QA index or automatic comments |
| PR #28 `createHandoff()` and native Node reporter | Import directly; no second status reducer or formatter |

## Opt-in and scope

Only `.github/workflows/qa-handoff-pilot.yml` is added. It responds to PR
opened/synchronize/reopened events targeting `codex/qa-handoff-pilot`, and runs
only for same-repository head `codex/qa-handoff-ci-pilot`. A Draft PR can run it;
no default-branch change or `pull_request_target` execution is needed. Pushing the
child branch alone does **not** trigger this pilot. This task does not open a PR.
Existing workflows may separately respond if an owner later opens a PR; this
pilot does not invoke or alter them or run any frozen final evaluation.

Permissions are only `contents: read`. Checkout uses the PR head SHA, with stored
Git credentials disabled. Existing `npm ci` and Playwright Chromium installation
are reused. No added package, token, secret, API call, automatic approval, merge
or deployment. The output is developer-automated evidence, never independent QA.

The fixed Node selection is `qa-handoff.test.mjs`, `qa-handoff-ci.test.mjs` and
`semantic-review.test.mjs`. The Chromium selection is the existing four
`tests/e2e/semantic-review.spec.mjs` tests, including real synthetic PDF bytes,
PDF.js, source inspection, mobile viewport, malformed input and recovery. This
is a bounded selection, not a full-product, real-device or frozen-evaluation PASS.

## Capture and failure behavior

`scripts/qa-handoff-ci.mjs` owns process execution, SHA capture and file hashing;
it accepts no user-written evidence manifest or arbitrary test commands. It
requires the expected SHA to match a clean checkout before and after testing.
Each run requires a fresh output directory, so earlier output cannot be reused.
Both test layers are attempted when their prerequisites succeeded, even after a
test failure. Node emits both native JSON and a diagnostic TAP log; Playwright
emits native JSON. Separate stderr logs, actual process exits/signals, observed
runner durations, file hashes, Node version and optional CI run URL are retained.

The collector saves NOT RUN before starting, PARTIAL before each process launch,
and the actual outcome after completion. It calls the unchanged five-field
generator and returns 0 only for aggregate PASS, 1 for FAIL, 2 for PARTIAL/NOT RUN
or capture errors. Skips, expected failures and flaky tests are not upgraded to
PASS. Signals/launch errors retain an unknown exit rather than an invented code.
Checkout mutations invalidate evidence. Setup failures remain failing workflow
steps; unavailable test layers stay NOT RUN. No `continue-on-error` is used.

Summary and artifact steps use `if: always()`. Missing reports produce an explicit
summary error. Artifacts contain manifest, five-field report, raw results, logs
and any Playwright diagnostics; retention is 14 days. Forced runner termination
can prevent final upload, so absence of an artifact is never evidence of PASS.
Hashes bind the observed bytes; they do not independently authenticate the CI
actor or establish human approval.

## Local verification

After committing, from the repository root with dependencies installed:

```bash
QA_EXPECTED_SHA=$(git rev-parse HEAD) \
QA_NODE_READY=true QA_CHROMIUM_READY=true \
node scripts/qa-handoff-ci.mjs /tmp/appeja-pilot-evidence-UNIQUE
```

Use a new output path each time. The CLI deliberately refuses dirty checkouts.
For a preinstalled local Chromium only, additionally set
`QA_CHROMIUM_EXECUTABLE=/usr/bin/chromium`; the override is recorded in the
manifest. CI uses Playwright's pinned browser with no override. Local system
Chromium results must not be represented as a run on the CI browser version.
Collector unit tests use synthetic temporary Git repositories and mocked runner
responses; the real collector run above supplies the Node/Chromium integration
evidence. Existing pilot #1 tests also exercise actual native runner outputs.

## Benefit measurement (bounded task count)

Counting unit: separately coordinated evidence-collection/reporting stages, not
individual shell commands or UI clicks. Pilot #1's documented example already
scripts some of these operations for Node; that existing automation is credited.
Its two-runner path still requires coordinating these stages:

1. Lock/check the checkout SHA.
2. Run Node and preserve its native result and exit.
3. Run Chromium and preserve its native result and exit.
4. Bind results, exits and hashes into the shared manifest.
5. Render the five-field handoff and honor its exit.
6. Publish the evidence for review.

The new collector coordinates stages 1–5 with one invocation: **five locally
coordinated stages to one (four coordination boundaries removed)**. The workflow
also configures stage 6 and the initial trigger; actual zero-touch CI publication
is **NOT VERIFIED** until this workflow runs on a qualifying PR. Review remains
a human task. This is a reproducible operation-count comparison, not an observed
human productivity study. Human time saved: **NOT MEASURED**. Recorded process
durations measure execution only and must not be presented as labor savings.
