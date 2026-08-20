import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import { discoverScriptTests, REPO_POLICY_SCRIPT_DIRECTORIES } from './repo-policy-test-files.mjs';

test('includes dependency automation contracts in the canonical policy lane', () => {
  assert.ok(REPO_POLICY_SCRIPT_DIRECTORIES.includes('scripts/dependencies'));
});

test('discovers colocated tests recursively without depending on a flat directory', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'knu-repo-policy-'));
  mkdirSync(resolve(root, 'scripts/infra/check'), { recursive: true });
  mkdirSync(resolve(root, 'scripts/observability/production'), { recursive: true });
  writeFileSync(resolve(root, 'scripts/infra/root.test.mjs'), '');
  writeFileSync(resolve(root, 'scripts/infra/check/nested.test.mjs'), '');
  writeFileSync(resolve(root, 'scripts/observability/production/stack.test.mjs'), '');
  writeFileSync(resolve(root, 'scripts/infra/check/not-a-test.mjs'), '');

  assert.deepEqual(discoverScriptTests(root, ['scripts/infra', 'scripts/observability']), [
    'scripts/infra/check/nested.test.mjs',
    'scripts/infra/root.test.mjs',
    'scripts/observability/production/stack.test.mjs',
  ]);
});
