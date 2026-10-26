import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '../../..');
const docsRoot = resolve(repoRoot, 'docs');
const landingPolicyCopyPath = resolve(
  repoRoot,
  'apps/web/src/screens/landing/model/landingPolicyCopy.ts',
);

const requiredDocDirectories = [
  'architecture',
  'development',
  'policies',
  'references',
  'runbooks',
];
const retiredDocPaths = [
  '00_archive',
  '01_codex-review',
  '02_review-decisions',
  '03_planning',
  '04_policy',
  '05_acceptance',
  '06_trouble-shooting',
  '07_tech',
  '98_analyze',
  '99_portfolio',
].map((directory) => `docs/${directory}`);
const scannedRoots = ['apps/api/src', 'apps/api/test', 'apps/web/src', 'docs', 'infra', 'packages'];
const scannedRootFiles = [
  '.github/PULL_REQUEST_TEMPLATE.md',
  'README.md',
  'SERVICE.md',
  'apps/api/README.md',
  'apps/web/README.md',
];
const textExtensions = new Set([
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.mts',
  '.sh',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);

function collectTextFiles(root) {
  if (!existsSync(root)) return [];

  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) {
      if (['.next', 'coverage', 'dist', 'node_modules'].includes(entry.name)) return [];
      return collectTextFiles(path);
    }
    return entry.isFile() && textExtensions.has(extname(entry.name)) ? [path] : [];
  });
}

test('tracked documentation uses semantic source-of-truth directories', () => {
  const missingDirectories = requiredDocDirectories.filter(
    (directory) => !existsSync(resolve(docsRoot, directory)),
  );
  const remainingRetiredDirectories = retiredDocPaths.filter((path) =>
    existsSync(resolve(repoRoot, path)),
  );
  const gitignore = readFileSync(resolve(repoRoot, '.gitignore'), 'utf8');

  assert.deepEqual(missingDirectories, []);
  assert.deepEqual(remainingRetiredDirectories, []);
  assert.match(gitignore, /^\.local-docs\/$/mu);
  assert.doesNotMatch(gitignore, /^docs\/\*$/mu);
});

test('tracked source does not reference retired documentation paths', () => {
  const files = [
    ...scannedRoots.flatMap((root) => collectTextFiles(resolve(repoRoot, root))),
    ...scannedRootFiles.map((path) => resolve(repoRoot, path)).filter(existsSync),
  ];
  const staleReferences = files.flatMap((path) => {
    const source = readFileSync(path, 'utf8');
    return retiredDocPaths
      .filter((retiredPath) => source.includes(retiredPath))
      .map((retiredPath) => `${relative(repoRoot, path)} -> ${retiredPath}`);
  });

  assert.deepEqual(staleReferences, []);
});

test('landing policy copy references tracked policy sources', () => {
  const source = readFileSync(landingPolicyCopyPath, 'utf8');
  const policyPaths = [...source.matchAll(/path:\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);

  assert.ok(policyPaths.length > 0, 'landing policy copy must declare policy source paths');

  for (const policyPath of policyPaths) {
    assert.match(policyPath, /^docs\/policies\/.+\.md$/);
    assert.equal(existsSync(resolve(repoRoot, policyPath)), true, `${policyPath} must exist`);
  }
});
