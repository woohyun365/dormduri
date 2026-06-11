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

const repoRoot = findRepoRoot();
const sharedSrc = join(repoRoot, 'packages/shared/src');
const apiSrc = join(repoRoot, 'apps/api/src');
const removedSeasonContractSpecifier = '@repo/shared/' + 'season-contract';
const ignoredSourceOfTruthSpecs = new Set([
  'architecture/contracts/layout/season-shared-contract-layout.spec.ts',
  'architecture/contracts/layout/shared-contract-source-of-truth-layout.spec.ts',
]);
const sharedPackageJson = JSON.parse(
  readFileSync(join(repoRoot, 'packages/shared/package.json'), 'utf8'),
) as PackageJson;

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

function sourceRelativePath(path: string) {
  return relative(apiSrc, path).split(sep).join('/');
}

describe('shared season contract layout', () => {
  it('season contract implementation은 runtime/operations/participation axis가 소유한다', () => {
    for (const relativePath of [
      'season/runtime/primitives.ts',
      'season/runtime/response.ts',
      'season/runtime/index.ts',
      'season/operations/index.ts',
      'season/participation/index.ts',
      'season/participation/dormitory-selection.ts',
      'season/participation/profile-draft.ts',
      'season/participation/registration.ts',
      'season/participation/state.ts',
      'season/index.ts',
    ]) {
      expect(existsSync(join(sharedSrc, relativePath))).toBe(true);
    }
  });

  it('legacy root/compat season files 없이 canonical season owner만 유지한다', () => {
    for (const relativePath of [
      'season-contract.ts',
      'season-contract-primitives.ts',
      'season-contract-response.ts',
      'season/primitives.ts',
      'season/response.ts',
      'season/operations.ts',
      'compat/season-contract.ts',
    ]) {
      expect(existsSync(join(sharedSrc, relativePath))).toBe(false);
    }
  });

  it('package exports는 canonical granular season axis만 제공한다', () => {
    expect(sharedPackageJson.exports['./season-contract']).toBeUndefined();
    expect(sharedPackageJson.exports['./season']).toEqual({
      types: './dist/season/index.d.ts',
      default: './dist/season/index.js',
    });
    expect(sharedPackageJson.exports['./season/runtime']).toEqual({
      types: './dist/season/runtime/index.d.ts',
      default: './dist/season/runtime/index.js',
    });
    expect(sharedPackageJson.exports['./season/primitives']).toEqual({
      types: './dist/season/runtime/primitives.d.ts',
      default: './dist/season/runtime/primitives.js',
    });
    expect(sharedPackageJson.exports['./season/response']).toEqual({
      types: './dist/season/runtime/response.d.ts',
      default: './dist/season/runtime/response.js',
    });
    expect(sharedPackageJson.exports['./season/operations']).toEqual({
      types: './dist/season/operations/index.d.ts',
      default: './dist/season/operations/index.js',
    });
    expect(sharedPackageJson.exports['./season/participation']).toEqual({
      types: './dist/season/participation/index.d.ts',
      default: './dist/season/participation/index.js',
    });
  });

  it('API source는 removed season-contract aggregate를 import하지 않는다', () => {
    const removedImportOffenders = walkTypeScriptFiles(apiSrc)
      .filter((path) => !ignoredSourceOfTruthSpecs.has(sourceRelativePath(path)))
      .filter((path) => readFileSync(path, 'utf8').includes(removedSeasonContractSpecifier))
      .map(sourceRelativePath)
      .sort();

    expect(removedImportOffenders).toEqual([]);
  });
});
