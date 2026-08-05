import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiRoot = process.cwd();
const repoRoot = join(apiRoot, '../..');
const docsRoot = join(repoRoot, 'docs');
const gitignorePath = join(repoRoot, '.gitignore');

const requiredDocDirectories = [
  'architecture',
  'archive',
  'development',
  'policies',
  'references',
  'runbooks',
];

const forbiddenLegacyDocPaths = [
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

function collectTextFiles(root: string): string[] {
  if (!existsSync(root)) return [];

  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      if (['.next', 'coverage', 'dist', 'node_modules'].includes(entry.name)) return [];
      return collectTextFiles(path);
    }
    return entry.isFile() && textExtensions.has(extname(entry.name)) ? [path] : [];
  });
}

function legacyReferences(): string[] {
  const files = [
    ...scannedRoots.flatMap((root) => collectTextFiles(join(repoRoot, root))),
    ...scannedRootFiles.map((path) => join(repoRoot, path)).filter(existsSync),
  ];

  return files.flatMap((path) => {
    const source = readFileSync(path, 'utf8');
    return forbiddenLegacyDocPaths
      .filter((legacyPath) => source.includes(legacyPath))
      .map((legacyPath) => `${relative(repoRoot, path)} -> ${legacyPath}`);
  });
}

describe('documentation source-of-truth boundary', () => {
  it('keeps canonical documentation in semantic tracked directories', () => {
    const missing = requiredDocDirectories.filter(
      (directory) => !existsSync(join(docsRoot, directory)),
    );
    const remainingLegacyDirectories = forbiddenLegacyDocPaths.filter((path) =>
      existsSync(join(repoRoot, path)),
    );

    expect(missing).toEqual([]);
    expect(remainingLegacyDirectories).toEqual([]);
  });

  it('tracks docs by default and isolates local documents', () => {
    const gitignore = readFileSync(gitignorePath, 'utf8');

    expect(gitignore).toContain('local-docs/');
    expect(gitignore).not.toMatch(/^docs\/\*$/mu);
  });

  it('does not reference retired numbered documentation paths', () => {
    expect(legacyReferences()).toEqual([]);
  });
});
