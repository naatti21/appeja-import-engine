# AGENTS.md — appeja-import-engine

## Repository and scope
- This repository is a research sandbox for document-import evidence and review workflows, **not** a production import approval engine.
- As of 2026-10-16, `main` contains only a README. Active work exists in separate Draft PR research branches. Inspect the target branch and its PR before assuming a file, test command, or module exists.
- An instruction for one research PR does not automatically authorize changes to any other PR, product repo, deployment branch, or `main`.

## Before changes
- Read the task's explicit scope, acceptance criteria, target base branch and frozen HEAD SHA. If these are absent or ambiguous, report the ambiguity; do not choose a release path yourself.
- Read the relevant PR protocol, README, test fixtures, and QA notes on the actual target branch. Prefer exact source links and commits over chat history.
- Work on an isolated branch. Keep existing production Palkka, Osakevahti, and Visual Academy files untouched.
- List proposed paths; changes outside them require explicit approval.

## Data integrity and research safeguards
- Use synthetic, non-identifying documents and fixtures. Never commit actual payslips, holdings, personal records, credentials, API keys, or production data.
- Preserve raw source observations and stable source IDs. Distinguish value sources, heading/context sources, reader uncertainty and unsupported claims.
- Keep unresolved or conflicting financial evidence review-required. No silent acceptance, persistence, deletion, automatic correction, or export into production.
- Preserve frozen evaluation/holdout datasets and their oracles. Do not tune against HOLDOUT or older EVAL cases, alter locked thresholds, or recycle evaluation cases as development tests.
- Do not claim safety, production readiness, financial-document performance, or independent QA merely because synthetic tests pass.

## Implementation boundaries
- Prefer the smallest test-first change that addresses the current, explicitly assigned question.
- Do not broaden research into application integration, service-worker changes, release workflows, or `src/` code without a separately authorized task and its own review gate.
- Avoid dependencies, remote APIs, and new storage unless required by explicit scope and documented. Keep sensitive data local.
- Never merge a PR, publish, deploy, auto-accept source claims, or weaken a safety gate without explicit user GO and the existing QA requirements.

## Verification
- On the target branch, inspect `package.json` and its scripts before selecting commands: bare `main` does not have a test runner.
- Run targeted tests and appropriate full Node / Chromium / local OCR tests **only when available and relevant**; record exact commands and SHA. Missing infrastructure means `NOT RUN`, never presumed PASS.
- Favor reproducible GitHub Actions evidence tied to the exact tested HEAD SHA. New SHA requires new applicable checks; do not inherit earlier GO.
- Clearly separate author-written tests, independent QA, physical Android checks, financial-document studies, and real production validation.
- Report limitations and regressions, including false acceptance, false blocks, nuisance alerts, missing source linkage, and offline/browser behavior when applicable.

## End-of-task handoff (five fields, concise)
1. **WORK:** repository, branch/PR, scope actually changed.
2. **LOCKED TARGET:** exact HEAD SHA or artifact ID.
3. **EVIDENCE:** PASS / FAIL / PARTIAL / NOT RUN, commands and limits.
4. **GATE:** Draft, QA, user GO, merge and deploy statuses separately.
5. **ONE NEXT ACTION:** owner and concrete next step; state if user input is required.

Stop after handing off. Do not start an unrelated follow-up, create redundant status documents, or rewrite project history.