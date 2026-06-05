import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { SeasonsController } from '../seasons/seasons.controller.js';
import { SeasonsModule } from '../seasons/seasons.module.js';
import { SeasonsService } from '../seasons/seasons.service.js';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const seasonsRoot = join(apiSourceRoot, 'seasons');
const platformTimeRoot = join(apiSourceRoot, 'platform/time');

const transitionalRootRuntimeFiles = [
  'season.types.ts',
  'seasons.controller.ts',
  'seasons.errors.ts',
  'seasons.module.ts',
  'seasons.service.ts',
] as const;

const requiredPhaseTwoRuntimeFiles = [
  'current-season.mapper.ts',
  'current-season.mapper.spec.ts',
  'season-runtime.policy.ts',
  'season-runtime.policy.spec.ts',
  'season-runtime.types.ts',
] as const;

const transitionalRuntimeImportAllowlist = [
  'src/chat/lifecycle/chat-match-thread-lifecycle.service.ts',
  'src/chat/policies/chat-thread-policy.ts',
  'src/season-participants/application/season-context.query.ts',
] as const;

function moduleMetadata<T>(
  target: object,
  key: 'imports' | 'controllers' | 'providers' | 'exports',
): T[] {
  return (Reflect.getMetadata(key, target) ?? []) as T[];
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

function productionTypeScriptFiles(root: string): string[] {
  return walkTypeScriptFiles(root).filter((path) => !path.endsWith('.spec.ts'));
}

function readSource(path: string) {
  return readFileSync(path, 'utf8');
}

function relativeSourcePath(path: string) {
  return relative(apiRoot, path);
}

function rootRelativePath(path: string, root: string) {
  return relative(root, path).split(sep).join('/');
}

function expectReadmeSections(path: string, sections: readonly string[]) {
  expect(existsSync(path)).toBe(true);
  const source = readSource(path);

  for (const section of sections) {
    expect(source).toContain(section);
  }

  return source;
}

describe('seasons final structure boundary', () => {
  it('keeps SeasonsModule on the Phase 1 transitional public surface', () => {
    expect(moduleMetadata(SeasonsModule, 'imports')).toEqual([PrismaModule]);
    expect(moduleMetadata(SeasonsModule, 'controllers')).toEqual([SeasonsController]);
    expect(moduleMetadata(SeasonsModule, 'providers')).toEqual([SeasonsService]);
    expect(moduleMetadata(SeasonsModule, 'exports')).toEqual([SeasonsService]);
  });

  it('keeps root runtime files on the documented transitional compatibility surface', () => {
    const rootRuntimeFiles = productionTypeScriptFiles(seasonsRoot)
      .filter((path) => dirname(path) === seasonsRoot)
      .map((path) => rootRelativePath(path, seasonsRoot))
      .sort();

    expect(rootRuntimeFiles).toEqual([...transitionalRootRuntimeFiles].sort());
  });

  it('keeps Phase 2 runtime and neutral time split in dedicated files', () => {
    for (const file of requiredPhaseTwoRuntimeFiles) {
      expect(existsSync(join(seasonsRoot, 'runtime', file))).toBe(true);
    }
    expect(existsSync(join(platformTimeRoot, 'kst-date.ts'))).toBe(true);
    expect(existsSync(join(platformTimeRoot, 'kst-date.spec.ts'))).toBe(true);
  });

  it('keeps operations internals private and freezes transitional runtime imports', () => {
    const forbiddenOperationsImport = /from\s+['"][^'"]*seasons\/operations\/[^'"]+['"]/;
    const runtimeImport = /from\s+['"][^'"]*seasons\/runtime\/[^'"]+['"]/;
    const externalFiles = productionTypeScriptFiles(apiSourceRoot).filter(
      (path) => !path.startsWith(seasonsRoot),
    );
    const operationOffenders = externalFiles
      .filter((path) => forbiddenOperationsImport.test(readSource(path)))
      .map(relativeSourcePath)
      .sort();
    const runtimeOffenders = externalFiles
      .filter((path) => runtimeImport.test(readSource(path)))
      .map(relativeSourcePath)
      .sort();

    expect(operationOffenders).toEqual([]);
    expect(runtimeOffenders).toEqual([...transitionalRuntimeImportAllowlist].sort());
  });

  it('keeps season.utils removed after Phase 2 canonical import migration', () => {
    const seasonUtilsPath = join(seasonsRoot, 'season.utils.ts');
    const seasonUtilsImport = /from\s+['"][^'"]*seasons\/season\.utils(?:\.js)?['"]/;
    const offenders = productionTypeScriptFiles(apiSourceRoot)
      .filter((path) => seasonUtilsImport.test(readSource(path)))
      .map(relativeSourcePath)
      .sort();

    expect(existsSync(seasonUtilsPath)).toBe(false);
    expect(offenders).toEqual([]);
  });

  it('documents the seasons product boundary and #208/#209 ownership', () => {
    const source = expectReadmeSections(join(seasonsRoot, 'README.md'), [
      '## Public boundary',
      '## Source of truth',
      '## Current directory responsibilities',
      '## #208 operations scope',
      '## #209 cache scope',
      '## Hard rules',
      '## Target direction',
      '## Where to change',
      '## Useful verification',
    ]);

    expect(source).toContain('override는 schedule/history/audit 원장이 아니다');
    expect(source).toContain('Redis/process cache는 관측된 병목이 생길 때 후속 issue로 다룬다');
    expect(source).toContain('BackOffice UI는 이 module 범위가 아니다');
  });
});
