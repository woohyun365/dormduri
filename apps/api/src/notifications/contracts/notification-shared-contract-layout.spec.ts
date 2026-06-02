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

describe('shared notification contract layout', () => {
  it('notification contract implementation은 notifications 하위 디렉토리에 둔다', () => {
    for (const relativePath of ['notifications/contract.ts', 'notifications/index.ts']) {
      expect(existsSync(join(sharedSrc, relativePath))).toBe(true);
    }
  });

  it('legacy root notification source file 없이 package exports가 기존 public path를 nested dist로 매핑한다', () => {
    expect(existsSync(join(sharedSrc, 'notification-contract.ts'))).toBe(false);
    expect(sharedPackageJson.exports['./notification-contract']).toEqual({
      types: './dist/notifications/contract.d.ts',
      default: './dist/notifications/contract.js',
    });
  });
});
