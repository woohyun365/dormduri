import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const webSourceRoot = join(process.cwd(), 'src');
function listTypeScriptSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listTypeScriptSources(path);
    return /\.tsx?$/u.test(entry.name) ? [path] : [];
  });
}

describe('Web ownership boundary', () => {
  it('source files는 owner를 우회하는 root types import를 사용하지 않는다', () => {
    const staleImports = listTypeScriptSources(webSourceRoot).filter((path) =>
      /from\s+['"]@\/types(?:\/|['"])/u.test(readFileSync(path, 'utf8')),
    );

    expect(staleImports).toEqual([]);
  });

  it('source files는 owner를 우회하는 root utils import를 사용하지 않는다', () => {
    const staleImports = listTypeScriptSources(webSourceRoot).filter((path) =>
      /from\s+['"]@\/utils\//u.test(readFileSync(path, 'utf8')),
    );

    expect(staleImports).toEqual([]);
  });
});
