import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const homeRoot = join(process.cwd(), 'src/main/tabs/home');
const FORBIDDEN_RUNTIME_PATTERNS = [
  '@/__fixtures__',
  'src/__fixtures__',
  'main/test-support',
  '__stories__',
  '.stories',
] as const;

function listRuntimeSourceFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const absolutePath = join(root, entry);

    if (statSync(absolutePath).isDirectory()) {
      if (entry === '__tests__' || entry === '__stories__') return [];
      return listRuntimeSourceFiles(absolutePath);
    }

    return /\.(ts|tsx)$/.test(entry) && !entry.endsWith('.test.ts') && !entry.endsWith('.test.tsx')
      ? [absolutePath]
      : [];
  });
}

describe('Home runtime boundary', () => {
  it('production Home source does not import global fixtures, test support, or stories', () => {
    const violations = listRuntimeSourceFiles(homeRoot).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return FORBIDDEN_RUNTIME_PATTERNS.filter((pattern) => source.includes(pattern)).map(
        (pattern) => `${file}: ${pattern}`,
      );
    });

    expect(violations).toEqual([]);
  });
});
