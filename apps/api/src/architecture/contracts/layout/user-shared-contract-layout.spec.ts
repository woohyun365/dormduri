import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

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

function walkTypeScriptFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      return walkTypeScriptFiles(path);
    }
    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
  });
}

const repoRoot = findRepoRoot();
const sharedSrc = join(repoRoot, 'packages/shared/src');
const apiSrc = join(repoRoot, 'apps/api/src');
const apiTestRoot = join(repoRoot, 'apps/api/test');

const userSegment = 'user';
const displaySegment = 'display';
const academicSegment = 'academic';
const accountSegment = 'account';
const identitySegment = 'identity';
const contractSegment = 'contract';

function legacyUserContractName(prefix: string) {
  return `${prefix}-${identitySegment}-${contractSegment}`;
}
const sharedPackageJson = JSON.parse(
  readFileSync(join(repoRoot, 'packages/shared/package.json'), 'utf8'),
) as PackageJson;

function repoRelativePath(path: string) {
  return relative(repoRoot, path).split(sep).join('/');
}

describe('shared user contract layout', () => {
  it('user contract implementation은 user 하위 디렉토리에 둔다', () => {
    for (const relativePath of [
      'user/primitives.ts',
      'user/current-user.ts',
      'user/requests.ts',
      'user/identity/display.ts',
      'user/identity/academic.ts',
      'user/identity/account.ts',
      'user/identity/index.ts',
      'user/index.ts',
    ]) {
      expect(existsSync(join(sharedSrc, relativePath))).toBe(true);
    }
  });

  it('display identity nickname schema와 policy helper는 user identity display가 소유한다', () => {
    const displayIdentitySource = readFileSync(join(sharedSrc, 'user/identity/display.ts'), 'utf8');
    const userRequestsSource = readFileSync(join(sharedSrc, 'user/requests.ts'), 'utf8');

    for (const expected of [
      'displayIdentityNicknameSchema',
      'DISPLAY_IDENTITY_NICKNAME_MIN_LENGTH',
      'DISPLAY_IDENTITY_NICKNAME_MAX_LENGTH',
      'DISPLAY_IDENTITY_NICKNAME_REGEX',
      'normalizeDisplayIdentityNickname',
      'validateDisplayIdentityNicknameStructure',
    ]) {
      expect(displayIdentitySource).toContain(expected);
    }
    expect(userRequestsSource).toContain("from './identity/display.js'");
    expect(userRequestsSource).not.toContain('../auth/contract/primitives');
  });

  it('legacy root user/account identity source files와 public exports를 남기지 않는다', () => {
    for (const relativePath of [
      `${userSegment}-${contractSegment}.ts`,
      `${userSegment}-${contractSegment}-primitives.ts`,
      `${userSegment}-${contractSegment}-current-user.ts`,
      `${userSegment}-${contractSegment}-requests.ts`,
      `${legacyUserContractName(displaySegment)}.ts`,
      `${legacyUserContractName(academicSegment)}.ts`,
      `${legacyUserContractName(accountSegment)}.ts`,
    ]) {
      expect(existsSync(join(sharedSrc, relativePath))).toBe(false);
    }

    for (const publicPath of [
      `./${userSegment}-${contractSegment}`,
      `./${legacyUserContractName(displaySegment)}`,
      `./${legacyUserContractName(academicSegment)}`,
      `./${legacyUserContractName(accountSegment)}`,
    ]) {
      expect(sharedPackageJson.exports[publicPath]).toBeUndefined();
    }
  });

  it('package exports는 canonical user subpath와 identity primitives subpath를 제공한다', () => {
    expect(sharedPackageJson.exports['./user']).toEqual({
      types: './dist/user/index.d.ts',
      default: './dist/user/index.js',
    });
    expect(sharedPackageJson.exports['./user/primitives']).toEqual({
      types: './dist/user/primitives.d.ts',
      default: './dist/user/primitives.js',
    });
    expect(sharedPackageJson.exports['./user/current-user']).toEqual({
      types: './dist/user/current-user.d.ts',
      default: './dist/user/current-user.js',
    });
    expect(sharedPackageJson.exports['./user/requests']).toEqual({
      types: './dist/user/requests.d.ts',
      default: './dist/user/requests.js',
    });
    expect(sharedPackageJson.exports['./user/identity']).toEqual({
      types: './dist/user/identity/index.d.ts',
      default: './dist/user/identity/index.js',
    });
    expect(sharedPackageJson.exports['./user/identity/display']).toEqual({
      types: './dist/user/identity/display.d.ts',
      default: './dist/user/identity/display.js',
    });
    expect(sharedPackageJson.exports['./user/identity/academic']).toEqual({
      types: './dist/user/identity/academic.d.ts',
      default: './dist/user/identity/academic.js',
    });
    expect(sharedPackageJson.exports['./user/identity/account']).toEqual({
      types: './dist/user/identity/account.d.ts',
      default: './dist/user/identity/account.js',
    });
    expect(sharedPackageJson.exports['./identity-contract']).toBeUndefined();
    expect(sharedPackageJson.exports['./identity/primitives']).toEqual({
      types: './dist/identity/primitives.d.ts',
      default: './dist/identity/primitives.js',
    });
  });

  it('repo TypeScript source는 legacy root user/account identity contract imports를 사용하지 않는다', () => {
    const legacyPublicSpecifiers = [
      `@repo/shared/${userSegment}-${contractSegment}`,
      `@repo/shared/${legacyUserContractName(displaySegment)}`,
      `@repo/shared/${legacyUserContractName(academicSegment)}`,
      `@repo/shared/${legacyUserContractName(accountSegment)}`,
    ];
    const legacyRelativeFragments = [
      `${userSegment}-${contractSegment}`,
      legacyUserContractName(displaySegment),
      legacyUserContractName(academicSegment),
      legacyUserContractName(accountSegment),
    ];
    const ignoredSelf =
      'apps/api/src/architecture/contracts/layout/user-shared-contract-layout.spec.ts';

    const offenders = [sharedSrc, apiSrc, apiTestRoot]
      .flatMap(walkTypeScriptFiles)
      .filter((path) => repoRelativePath(path) !== ignoredSelf)
      .filter((path) => {
        const source = readFileSync(path, 'utf8');
        return [...legacyPublicSpecifiers, ...legacyRelativeFragments].some((specifier) =>
          source.includes(specifier),
        );
      })
      .map(repoRelativePath)
      .sort();

    expect(offenders).toEqual([]);
  });
});
