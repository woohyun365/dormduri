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

describe('shared auth contract layout', () => {
  it('auth contract implementation은 auth 하위 디렉토리에 둔다', () => {
    for (const relativePath of [
      'auth/contract/primitives.ts',
      'auth/contract/requests.ts',
      'auth/contract/index.ts',
      'auth/policy/constants.ts',
      'auth/policy/helpers.ts',
      'auth/policy/index.ts',
      'auth/response/base.ts',
      'auth/response/auth.ts',
      'auth/response/signup-validation.ts',
      'auth/response/index.ts',
      'auth/session/contract.ts',
      'auth/session/index.ts',
      'auth/index.ts',
    ]) {
      expect(existsSync(join(sharedSrc, relativePath))).toBe(true);
    }
  });

  it('legacy root auth source/export 없이 canonical auth package exports만 제공한다', () => {
    for (const relativePath of [
      'auth-contract-primitives.ts',
      'auth-contract-requests.ts',
      'auth-contract.ts',
      'auth-policy-constants.ts',
      'auth-policy-helpers.ts',
      'auth-policy.ts',
      'auth-response-base.ts',
      'auth-response-auth.ts',
      'auth-response-signup-validation.ts',
      'auth-response.ts',
      'session-contract.ts',
      'compat/auth-contract.ts',
      'compat/auth-policy.ts',
      'compat/auth-response.ts',
      'compat/session-contract.ts',
    ]) {
      expect(existsSync(join(sharedSrc, relativePath))).toBe(false);
    }

    for (const publicPath of [
      './auth-contract',
      './auth-policy',
      './auth-response',
      './session-contract',
    ]) {
      expect(sharedPackageJson.exports[publicPath]).toBeUndefined();
    }
  });

  it('granular auth package exports는 contract/policy/response/session axis를 제공한다', () => {
    expect(sharedPackageJson.exports['./auth']).toEqual({
      types: './dist/auth/index.d.ts',
      default: './dist/auth/index.js',
    });
    expect(sharedPackageJson.exports['./auth/contract']).toEqual({
      types: './dist/auth/contract/index.d.ts',
      default: './dist/auth/contract/index.js',
    });
    expect(sharedPackageJson.exports['./auth/policy']).toEqual({
      types: './dist/auth/policy/index.d.ts',
      default: './dist/auth/policy/index.js',
    });
    expect(sharedPackageJson.exports['./auth/response']).toEqual({
      types: './dist/auth/response/index.d.ts',
      default: './dist/auth/response/index.js',
    });
    expect(sharedPackageJson.exports['./auth/session']).toEqual({
      types: './dist/auth/session/index.d.ts',
      default: './dist/auth/session/index.js',
    });
  });
});
