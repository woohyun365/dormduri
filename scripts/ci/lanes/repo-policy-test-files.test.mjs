import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  discoverScriptTests,
  discoverSuiteTests,
  REPO_POLICY_SCRIPT_DIRECTORIES,
  selectTestFiles,
  TEST_SUITES,
  TREE_WIDE_AGENT_TESTS,
} from './repo-policy-test-files.mjs';

test('includes dependency automation contracts in the canonical policy lane', () => {
  assert.ok(REPO_POLICY_SCRIPT_DIRECTORIES.includes('scripts/dependencies'));
});

test('every scripts directory with colocated tests is part of the policy lane discovery', () => {
  const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
  const withTests = readdirSync(resolve(repoRoot, 'scripts'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `scripts/${entry.name}`)
    .filter((directory) => discoverScriptTests(repoRoot, [directory]).length > 0);
  assert.deepEqual(
    withTests.filter((directory) => !REPO_POLICY_SCRIPT_DIRECTORIES.includes(directory)),
    [],
  );
  // Discovery walks directories only, so a test file directly under scripts/ would never run.
  assert.deepEqual(
    readdirSync(resolve(repoRoot, 'scripts')).filter((name) => name.endsWith('.test.mjs')),
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

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

test('every discovered policy test belongs to exactly one CI suite', () => {
  const all = discoverScriptTests(repoRoot);
  const suites = TEST_SUITES.map((suite) => discoverSuiteTests(repoRoot, suite));
  assert.deepEqual(TEST_SUITES, ['repo-policy', 'agent-workflow']);
  assert.ok(suites.every((files) => files.length > 0));
  assert.deepEqual(suites.flat().sort(), [...all].sort());
  assert.equal(new Set(suites.flat()).size, all.length);
});

test('the agent workflow suite is the agent test directory without the tree-wide guards', () => {
  const agent = discoverSuiteTests(repoRoot, 'agent-workflow');
  const policy = discoverSuiteTests(repoRoot, 'repo-policy');
  assert.ok(agent.every((path) => path.startsWith('scripts/ci/agents/')));
  assert.deepEqual(
    discoverScriptTests(repoRoot).filter(
      (path) => path.startsWith('scripts/ci/agents/') && !agent.includes(path),
    ),
    TREE_WIDE_AGENT_TESTS,
  );
  for (const guard of TREE_WIDE_AGENT_TESTS) assert.ok(policy.includes(guard), guard);
});

// Checked by content rather than by the constant: the agent workflow job installs no packages (the whole import closure is
// scanned), and test files that run `git ls-files` themselves stay in the repo-policy suite (product modules the tests import
// also list files, but in temporary fixture repositories). The same scan must find both in the tree-wide guards.
function scanTestClosure(paths) {
  const visited = new Set();
  const bare = [];
  const listsTree = [];
  const visit = (file, from) => {
    if (visited.has(file)) return;
    visited.add(file);
    const source = readFileSync(file, 'utf8');
    if (file === resolve(repoRoot, from) && /['"]ls-files['"]/u.test(source)) listsTree.push(from);
    const specifiers = [
      ...source.matchAll(/(?:^|\s)(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]/gmu),
      ...source.matchAll(/(?:^|\s)import\s*['"]([^'"]+)['"]/gmu),
      ...source.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/gu),
    ].map((match) => match[1]);
    for (const specifier of specifiers) {
      if (specifier.startsWith('node:')) continue;
      if (specifier.startsWith('.')) visit(resolve(dirname(file), specifier), from);
      else bare.push(`${from}: ${specifier}`);
    }
  };
  for (const path of paths) visit(resolve(repoRoot, path), path);
  return { bare, listsTree: [...new Set(listsTree)] };
}

test('agent workflow suite tests import no installed package and do not list the tracked tree', () => {
  assert.deepEqual(scanTestClosure(discoverSuiteTests(repoRoot, 'agent-workflow')), {
    bare: [],
    listsTree: [],
  });
  const guards = scanTestClosure(TREE_WIDE_AGENT_TESTS);
  assert.deepEqual(guards.listsTree, TREE_WIDE_AGENT_TESTS);
  assert.ok(guards.bare.some((entry) => entry.endsWith(': prettier')));
});

test('policy runner arguments select a suite or every test and reject anything else', () => {
  assert.deepEqual(selectTestFiles(repoRoot, []), discoverScriptTests(repoRoot));
  assert.deepEqual(
    selectTestFiles(repoRoot, ['--suite', 'agent-workflow']),
    discoverSuiteTests(repoRoot, 'agent-workflow'),
  );
  for (const argv of [
    ['--suite'],
    ['--suite', 'agents'],
    ['--all'],
    ['agent-workflow'],
    ['--suit', 'agent-workflow'],
    ['--suite', 'agent-workflow', 'repo-policy'],
  ])
    assert.throws(
      () => selectTestFiles(repoRoot, argv),
      /usage|unknown test suite/u,
      argv.join(' '),
    );
  assert.throws(() => discoverSuiteTests(repoRoot, 'unknown'), /unknown test suite/u);
});

test('an empty suite is an error rather than a passing run', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'knu-repo-policy-empty-'));
  for (const directory of REPO_POLICY_SCRIPT_DIRECTORIES)
    mkdirSync(resolve(root, directory), { recursive: true });
  writeFileSync(resolve(root, 'scripts/ci/only.test.mjs'), '');
  assert.throws(() => selectTestFiles(root, ['--suite', 'agent-workflow']), /no test files/u);
});
