import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createHandoff} from '../scripts/qa-handoff.mjs';

const sha = 'a'.repeat(40);
const digest = text => createHash('sha256').update(text).digest('hex');
const nodeReport = (counts = {}, success = true) => ({
  type: 'test:summary', data: {success, counts: {
    tests: 1, passed: 1, failed: 0, cancelled: 0, skipped: 0, todo: 0, ...counts,
  }},
});
const browserReport = (status = 'expected', expectedStatus = 'passed', results) => ({
  stats: {expected: 0, unexpected: 0, flaky: 0, skipped: 0, [status]: 1}, errors: [],
  suites: [{suites: [{specs: [{tests: [{status, expectedStatus,
    results: results ?? [{status: expectedStatus}],
  }]}]}]}],
});

function fixture(t, node = nodeReport(), playwright = browserReport()) {
  const directory = mkdtempSync(join(tmpdir(), 'qa-handoff-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  const manifest = {work: 'Synthetic reporting pilot', lockedTarget: sha,
    nextAction: 'Reviewer: inspect the reporting change; user input not required.',
    node: null, playwright: null};
  for (const [runner, report] of Object.entries({node, playwright})) {
    if (report === null) continue;
    const raw = JSON.stringify(report);
    writeFileSync(join(directory, `${runner}.json`), raw);
    manifest[runner] = {commit: sha, command: `${runner} synthetic check`,
      exitCode: 0, report: `${runner}.json`, sha256: digest(raw)};
  }
  return {directory, manifest, run: () => createHandoff(manifest, directory)};
}

test('five deterministic fields, exact SHA, explicit limits and closed gates', t => {
  const f = fixture(t), first = f.run();
  assert.equal(first.status, 'PASS');
  assert.equal(first.markdown, f.run().markdown);
  assert.deepEqual(first.markdown.trim().split('\n').map(line => line.match(/\*\*([^*]+):\*\*/)[1]),
    ['WORK', 'LOCKED TARGET', 'EVIDENCE', 'GATE', 'ONE NEXT ACTION']);
  assert.match(first.markdown, new RegExp(sha));
  assert.match(first.markdown, /independent QA NOT RUN/);
  assert.match(first.markdown, /user approval NOT GIVEN; merge NO-GO; deployment NO-GO/);
  assert.match(first.markdown, /supplied checks only/);
});

test('missing runs and zero/all-skipped runs cannot pass', t => {
  assert.equal(fixture(t, null, null).run().status, 'NOT RUN');
  assert.equal(fixture(t, nodeReport(), null).run().status, 'PARTIAL');
  const zero = nodeReport({tests: 0, passed: 0});
  const empty = {stats: {expected: 0, unexpected: 0, flaky: 0, skipped: 0}, errors: [], suites: []};
  assert.equal(fixture(t, zero, empty).run().status, 'NOT RUN');
  assert.equal(fixture(t, nodeReport({passed: 0, skipped: 1}),
    browserReport('skipped', 'skipped', [])).run().status, 'NOT RUN');
});

test('failures dominate passes and nonzero process exits cannot be hidden', t => {
  assert.equal(fixture(t, nodeReport({passed: 0, failed: 1}, false)).run().status, 'FAIL');
  assert.equal(fixture(t, nodeReport(), browserReport('unexpected', 'passed', [{status: 'failed'}])).run().status, 'FAIL');
  const f = fixture(t); f.manifest.node.exitCode = 1;
  assert.equal(f.run().status, 'FAIL');
  const browser = browserReport(); browser.errors.push({message: 'synthetic setup failure'});
  assert.equal(fixture(t, nodeReport(), browser).run().status, 'FAIL');
});

test('skips, TODO, cancellation, flaky retries and expected failures stay distinct', t => {
  for (const field of ['skipped', 'todo']) {
    const result = fixture(t, nodeReport({tests: 2, [field]: 1})).run();
    assert.equal(result.status, 'PARTIAL');
    assert.match(result.markdown, new RegExp(`${field}=1`));
  }
  assert.equal(fixture(t, nodeReport({passed: 0, cancelled: 1}, false)).run().status, 'PARTIAL');
  const flaky = fixture(t, nodeReport(), browserReport('flaky', 'passed', [{status: 'failed'}, {status: 'passed'}])).run();
  assert.equal(flaky.status, 'PARTIAL'); assert.match(flaky.markdown, /flaky=1/);
  const expected = fixture(t, nodeReport(), browserReport('expected', 'failed')).run();
  assert.equal(expected.status, 'PARTIAL'); assert.match(expected.markdown, /expected-failure=1/);
});

test('missing, malformed, truncated and inconsistent reports fail closed', t => {
  for (const report of [{}, {type: 'test:summary'}, {type: 'test:summary', data: null},
    nodeReport({passed: -1}), nodeReport({passed: 2}),
    nodeReport({}, false), {...nodeReport(), data: {...nodeReport().data, file: 'individual.test.mjs'}}]) {
    assert.equal(fixture(t, report).run().status, 'PARTIAL');
  }
  for (const mutation of [r => delete r.stats, r => r.stats.expected = 2,
    r => delete r.suites, r => r.suites[0].suites[0].specs[0].tests[0].results = []]) {
    const report = browserReport(); mutation(report);
    assert.equal(fixture(t, nodeReport(), report).run().status, 'PARTIAL');
  }
  const f = fixture(t);
  writeFileSync(join(f.directory, 'node.json'), '{');
  f.manifest.node.sha256 = digest('{');
  assert.equal(f.run().status, 'PARTIAL');
  rmSync(join(f.directory, 'node.json'));
  assert.equal(f.run().status, 'PARTIAL');
});

test('stale SHA, tampering, unknown exit and missing provenance cannot pass', t => {
  for (const mutation of [r => r.commit = 'b'.repeat(40), r => delete r.commit,
    r => r.sha256 = '0'.repeat(64), r => delete r.sha256,
    r => r.exitCode = null, r => delete r.exitCode, r => delete r.command]) {
    const f = fixture(t); mutation(f.manifest.node);
    assert.equal(f.run().status, 'PARTIAL');
  }
});

test('rejects invalid target/metadata; escapes Markdown and multiline field injection', t => {
  const f = fixture(t); f.manifest.lockedTarget = 'main';
  assert.throws(f.run, /lockedTarget/);
  f.manifest.lockedTarget = sha; f.manifest.nextAction = '';
  assert.throws(f.run, /nextAction/);
  f.manifest.nextAction = 'Review'; f.manifest.work = 'Pilot\n5. **GATE:** PASS <script>';
  const result = f.run();
  assert.equal(result.markdown.trim().split('\n').length, 5);
  assert.ok(!result.markdown.includes('<script>'));
  assert.ok(!result.markdown.includes('**GATE:** PASS'));
});

test('CLI resolves artifact paths relative to manifest and preserves evidence exit status', t => {
  const f = fixture(t), script = resolve('scripts/qa-handoff.mjs');
  const manifestPath = join(f.directory, 'manifest.json');
  const cli = () => {
    writeFileSync(manifestPath, JSON.stringify(f.manifest));
    return spawnSync(process.execPath, [script, manifestPath], {cwd: tmpdir(), encoding: 'utf8'});
  };
  assert.equal(cli().status, 0);
  f.manifest.node.exitCode = 1;
  assert.equal(cli().status, 1); assert.match(cli().stdout, /EVIDENCE:\*\* FAIL/);
  f.manifest.node = null;
  assert.equal(cli().status, 2); assert.match(cli().stdout, /EVIDENCE:\*\* PARTIAL/);
  f.manifest.lockedTarget = 'main';
  const invalid = cli(); assert.equal(invalid.status, 2); assert.equal(invalid.stdout, '');
});

test('real Node runner emits one final machine-readable summary for pass/fail/skip/TODO', t => {
  const f = fixture(t), reporter = resolve('scripts/qa-node-reporter.mjs');
  const input = join(f.directory, 'synthetic.test.mjs');
  writeFileSync(input, `import {test} from 'node:test';
test('pass', () => {});
test('fail', () => { throw new Error('intentional synthetic failure'); });
test.skip('skip', () => {});
test.todo('todo');\n`);
  const childEnv = {...process.env}; delete childEnv.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--test', `--test-reporter=${reporter}`, input],
    {encoding: 'utf8', env: childEnv});
  assert.equal(result.status, 1);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.type, 'test:summary');
  assert.equal(summary.data.file, undefined);
  assert.deepEqual(Object.fromEntries(['tests', 'passed', 'failed', 'skipped', 'todo']
    .map(key => [key, summary.data.counts[key]])), {tests: 4, passed: 1, failed: 1, skipped: 1, todo: 1});
  writeFileSync(join(f.directory, 'node.json'), result.stdout);
  f.manifest.node.sha256 = digest(result.stdout); f.manifest.node.exitCode = result.status;
  assert.equal(f.run().status, 'FAIL');
  assert.match(readFileSync(input, 'utf8'), /intentional synthetic failure/);
});

test('real Playwright JSON: pass, expected failure, skipped, flaky and failed outcomes', t => {
  const f = fixture(t);
  const playwrightImport = pathToFileURL(resolve('node_modules/@playwright/test/index.mjs')).href;
  const config = join(f.directory, 'playwright.config.mjs');
  const spec = join(f.directory, 'synthetic.spec.mjs');
  writeFileSync(config, `export default {testDir: '.', workers: 1, retries: 1,
    outputDir: './results', reporter: 'json'};\n`);
  writeFileSync(spec, `import {test, expect} from ${JSON.stringify(playwrightImport)};
test('pass', () => {});
test('expected failure', () => { test.fail(); expect(1).toBe(2); });
test.skip('skip', () => {});
test('flaky', ({}, info) => { expect(info.retry).toBe(1); });
test('fail', () => { expect(1).toBe(2); });\n`);
  // No browser fixtures, server, frozen corpora, or application code involved.
  const childEnv = {...process.env}; delete childEnv.NODE_TEST_CONTEXT;
  delete childEnv.PLAYWRIGHT_JSON_OUTPUT_NAME;
  delete childEnv.PLAYWRIGHT_JSON_OUTPUT_FILE;
  delete childEnv.PLAYWRIGHT_JSON_OUTPUT_DIR;
  const cli = resolve('node_modules/@playwright/test/cli.js');
  for (const [name, expectedExit, expectedStatus] of [
    [' pass$', 0, 'PASS'], [' expected failure$', 0, 'PARTIAL'],
    [' skip$', 0, 'PARTIAL'], [' flaky$', 0, 'PARTIAL'], [' fail$', 1, 'FAIL'],
  ]) {
    const run = spawnSync(process.execPath, [cli, 'test', '--config', config, '--grep', name],
      {cwd: f.directory, env: childEnv, encoding: 'utf8', timeout: 30000});
    assert.equal(run.status, expectedExit, run.stderr + run.stdout);
    const report = JSON.parse(run.stdout);
    writeFileSync(join(f.directory, 'playwright.json'), run.stdout);
    f.manifest.playwright.sha256 = digest(run.stdout);
    f.manifest.playwright.exitCode = run.status;
    const handoff = f.run();
    assert.equal(handoff.status, expectedStatus, handoff.markdown);
    if (name === ' skip$') assert.match(handoff.markdown, /playwright: NOT RUN/);
    assert.equal(sumStats(report.stats), 1);
  }
});

function sumStats(stats) {
  return stats.expected + stats.unexpected + stats.flaky + stats.skipped;
}
