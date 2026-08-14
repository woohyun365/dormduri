import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface PackageExportTarget {
  types: string;
  default: string;
}

interface SharedPackageManifest {
  exports: Record<string, PackageExportTarget>;
}

const packageRoot = process.cwd();
const manifest = JSON.parse(
  readFileSync(join(packageRoot, 'package.json'), 'utf8'),
) as SharedPackageManifest;

describe('shared public export surface', () => {
  it('모든 선언된 public export가 build artifact로 해석된다', () => {
    const unresolved = Object.entries(manifest.exports).flatMap(([specifier, target]) =>
      [target.types, target.default]
        .filter((artifactPath) => !existsSync(join(packageRoot, artifactPath)))
        .map((artifactPath) => ({ specifier, artifactPath })),
    );

    expect(unresolved).toEqual([]);
  });

  it('domain contract는 canonical granular public path를 제공한다', () => {
    expect(Object.keys(manifest.exports)).toEqual(
      expect.arrayContaining([
        './auth/contract',
        './dormitory/catalog',
        './match/contract',
        './profile/compatibility-scoring',
        './profile/contract',
        './season/participation',
        './social-safety/block',
        './social-safety/bookmark',
        './social-safety/report',
      ]),
    );
  });
});
