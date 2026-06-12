import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const apiRoot = process.cwd();
const repoRoot = join(apiRoot, '..', '..');
const sharedSourceRoot = join(repoRoot, 'packages/shared/src');
const retentionSharedRoot = join(sharedSourceRoot, 'retention');

function walkFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(path);
    }
    return entry.isFile() ? [path] : [];
  });
}

function repoRelativePath(path: string) {
  return relative(repoRoot, path).split(sep).join('/');
}

function readSource(path: string) {
  return readFileSync(path, 'utf8');
}

describe('retention shared contract layout', () => {
  it('keeps retention contract off root flat and compat re-export paths', () => {
    const forbiddenPaths = [
      join(sharedSourceRoot, 'retention-contract.ts'),
      join(sharedSourceRoot, 'compat/retention-contract.ts'),
    ];
    const offenders = forbiddenPaths.filter((path) => existsSync(path)).map(repoRelativePath);

    expect(offenders).toEqual([]);
  });

  it('allows shared retention contracts only as nested responsibility files when introduced', () => {
    if (!existsSync(retentionSharedRoot)) {
      expect(existsSync(retentionSharedRoot)).toBe(false);
      return;
    }

    const retentionFiles = walkFiles(retentionSharedRoot)
      .filter((path) => path.endsWith('.ts'))
      .map(repoRelativePath)
      .sort();
    const forbiddenCompatExports = walkFiles(retentionSharedRoot)
      .filter((path) => path.endsWith('.ts'))
      .filter((path) => /compat|retention-contract/.test(readSource(path)))
      .map(repoRelativePath)
      .sort();

    expect(retentionFiles.every((path) => path.startsWith('packages/shared/src/retention/'))).toBe(
      true,
    );
    expect(forbiddenCompatExports).toEqual([]);
  });
});
