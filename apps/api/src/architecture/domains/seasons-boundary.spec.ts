import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const seasonsRoot = join(apiSourceRoot, 'seasons');

function walkTypeScriptFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      return walkTypeScriptFiles(path);
    }
    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
  });
}

function productionTypeScriptFiles(root: string): string[] {
  return walkTypeScriptFiles(root).filter((path) => !path.endsWith('.spec.ts'));
}

function readSource(path: string) {
  return readFileSync(path, 'utf8');
}

function relativeSourcePath(path: string) {
  return relative(apiRoot, path);
}

describe('seasons product architecture boundary', () => {
  it('keeps admin mutation operations independent from request cache state', () => {
    const cacheImport = /from\s+['"](?:[^'"]*seasons\/cache\/|\.\.\/cache\/)[^'"]+['"]/;
    const operationCacheOffenders = productionTypeScriptFiles(join(seasonsRoot, 'operations'))
      .filter((path) => cacheImport.test(readSource(path)))
      .map(relativeSourcePath)
      .sort();

    expect(operationCacheOffenders).toEqual([]);
  });
});
