import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const scriptPath = join(process.cwd(), 'scripts/ci/run-timed-command.mjs');

function runTimedCommand(summaryPath, stage, commandSource) {
  return spawnSync(
    process.execPath,
    [scriptPath, '--scope=Test', `--stage=${stage}`, '--', process.execPath, '-e', commandSource],
    {
      env: { ...process.env, GITHUB_STEP_SUMMARY: summaryPath },
      encoding: 'utf8',
    },
  );
}

test('appends one timing table and preserves successful command output', () => {
  const directory = mkdtempSync(join(tmpdir(), 'knu-ci-timing-'));
  const summaryPath = join(directory, 'summary.md');

  const first = runTimedCommand(summaryPath, 'install', "console.log('installed')");
  const second = runTimedCommand(summaryPath, 'unit', "console.log('tested')");
  const summary = readFileSync(summaryPath, 'utf8');

  assert.equal(first.status, 0);
  assert.equal(second.status, 0);
  assert.match(first.stdout, /installed/u);
  assert.equal(summary.split('### Test CI stage timing').length - 1, 1);
  assert.match(summary, /\| install \| [\d.]+ \| success \|/u);
  assert.match(summary, /\| unit \| [\d.]+ \| success \|/u);
});

test('returns the wrapped command failure and records it in the summary', () => {
  const directory = mkdtempSync(join(tmpdir(), 'knu-ci-timing-'));
  const summaryPath = join(directory, 'summary.md');
  const result = runTimedCommand(summaryPath, 'integration', 'process.exit(7)');
  const summary = readFileSync(summaryPath, 'utf8');

  assert.equal(result.status, 7);
  assert.match(summary, /\| integration \| [\d.]+ \| failure \|/u);
});
