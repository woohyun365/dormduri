import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readAppSource = (relativePath: string) =>
  readFileSync(path.join(process.cwd(), 'src', 'app', relativePath), 'utf8');

describe('main route boundary', () => {
  it('/main route가 authenticated app shell owner를 렌더링한다', () => {
    const pageSource = readAppSource('main/page.tsx');

    expect(pageSource).toMatch(/\.\/MainRouteShell\.client/);
    expect(pageSource).toMatch(/<MainRouteShell\s*\/?/);
  });

  it('/main client shell이 Main ownership과 session fallback을 소유한다', () => {
    const shellSource = readAppSource('main/MainRouteShell.client.tsx');

    expect(shellSource).toMatch(/@\/main\/Main|main\/Main/);
    expect(shellSource).toMatch(/<Main\b/);
    expect(shellSource).toMatch(/@\/auth\/hooks|auth\/hooks/);
    expect(shellSource).toMatch(/router\.replace\(['"]\/login['"]\)/);
  });
});
