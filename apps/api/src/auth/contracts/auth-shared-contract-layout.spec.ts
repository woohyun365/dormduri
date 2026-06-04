import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

type PackageJson = {
  exports: Record<string, { types: string; default: string }>;
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
      'compat/auth-contract.ts',
      'compat/auth-policy.ts',
      'compat/auth-response.ts',
      'compat/session-contract.ts',
    ]) {
      expect(existsSync(join(sharedSrc, relativePath))).toBe(true);
    }
  });

  it('legacy root auth source files 없이 package exports가 기존 public path를 compat dist로 매핑한다', () => {
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
    ]) {
      expect(existsSync(join(sharedSrc, relativePath))).toBe(false);
    }

    expect(sharedPackageJson.exports['./auth-contract']).toEqual({
      types: './dist/compat/auth-contract.d.ts',
      default: './dist/compat/auth-contract.js',
    });
    expect(sharedPackageJson.exports['./auth-policy']).toEqual({
      types: './dist/compat/auth-policy.d.ts',
      default: './dist/compat/auth-policy.js',
    });
    expect(sharedPackageJson.exports['./auth-response']).toEqual({
      types: './dist/compat/auth-response.d.ts',
      default: './dist/compat/auth-response.js',
    });
    expect(sharedPackageJson.exports['./session-contract']).toEqual({
      types: './dist/compat/session-contract.d.ts',
      default: './dist/compat/session-contract.js',
    });
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
