import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();
const webSourceRoot = resolve(repoRoot, 'apps/web/src');
const testFilePattern = /\.(?:test|spec)\.(?:ts|tsx)$/u;
const domTypeScriptPattern = /\.dom\.(?:test|spec)\.ts$/u;

function discoverTestFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return discoverTestFiles(path);
    return testFilePattern.test(entry.name) ? [relative(repoRoot, path).replaceAll('\\', '/')] : [];
  });
}

function projectFor(path) {
  if (path.endsWith('.tsx') || domTypeScriptPattern.test(path)) return 'jsdom';
  return 'node';
}

test('assigns every Web unit test to exactly one explicit Vitest environment', () => {
  const files = discoverTestFiles(webSourceRoot).sort();
  const assignments = files.map((path) => ({ path, project: projectFor(path) }));

  assert.equal(files.length, 222);
  assert.equal(assignments.filter(({ project }) => project === 'node').length, 113);
  assert.equal(assignments.filter(({ project }) => project === 'jsdom').length, 109);
  assert.equal(new Set(assignments.map(({ path }) => path)).size, files.length);
});

test('keeps Testing Library imports out of the Node project', () => {
  const nodeFiles = discoverTestFiles(webSourceRoot).filter((path) => projectFor(path) === 'node');
  const violations = nodeFiles.filter((path) =>
    /(?:from\s+|import\s+)['"]@testing-library\/(?:react|user-event)/u.test(
      readFileSync(resolve(repoRoot, path), 'utf8'),
    ),
  );

  assert.deepEqual(violations, []);
});

test('configures DOM setup only for the jsdom project', () => {
  const config = readFileSync(resolve(repoRoot, 'apps/web/vitest.config.ts'), 'utf8');

  assert.match(config, /pool: 'threads'/u);
  assert.match(config, /name: 'node'[\s\S]*environment: 'node'[\s\S]*setupFiles: \[\]/u);
  assert.match(
    config,
    /name: 'jsdom'[\s\S]*environment: 'jsdom'[\s\S]*setupFiles: \['\.\/src\/test-setup\.ts'\]/u,
  );
  assert.match(config, /src\/\*\*\/\*\.dom\.test\.ts/u);
});
