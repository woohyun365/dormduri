import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const mainPagePath = path.join(process.cwd(), 'src', 'app', 'main', 'page.tsx');

describe('main route boundary', () => {
  it.fails('/main route가 authenticated app shell Main을 소유한다', () => {
    const source = readFileSync(mainPagePath, 'utf8');

    expect(source).toMatch(/@\/main\/Main|main\/Main/);
    expect(source).toMatch(/<Main\b/);
  });
});
