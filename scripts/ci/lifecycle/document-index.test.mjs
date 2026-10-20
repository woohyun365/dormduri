// Document indexes the lifecycle state reads: every policy document has a row in the policy README table, every
// architecture document is linked from the architecture README, and every product document from the product README.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));

function documents(directory, extensions) {
  const root = resolve(repoRoot, directory);
  if (!existsSync(root)) return [];
  const walk = (path) =>
    readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? walk(resolve(path, entry.name))
        : extensions.some((extension) => entry.name.endsWith(extension)) &&
            entry.name !== 'README.md'
          ? [relative(root, resolve(path, entry.name))]
          : [],
    );
  return walk(root).sort();
}

const readme = (directory) => readFileSync(resolve(repoRoot, directory, 'README.md'), 'utf8');

function missingFromIndex(directory, extensions) {
  const linked = new Set(
    [...readme(directory).matchAll(/\]\(\.\/([^)#\s]+)(?:#[^)]*)?\)/gu)].map((match) => match[1]),
  );
  return documents(directory, extensions).filter((path) => !linked.has(path));
}

test('every policy document has a row in the policy README table', () => {
  const rows = readme('docs/policies').split('\n');
  const missing = documents('docs/policies', ['.md']).filter(
    (path) => !rows.some((line) => line.startsWith(`| [${path}](./${path})`)),
  );
  assert.deepEqual(missing, [], `정책 README 색인 누락: ${missing.join(', ')}`);
});

test('every architecture document is linked from the architecture README', () => {
  const missing = missingFromIndex('docs/architecture', ['.md']);
  assert.deepEqual(missing, [], `architecture README 색인 누락: ${missing.join(', ')}`);
});

test('every product document is linked from the product README', () => {
  const missing = existsSync(resolve(repoRoot, 'docs/product/README.md'))
    ? missingFromIndex('docs/product', ['.md', '.json'])
    : documents('docs/product', ['.md', '.json']);
  assert.deepEqual(missing, [], `제품 문서 README 색인 누락: ${missing.join(', ')}`);
});
