import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const webSourceRoot = join(process.cwd(), 'src');
const legacyTypesRoot = join(webSourceRoot, 'types');

function listTypeScriptSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listTypeScriptSources(path);
    return /\.tsx?$/u.test(entry.name) ? [path] : [];
  });
}

describe('Web type ownership boundary', () => {
  it('root compatibility types directory를 다시 만들지 않는다', () => {
    expect(existsSync(legacyTypesRoot)).toBe(false);
  });

  it('source files는 root types compatibility import를 사용하지 않는다', () => {
    const staleImports = listTypeScriptSources(webSourceRoot).filter((path) =>
      /from\s+['"]@\/types(?:\/|['"])/u.test(readFileSync(path, 'utf8')),
    );

    expect(staleImports).toEqual([]);
  });

  it('Web 전용 타입은 Main과 social-safety owner model에 둔다', () => {
    expect(existsSync(join(webSourceRoot, 'main/model/navigation.ts'))).toBe(true);
    expect(existsSync(join(webSourceRoot, 'main/model/profile.ts'))).toBe(true);
    expect(existsSync(join(webSourceRoot, 'social-safety/model/socialSafety.types.ts'))).toBe(true);
  });
});
