import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const profilesRoot = join(apiSourceRoot, 'profiles');

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

function apiRelativePath(path: string) {
  return relative(apiRoot, path).split(sep).join('/');
}

describe('profiles product architecture boundary', () => {
  it('keeps external production code away from profile detail internals', () => {
    const forbiddenImportOffenders = productionTypeScriptFiles(apiSourceRoot)
      .filter((path) => !path.startsWith(profilesRoot))
      .filter((path) => /from\s+['"].*profiles\/(details|targets|mappers)\//.test(readSource(path)))
      .map(apiRelativePath)
      .sort();

    expect(forbiddenImportOffenders).toEqual([]);
  });
});
