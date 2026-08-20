import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

export const REPO_POLICY_SCRIPT_DIRECTORIES = [
  'scripts/artifacts',
  'scripts/ci',
  'scripts/dependencies',
  'scripts/git',
  'scripts/infra',
  'scripts/observability',
];

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
      return [path.slice(repoRoot.length + 1)];
    });
}
