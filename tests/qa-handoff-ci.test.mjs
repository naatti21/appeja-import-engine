import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {collect} from '../scripts/qa-handoff-ci.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const nodeReport = {type: 'test:summary', data: {success: true,
  counts: {tests: 1, passed: 1, failed: 0, skipped: 0, cancelled: 0, todo: 0}}};
const browserReport = {stats: {expected: 1, unexpected: 0, flaky: 0, skipped: 0}, errors: [],
  suites: [{specs: [{tests: [{status: 'expected', expectedStatus: 'passed', results: [{status: 'passed'}]}]}]}]};

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'qa-ci-test-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const cwd = join(root, 'checkout'); mkdirSync(cwd);
  const git = args => execFileSync('git', args, {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
  git(['init']); writeFileSync(join(cwd, 'synthetic.txt'), 'synthetic only\n');
  git(['add', 'synthetic.txt']);
  git(['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'Synthetic fixture']);
  const calls = [];
  const options = {cwd, output: join(root, 'output'), expectedSha: git(['rev-parse', 'HEAD']),
    env: {NODE_TEST_CONTEXT: 'child-v8', PLAYWRIGHT_JSON_OUTPUT_FILE: 'wrong.json'},
    execute: (executable, args, config) => {
      calls.push({executable, args, config});
      writeFileSync(config.stdio[1], JSON.stringify(args[0] === '--test' ? nodeReport : browserReport));
      return {status: 0, signal: null};
    }};
  return {options, calls, git, read: file => readFileSync(join(options.output, file), 'utf8')};
}

test('collector binds fixed selections, exits and report bytes to the clean checkout SHA', t => {
  const f = fixture(t), result = collect(f.options);
  assert.equal(result.status, 'PASS'); assert.equal(result.exitCode, 0);
  assert.equal(result.manifest.lockedTarget, f.options.expectedSha);
  assert.equal(f.calls.length, 2);
  assert.ok(f.calls[0].args.includes('tests/semantic-review.test.mjs'));
  assert.ok(f.calls[1].args.includes('--config=scripts/qa-pilot.playwright.config.mjs'));
  for (const runner of ['node', 'playwright']) {
    const entry = result.manifest[runner];
    assert.equal(entry.exitCode, 0); assert.equal(entry.commit, f.options.expectedSha);
    assert.equal(entry.sha256, hash(f.read(entry.report)));
  }
  for (const file of result.manifest.files) assert.equal(file.sha256, hash(f.read(file.file)));
  for (const call of f.calls) {
    assert.equal(call.config.env.CI, 'true');
    assert.equal(call.config.env.NODE_TEST_CONTEXT, undefined);
    assert.equal(call.config.env.PLAYWRIGHT_JSON_OUTPUT_FILE, undefined);
  }
  assert.match(f.read('report.md'), /independent QA NOT RUN/);
  assert.match(result.manifest.work, /only/);
});

test('runner failure remains failure, retains diagnostics and still runs the second layer', t => {
  const f = fixture(t), real = f.options.execute;
  f.options.execute = (...args) => {
    const result = real(...args);
    writeFileSync(args[2].stdio[2], 'synthetic runner diagnostic');
    return {...result, status: args[1][0] === '--test' ? 7 : 0};
  };
  const result = collect(f.options);
  assert.equal(f.calls.length, 2); assert.equal(result.status, 'FAIL'); assert.equal(result.exitCode, 1);
  assert.equal(result.manifest.node.exitCode, 7);
  assert.match(f.read('node.stderr.log'), /synthetic runner diagnostic/);
  assert.match(f.read('report.md'), /process exit=7/);
});

test('unavailable prerequisites produce NOT RUN or PARTIAL, never a green CI exit', t => {
  const none = fixture(t);
  const notRun = collect({...none.options, nodeReady: false, chromiumReady: false});
  assert.equal(notRun.status, 'NOT RUN'); assert.equal(notRun.exitCode, 2);
  assert.equal(none.calls.length, 0);
  const one = fixture(t);
  const partial = collect({...one.options, chromiumReady: false});
  assert.equal(partial.status, 'PARTIAL'); assert.equal(partial.exitCode, 2);
  assert.equal(one.calls.length, 1); assert.match(partial.markdown, /playwright: NOT RUN/);
});

test('interruption leaves unknown exit and PARTIAL evidence instead of an invented exit', t => {
  const f = fixture(t);
  f.options.execute = () => ({status: null, signal: 'SIGTERM', error: {code: 'ETIMEDOUT'}});
  const result = collect(f.options);
  assert.equal(result.status, 'PARTIAL'); assert.equal(result.exitCode, 2);
  assert.equal(result.manifest.node.exitCode, null);
  assert.equal(result.manifest.node.signal, 'SIGTERM');
  assert.equal(result.manifest.node.launchError, 'ETIMEDOUT');
});

test('started marker is PARTIAL before completion; unexpected capture failure leaves diagnostics', t => {
  const f = fixture(t);
  f.options.execute = () => {
    assert.match(f.read('report.md'), /EVIDENCE:\*\* PARTIAL/);
    throw new Error('synthetic capture error');
  };
  assert.throws(() => collect(f.options), /synthetic capture error/);
  assert.match(f.read('report.md'), /EVIDENCE:\*\* PARTIAL/);
});

test('stale target, dirty checkout and reused output directory are rejected', t => {
  const stale = fixture(t);
  assert.throws(() => collect({...stale.options, expectedSha: '0'.repeat(40)}), /CHECKOUT_SHA_MISMATCH/);
  const dirty = fixture(t); writeFileSync(join(dirty.options.cwd, 'synthetic.txt'), 'modified');
  assert.throws(() => collect(dirty.options), /CHECKOUT_NOT_CLEAN/);
  const reused = fixture(t); collect(reused.options);
  const original = reused.read('manifest.json');
  assert.throws(() => collect(reused.options), /EEXIST/);
  assert.equal(reused.read('manifest.json'), original);
});

test('checkout mutation during a run invalidates the evidence instead of relabelling it', t => {
  const f = fixture(t), real = f.options.execute;
  f.options.execute = (...args) => {
    const result = real(...args);
    writeFileSync(join(f.options.cwd, 'synthetic.txt'), 'mutation');
    return result;
  };
  assert.throws(() => collect(f.options), /CHECKOUT_NOT_CLEAN/);
  const manifest = JSON.parse(f.read('manifest.json'));
  assert.equal(manifest.node.commit, null); assert.equal(manifest.playwright.commit, null);
  assert.match(f.read('report.md'), /EVIDENCE:\*\* PARTIAL/);
});

test('skipped outcomes remain visible through collection and block aggregate PASS', t => {
  const f = fixture(t), real = f.options.execute;
  f.options.execute = (...args) => {
    if (args[1][0] === '--test') {
      const skipped = structuredClone(nodeReport);
      skipped.data.counts = {...skipped.data.counts, tests: 2, skipped: 1};
      writeFileSync(args[2].stdio[1], JSON.stringify(skipped));
      return {status: 0, signal: null};
    }
    return real(...args);
  };
  const result = collect(f.options);
  assert.equal(result.status, 'PARTIAL'); assert.equal(result.exitCode, 2);
  assert.match(result.markdown, /skipped=1/);
});
