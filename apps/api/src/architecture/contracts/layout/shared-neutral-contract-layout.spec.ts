import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

type PackageJson = {
  exports: Record<string, { types: string; default: string } | undefined>;
};

function findRepoRoot() {
  let current = process.cwd();

  while (!existsSync(join(current, 'packages/shared/src'))) {
    const parent = dirname(current);
    if (parent === current) {
      throw new Error('repo root with packages/shared/src not found');
    }
    current = parent;
  }

  return current;
}

const repoRoot = findRepoRoot();
const sharedSrc = join(repoRoot, 'packages/shared/src');
const sharedPackageJson = JSON.parse(
  readFileSync(join(repoRoot, 'packages/shared/package.json'), 'utf8'),
) as PackageJson;

const nestedNeutralFiles = [
  'campus/index.ts',
  'campus/metadata.ts',
  'college/index.ts',
  'college/schema.ts',
  'college/catalog.ts',
  'college/lookups.ts',
  'identity/index.ts',
  'identity/primitives.ts',
  'date/index.ts',
  'date/primitives.ts',
  'lifestyle/index.ts',
  'lifestyle/schema.ts',
  'lifestyle/options.ts',
] as const;

const removedRootNeutralFiles = [
  'campus-contract.ts',
  'college-contract.ts',
  'college-contract-schema.ts',
  'college-contract-catalog.ts',
  'college-contract-lookups.ts',
  'identity-contract.ts',
  'date-primitives.ts',
  'lifestyle.ts',
  'lifestyle-schema.ts',
  'lifestyle-options.ts',
] as const;

describe('shared neutral contract layout', () => {
  it('keeps neutral shared source owners under nested directories', () => {
    for (const relativePath of nestedNeutralFiles) {
      expect(existsSync(join(sharedSrc, relativePath))).toBe(true);
    }

    for (const relativePath of removedRootNeutralFiles) {
      expect(existsSync(join(sharedSrc, relativePath))).toBe(false);
    }
  });

  it('keeps identity-contract primitives under identity/primitives owner', () => {
    const source = readFileSync(join(sharedSrc, 'identity/primitives.ts'), 'utf8');

    expect(source).toContain("export const genderSchema = z.enum(['M', 'F']);");
    expect(source).toContain(
      "export const campusSchema = z.enum(['CHUNCHEON', 'SAMCHEOK', 'DOGYE']);",
    );
  });

  it('provides canonical package exports for neutral shared owners only', () => {
    expect(sharedPackageJson.exports['./campus']).toEqual({
      types: './dist/campus/index.d.ts',
      default: './dist/campus/index.js',
    });
    expect(sharedPackageJson.exports['./college']).toEqual({
      types: './dist/college/index.d.ts',
      default: './dist/college/index.js',
    });
    expect(sharedPackageJson.exports['./date']).toEqual({
      types: './dist/date/index.d.ts',
      default: './dist/date/index.js',
    });
    expect(sharedPackageJson.exports['./identity']).toEqual({
      types: './dist/identity/index.d.ts',
      default: './dist/identity/index.js',
    });
    expect(sharedPackageJson.exports['./identity/primitives']).toEqual({
      types: './dist/identity/primitives.d.ts',
      default: './dist/identity/primitives.js',
    });
    expect(sharedPackageJson.exports['./lifestyle']).toEqual({
      types: './dist/lifestyle/index.d.ts',
      default: './dist/lifestyle/index.js',
    });

    for (const publicPath of [
      './campus-contract',
      './college-contract',
      './date-primitives',
      './identity-contract',
    ]) {
      expect(sharedPackageJson.exports[publicPath]).toBeUndefined();
    }
  });
});
