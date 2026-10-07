import { readdirSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

export const REPO_POLICY_SCRIPT_DIRECTORIES = [
  'scripts/artifacts',
  'scripts/ci',
  'scripts/dependencies',
  'scripts/git',
  'scripts/github',
  'scripts/infra',
  'scripts/observability',
  'scripts/security',
];

// CI runs the policy tests as two suites. The agent workflow suite needs no installed packages, so its job skips
// `pnpm install`. Agent tests that read every tracked path stay in the repo-policy suite: the guard imports prettier and
// keeps guarding the tree wherever the repo-policy job runs.
export const TEST_SUITES = ['repo-policy', 'agent-workflow'];
const AGENT_WORKFLOW_TEST_DIRECTORY = 'scripts/ci/agents/';
export const TREE_WIDE_AGENT_TESTS = ['scripts/ci/agents/common/agent-guidance-boundary.test.mjs'];

export function testSuite(path) {
  return path.startsWith(AGENT_WORKFLOW_TEST_DIRECTORY) && !TREE_WIDE_AGENT_TESTS.includes(path)
    ? 'agent-workflow'
    : 'repo-policy';
}

export function discoverSuiteTests(repoRoot, suite) {
  if (!TEST_SUITES.includes(suite)) throw new TypeError(`unknown test suite ${suite}`);
  return discoverScriptTests(repoRoot).filter((path) => testSuite(path) === suite);
}

// No arguments runs every policy test (local `pnpm test:repo-policy`); `--suite <name>` runs one CI suite.
export function selectTestFiles(repoRoot, argv) {
  if (argv.length === 0) return discoverScriptTests(repoRoot);
  if (argv.length !== 2 || argv[0] !== '--suite')
    throw new TypeError(`usage: run-repo-policy.mjs [--suite ${TEST_SUITES.join('|')}]`);
  const files = discoverSuiteTests(repoRoot, argv[1]);
  if (files.length === 0) throw new TypeError(`suite ${argv[1]} has no test files`);
  return files;
}

export function discoverScriptTests(repoRoot, directories = REPO_POLICY_SCRIPT_DIRECTORIES) {
  return directories.flatMap((directory) => discoverTests(resolve(repoRoot, directory), repoRoot));
}

function discoverTests(directory, repoRoot) {
  return readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return discoverTests(path, repoRoot);
      if (!entry.isFile() || !entry.name.endsWith('.test.mjs')) return [];
      return [relative(repoRoot, path).split(sep).join('/')];
    });
}
