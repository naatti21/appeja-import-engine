import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const shaPattern = /^[0-9a-f]{40}$/;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const text = value => typeof value === 'string' && value.trim().length > 0;
const result = (status, detail) => ({status, detail});
const partial = detail => result('PARTIAL', detail);
const sum = values => values.reduce((a, b) => a + b, 0);
const countsText = counts => Object.entries(counts).map(([key, value]) => `${key}=${value}`).join(', ');
// Keep each field on one line and treat user-supplied metadata as literal text.
const markdownText = value => value.replace(/[\x00-\x1f\x7f]+/g, ' ')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/[\\`*_{}\[\]()#!|]/g, '\\$&').trim();

function nodeEvidence(report) {
  const data = report?.data, c = data?.counts;
  const keys = ['passed', 'failed', 'cancelled', 'skipped', 'todo'];
  if (report?.type !== 'test:summary' || data?.file !== undefined ||
      typeof data?.success !== 'boolean' || !integer(c?.tests) ||
      !keys.every(key => integer(c[key])) || sum(keys.map(key => c[key])) !== c.tests ||
      data.success !== (c.failed === 0 && c.cancelled === 0)) {
    return partial('invalid or incomplete Node whole-run summary');
  }
  const detail = countsText(Object.fromEntries(['tests', ...keys].map(key => [key, c[key]])));
  if (c.failed) return result('FAIL', detail);
  if (c.cancelled || c.todo) return partial(detail);
  if (c.tests === 0 || c.skipped === c.tests) return result('NOT RUN', detail);
  return result(c.skipped ? 'PARTIAL' : 'PASS', detail);
}

function playwrightEvidence(report) {
  const keys = ['expected', 'unexpected', 'flaky', 'skipped'];
  if (!keys.every(key => integer(report?.stats?.[key])) ||
      !Array.isArray(report?.errors) || !Array.isArray(report?.suites)) {
    return partial('invalid or incomplete Playwright JSON report');
  }
  if (report.errors.length) return result('FAIL', `runner errors=${report.errors.length}`);
  const observed = {expected: 0, unexpected: 0, flaky: 0, skipped: 0};
  let expectedFailures = 0;
  const statuses = ['passed', 'failed', 'timedOut', 'skipped', 'interrupted'];
  function visit(suites) {
    for (const suite of suites) {
      if (!suite || (suite.specs !== undefined && !Array.isArray(suite.specs)) ||
          (suite.suites !== undefined && !Array.isArray(suite.suites))) return false;
      for (const spec of suite.specs ?? []) {
        if (!Array.isArray(spec?.tests) || spec.tests.length === 0) return false;
        for (const test of spec.tests) {
          if (!test || !keys.includes(test.status) ||
              !['passed', 'failed', 'skipped'].includes(test.expectedStatus) ||
              !Array.isArray(test.results) ||
              !test.results.every(r => r && statuses.includes(r.status))) return false;
          if (test.status !== 'skipped' && test.results.length === 0) return false;
          if (test.status === 'expected') {
            if (!['passed', 'failed'].includes(test.expectedStatus) ||
                !test.results.every(r => r.status === test.expectedStatus)) return false;
            if (test.expectedStatus === 'failed') expectedFailures++;
          }
          if (test.status === 'skipped' && !test.results.every(r => r.status === 'skipped')) return false;
          observed[test.status]++;
        }
      }
      if (!visit(suite.suites ?? [])) return false;
    }
    return true;
  }
  if (!visit(report.suites) || !keys.every(key => observed[key] === report.stats[key])) {
    return partial('Playwright totals disagree with test outcomes or outcomes are incomplete');
  }
  const detail = countsText({...observed, 'expected-failure': expectedFailures});
  if (observed.unexpected) return result('FAIL', detail);
  if (observed.flaky || expectedFailures) return partial(detail);
  if (sum(Object.values(observed)) === observed.skipped) return result('NOT RUN', detail);
  return result(observed.skipped ? 'PARTIAL' : 'PASS', detail);
}

function readEvidence(entry, runner, target, directory) {
  if (entry === null || entry === undefined) return result('NOT RUN', 'no run supplied');
  if (entry.commit !== target) return partial('missing or mismatched tested commit');
  if (!text(entry.command)) return partial('missing command');
  if (!integer(entry.exitCode)) return partial('missing or invalid process exit code');
  const withExit = evidence => entry.exitCode === 0 ? evidence :
    result('FAIL', `process exit=${entry.exitCode}; ${evidence.detail}`);
  // Retain report counts/errors, but never overwrite a nonzero runner exit.
  if (!text(entry.report) || !/^[0-9a-f]{64}$/.test(entry.sha256 ?? '')) {
    return withExit(partial('missing report path or SHA-256'));
  }
  let report;
  try {
    const bytes = readFileSync(resolve(directory, entry.report));
    if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) {
      return withExit(partial('report SHA-256 mismatch'));
    }
    report = JSON.parse(bytes.toString('utf8'));
  } catch {
    return withExit(partial('report unreadable or invalid JSON'));
  }
  return withExit(runner === 'node' ? nodeEvidence(report) : playwrightEvidence(report));
}

export function createHandoff(manifest, directory = '.') {
  if (!manifest || typeof manifest.lockedTarget !== 'string' || !shaPattern.test(manifest.lockedTarget)) {
    throw new Error('lockedTarget must be an exact lowercase 40-character commit SHA');
  }
  for (const field of ['work', 'nextAction']) {
    if (!text(manifest[field])) throw new Error(`${field} must be nonempty text`);
  }
  const checks = ['node', 'playwright'].map(runner => ({runner,
    ...readEvidence(manifest[runner], runner, manifest.lockedTarget, directory),
  }));
  const states = checks.map(check => check.status);
  const status = states.includes('FAIL') ? 'FAIL' :
    states.every(state => state === 'PASS') ? 'PASS' :
    states.every(state => state === 'NOT RUN') ? 'NOT RUN' : 'PARTIAL';
  const evidence = checks.map(({runner, status, detail}) => {
    const command = manifest[runner]?.command;
    return `${runner}: ${status} (${detail})${text(command) ? `; command: ${markdownText(command)}` : ''}`;
  }).join(' / ');
  const markdown = [
    `1. **WORK:** ${markdownText(manifest.work)}`,
    `2. **LOCKED TARGET:** ${manifest.lockedTarget}`,
    `3. **EVIDENCE:** ${status} — ${evidence}. Author-supplied checks only; no full-suite, independent QA or production claim.`,
    '4. **GATE:** Draft handoff; independent QA NOT RUN; user approval NOT GIVEN; merge NO-GO; deployment NO-GO.',
    `5. **ONE NEXT ACTION:** ${markdownText(manifest.nextAction)}`,
  ].join('\n') + '\n';
  return {status, markdown};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node scripts/qa-handoff.mjs <manifest.json>');
    const file = resolve(process.argv[2]);
    const {status, markdown} = createHandoff(JSON.parse(readFileSync(file, 'utf8')), dirname(file));
    process.stdout.write(markdown);
    process.exitCode = status === 'PASS' ? 0 : status === 'FAIL' ? 1 : 2;
  } catch (error) {
    console.error(`qa-handoff: ${error.message}`);
    process.exitCode = 2;
  }
}
