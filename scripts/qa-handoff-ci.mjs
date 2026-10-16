import {closeSync, mkdirSync, openSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHandoff} from './qa-handoff.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const nodeTests = ['tests/qa-handoff.test.mjs', 'tests/qa-handoff-ci.test.mjs', 'tests/semantic-review.test.mjs'];
const exitFor = status => status === 'PASS' ? 0 : status === 'FAIL' ? 1 : 2;

function checkout(cwd, expectedSha) {
  const git = args => execFileSync('git', args, {cwd, encoding: 'utf8'}).trim();
  const sha = git(['rev-parse', 'HEAD']);
  if (!/^[a-f0-9]{40}$/.test(expectedSha) || sha !== expectedSha) throw new Error('CHECKOUT_SHA_MISMATCH');
  if (git(['status', '--porcelain', '--untracked-files=normal'])) throw new Error('CHECKOUT_NOT_CLEAN');
  return sha;
}

// Commands and selection are fixed here, never accepted from an input manifest.
export function collect({cwd, output, expectedSha, nodeReady = true, chromiumReady = true,
  runUrl = null, execute = spawnSync, env = process.env}) {
  cwd = resolve(cwd); output = resolve(output);
  const sha = checkout(cwd, expectedSha);
  if (typeof nodeReady !== 'boolean' || typeof chromiumReady !== 'boolean') throw new Error('INVALID_READINESS');
  // Refuse old evidence rather than overwriting or relabelling an earlier run.
  mkdirSync(output);
  const manifest = {schemaVersion: 1,
    work: 'appeja-import-engine: opt-in pilot; reporting tests, semantic DEV regressions and semantic Chromium review only',
    lockedTarget: sha, testedCommitSha: sha, QAClass: 'developer-automated',
    independentQA: 'NOT RUN', productionDecision: 'NO-GO', sourceData: 'synthetic-only',
    runUrl, setup: {nodeReady, chromiumReady}, nodeVersion: process.version,
    chromiumExecutableOverride: env.QA_CHROMIUM_EXECUTABLE || null,
    node: null, playwright: null, files: [],
    nextAction: 'Independent reviewer: inspect this exact SHA, raw artifacts and five-field handoff; user approval is still required before any merge.',
  };
  function save() {
    manifest.files = readdirSync(output).filter(name => !['manifest.json', 'report.md'].includes(name))
      .sort().map(file => {
        const bytes = readFileSync(resolve(output, file));
        return {file, bytes: bytes.length, sha256: digest(bytes)};
      });
    const handoff = createHandoff(manifest, output);
    writeFileSync(resolve(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    writeFileSync(resolve(output, 'report.md'), handoff.markdown);
    return handoff;
  }
  save(); // NOT RUN is visible even before either runner starts.
  const plans = [
    ['node', nodeReady, ['--test', '--test-reporter=./scripts/qa-node-reporter.mjs',
      '--test-reporter-destination=stdout', '--test-reporter=tap',
      `--test-reporter-destination=${resolve(output, 'node.tap')}`, ...nodeTests]],
    ['playwright', chromiumReady, ['node_modules/@playwright/test/cli.js', 'test',
      '--config=scripts/qa-pilot.playwright.config.mjs', '--reporter=json', '--workers=1']],
  ];
  const childEnv = {...env, CI: 'true'};
  // Report destination must be owned by this capture, not an inherited override.
  for (const key of ['NODE_TEST_CONTEXT', 'PLAYWRIGHT_JSON_OUTPUT_FILE',
    'PLAYWRIGHT_JSON_OUTPUT_NAME', 'PLAYWRIGHT_JSON_OUTPUT_DIR']) delete childEnv[key];
  for (const [runner, ready, args] of plans) {
    if (!ready) continue;
    const entry = {commit: sha, command: ['node', ...args].join(' '),
      exitCode: null, signal: null, report: `${runner}.json`, sha256: null};
    manifest[runner] = entry;
    save(); // A terminated capture leaves PARTIAL, never an old PASS.
    const stdout = openSync(resolve(output, entry.report), 'wx');
    const stderr = openSync(resolve(output, `${runner}.stderr.log`), 'wx');
    const started = performance.now();
    try {
      const run = execute(process.execPath, args, {cwd, env: childEnv,
        stdio: ['ignore', stdout, stderr], timeout: 300000});
      entry.exitCode = Number.isInteger(run.status) ? run.status : null;
      entry.signal = run.signal ?? null;
      entry.launchError = run.error?.code ?? null;
    } finally {
      closeSync(stdout); closeSync(stderr);
      entry.durationMs = Math.round(performance.now() - started);
      entry.sha256 = digest(readFileSync(resolve(output, entry.report)));
      save();
    }
  }
  try {
    checkout(cwd, sha);
  } catch (error) {
    // The end checkout no longer proves the tested bytes. Invalidate, don't retag.
    manifest.integrityError = error.message;
    for (const runner of ['node', 'playwright']) {
      if (manifest[runner]) manifest[runner].commit = null;
    }
    save();
    throw error;
  }
  const handoff = save();
  return {manifest, ...handoff, exitCode: exitFor(handoff.status)};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node scripts/qa-handoff-ci.mjs <fresh-output-directory>');
    const readiness = name => {
      if (!['true', 'false'].includes(process.env[name])) throw new Error(`Set ${name}=true or false`);
      return process.env[name] === 'true';
    };
    const runUrl = process.env.GITHUB_RUN_ID && process.env.GITHUB_REPOSITORY && process.env.GITHUB_SERVER_URL
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null;
    const result = collect({cwd: process.cwd(), output: process.argv[2], expectedSha: process.env.QA_EXPECTED_SHA,
      nodeReady: readiness('QA_NODE_READY'), chromiumReady: readiness('QA_CHROMIUM_READY'), runUrl});
    process.stdout.write(result.markdown);
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(`qa-handoff-ci: ${error.message}`);
    process.exitCode = 2;
  }
}
