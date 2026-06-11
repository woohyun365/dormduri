import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const apiRoot = process.cwd();
const apiContractRoot = join(apiRoot, 'src/architecture/api-contracts');

function specFiles(root: string) {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.spec.ts'))
    .map((entry) => entry.name)
    .sort();
}

function repoRelative(path: string) {
  return relative(apiRoot, path).split(sep).join('/');
}

describe('api contract spec boundary', () => {
  it('keeps shared reference contracts split by responsibility', () => {
    expect(specFiles(apiContractRoot)).toEqual([
      'additional-profile-contract.spec.ts',
      'api-contract-spec-boundary.spec.ts',
      'college-contract.spec.ts',
      'date-reference-contracts.spec.ts',
      'identity-reference-contracts.spec.ts',
      'lifestyle-reference-contracts.spec.ts',
      'shared-reference-contracts.spec.ts',
      'user-reference-contracts.spec.ts',
    ]);
  });

  it('keeps broad shared-reference spec limited to excluded profile/matching owners', () => {
    const sharedReferencePath = join(apiContractRoot, 'shared-reference-contracts.spec.ts');
    const source = readFileSync(sharedReferencePath, 'utf8');

    for (const forbiddenSpecifier of [
      '@repo/shared/user',
      '@repo/shared/user/identity/display',
      '@repo/shared/user/identity/academic',
      '@repo/shared/user/identity/account',
      '@repo/shared/lifestyle',
      '@repo/shared/date',
      '@repo/shared/campus',
      '@repo/shared/identity/primitives',
    ]) {
      expect(source).not.toContain(forbiddenSpecifier);
    }

    for (const allowedSpecifier of [
      '@repo/shared/profile-contract',
      '@repo/shared/roommate-search-contract',
      '@repo/shared/match/contract',
    ]) {
      expect(source).toContain(allowedSpecifier);
    }
  });

  it('keeps responsibility owner specs present for included shared contracts', () => {
    for (const relativePath of [
      'user-reference-contracts.spec.ts',
      'lifestyle-reference-contracts.spec.ts',
      'date-reference-contracts.spec.ts',
      'identity-reference-contracts.spec.ts',
      'college-contract.spec.ts',
      'additional-profile-contract.spec.ts',
    ]) {
      expect(existsSync(join(apiContractRoot, relativePath))).toBe(true);
    }
  });

  it('does not introduce plan-dependent filenames under api-contracts', () => {
    const offenders = specFiles(apiContractRoot)
      .filter((file) => /phase|plan|temporary|legacy|compat/i.test(file))
      .map((file) => repoRelative(join(apiContractRoot, file)));

    expect(offenders).toEqual([]);
  });
});
