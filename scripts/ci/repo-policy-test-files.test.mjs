import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { discoverScriptTests, REPO_POLICY_SCRIPT_DIRECTORIES } from './repo-policy-test-files.mjs';

test('includes dependency automation contracts in the canonical policy lane', () => {
  assert.ok(REPO_POLICY_SCRIPT_DIRECTORIES.includes('scripts/dependencies'));
});

test('every scripts directory with colocated tests is part of the policy lane discovery', () => {
  const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
  const withTests = readdirSync(resolve(repoRoot, 'scripts'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `scripts/${entry.name}`)
    .filter((directory) => discoverScriptTests(repoRoot, [directory]).length > 0);
  assert.deepEqual(
    withTests.filter((directory) => !REPO_POLICY_SCRIPT_DIRECTORIES.includes(directory)),
    [],
  );
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
