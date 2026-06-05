import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { SeasonsController } from '../seasons/seasons.controller.js';
import { SeasonsModule } from '../seasons/seasons.module.js';
import { SeasonsService } from '../seasons/seasons.service.js';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const seasonsRoot = join(apiSourceRoot, 'seasons');

const transitionalRootRuntimeFiles = [
  'season.types.ts',
  'season.utils.ts',
  'seasons.controller.ts',
  'seasons.errors.ts',
  'seasons.module.ts',
  'seasons.service.ts',
] as const;

const transitionalSeasonUtilsExternalImportAllowlist = [
  'src/chat/lifecycle/chat-match-thread-lifecycle.service.ts',
  'src/chat/lifecycle/chat-season-lifecycle.service.ts',
  'src/chat/policies/chat-thread-permission.policy.ts',
  'src/chat/policies/chat-thread-policy.ts',
  'src/dormitories/selection-catalog/dormitory-selection-eligibility.policy.ts',
  'src/dormitories/selection-catalog/prisma-dormitory-selection-catalog.adapter.ts',
  'src/lifecycle/adapters/season-boundary-schedule.adapter.ts',
  'src/matches/match-history-materialization-owner.ts',
  'src/matches/match-history-read-owner.ts',
  'src/matches/match-read-model.ts',
  'src/matches/match-request-step-owner.ts',
  'src/matches/matches.service.ts',
  'src/season-participants/application/season-context.query.ts',
  'src/season-participants/policies/season-participant-selection.policy.ts',
  'src/users/academic-identity-correction-allowance.owner.ts',
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

  it('keeps future runtime and operations internals out of external production imports', () => {
    const forbiddenInternalImport = /from\s+['"][^'"]*seasons\/(?:runtime|operations)\/[^'"]+['"]/;
    const externalFiles = productionTypeScriptFiles(apiSourceRoot).filter(
      (path) => !path.startsWith(seasonsRoot),
    );
    const offenders = externalFiles
      .filter((path) => forbiddenInternalImport.test(readSource(path)))
      .map(relativeSourcePath)
      .sort();

    expect(offenders).toEqual([]);
  });

  it('keeps season.utils external imports frozen until platform time migration', () => {
    const seasonUtilsImport = /from\s+['"][^'"]*seasons\/season\.utils(?:\.js)?['"]/;
    const externalFiles = productionTypeScriptFiles(apiSourceRoot).filter(
      (path) => !path.startsWith(seasonsRoot),
    );
    const offenders = externalFiles
      .filter((path) => seasonUtilsImport.test(readSource(path)))
      .map(relativeSourcePath)
      .sort();

    expect(offenders).toEqual([...transitionalSeasonUtilsExternalImportAllowlist].sort());
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
