import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The second route on the new screen layer (fe.comp.route-entry-import-guard): like `/`, the not-found
// route imports only the public entry of its feature and renders that screen.
const source = readFileSync(path.join(process.cwd(), 'src', 'app', 'not-found.tsx'), 'utf8');

describe('not-found route boundary', () => {
  it('imports only the public entry of the not-found screen layer', () => {
    const screenImports = [...source.matchAll(/from\s+['"](@\/screens\/[^'"]*)['"]/g)].map(
      ([, specifier]) => specifier,
    );

    expect(screenImports).toEqual(['@/screens/not-found']);
    expect(source).toMatch(/<NotFoundScreen\s*\/?>/);
  });

  it('is not a client component, so the screen stays server-rendered', () => {
    expect(source).not.toMatch(/['"]use client['"]/);
  });
});
