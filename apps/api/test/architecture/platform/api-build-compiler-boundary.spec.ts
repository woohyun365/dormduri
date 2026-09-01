import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiRoot = process.cwd();

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

describe('API build compiler boundary', () => {
  it('uses SWC for emit while retaining explicit TypeScript typecheck capabilities', () => {
    const nestConfig = readJson<{
      compilerOptions: {
        builder: {
          type: string;
          options: {
            extensions: string[];
            ignore: string[];
            stripLeadingPaths: boolean;
          };
        };
      };
    }>(join(apiRoot, 'nest-cli.json'));
    const swcConfig = readJson<{ module: { type: string }; jsc: { target: string } }>(
      join(apiRoot, '.swcrc'),
    );
    const apiPackage = readJson<{
      devDependencies: Record<string, string>;
      scripts: Record<string, string>;
    }>(join(apiRoot, 'package.json'));

    expect(nestConfig.compilerOptions.builder).toEqual({
      type: 'swc',
      options: {
        extensions: ['.ts'],
        ignore: ['**/*.spec.ts', '**/*.e2e-spec.ts', '**/*.spec-fixtures.ts', '**/test-support/**'],
        stripLeadingPaths: true,
      },
    });
    expect(swcConfig).toMatchObject({ module: { type: 'es6' }, jsc: { target: 'es2022' } });
    expect(apiPackage.devDependencies['@swc/cli']).toBeDefined();
    expect(apiPackage.devDependencies['ts-loader']).toBeUndefined();
    expect(apiPackage.devDependencies['tsconfig-paths']).toBeUndefined();
    expect(apiPackage.devDependencies['@eslint/eslintrc']).toBeUndefined();
    expect(apiPackage.devDependencies['eslint-plugin-prettier']).toBeUndefined();
    expect(apiPackage.scripts['ci:build']).toBe('nest build');
    expect(apiPackage.scripts['ci:typecheck']).toContain('ci:typecheck:product');
    expect(apiPackage.scripts['ci:typecheck']).toContain('ci:typecheck:test');
  });
});
