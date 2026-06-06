import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { ClearSeasonOverrideCommand } from '../seasons/operations/clear-season-override.command.js';
import { SeasonOperationsAuditRepository } from '../seasons/operations/season-operations-audit.repository.js';
import { SeasonOperationsRepository } from '../seasons/operations/season-operations.repository.js';
import { SeasonsOperationsController } from '../seasons/operations/seasons-operations.controller.js';
import { UpdateSeasonOverrideCommand } from '../seasons/operations/update-season-override.command.js';
import { UpdateSeasonScheduleCommand } from '../seasons/operations/update-season-schedule.command.js';
import { SEASON_CONTEXT_PORT } from '../seasons/ports/season-context.port.js';
import { SeasonsController } from '../seasons/seasons.controller.js';
import { SeasonsModule } from '../seasons/seasons.module.js';
import { CurrentSeasonContextQuery } from '../seasons/runtime/current-season-context.query.js';
import { DormitoryMatchWindowQuery } from '../seasons/runtime/dormitory-match-window.query.js';
import { SeasonRuntimeRepository } from '../seasons/runtime/season-runtime.repository.js';
import { SeasonsService } from '../seasons/seasons.service.js';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const seasonsRoot = join(apiSourceRoot, 'seasons');
const platformTimeRoot = join(apiSourceRoot, 'platform/time');

const transitionalRootRuntimeFiles = [
  'seasons.controller.ts',
  'seasons.errors.ts',
  'seasons.module.ts',
  'seasons.service.ts',
] as const;

const requiredRuntimeFiles = [
  'current-season-context.query.ts',
  'current-season.mapper.ts',
  'current-season.mapper.spec.ts',
  'dormitory-match-window.query.ts',
  'season-runtime.policy.ts',
  'season-runtime.policy.spec.ts',
  'season-runtime.repository.ts',
  'season-runtime.repository.spec.ts',
  'season-runtime.types.ts',
] as const;

const requiredOperationsFiles = [
  'clear-season-override.command.ts',
  'season-operations-audit.repository.ts',
  'season-operations.mapper.ts',
  'season-operations.policy.ts',
  'season-operations.repository.ts',
  'seasons-operations.controller.ts',
  'update-season-override.command.ts',
  'update-season-schedule.command.ts',
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
  it('keeps SeasonsModule on the runtime port plus operations provider surface', () => {
    expect(moduleMetadata(SeasonsModule, 'imports')).toEqual([PrismaModule]);
    expect(moduleMetadata(SeasonsModule, 'controllers')).toEqual([
      SeasonsController,
      SeasonsOperationsController,
    ]);
    expect(moduleMetadata(SeasonsModule, 'providers')).toEqual([
      SeasonsService,
      SeasonRuntimeRepository,
      CurrentSeasonContextQuery,
      DormitoryMatchWindowQuery,
      SeasonOperationsRepository,
      SeasonOperationsAuditRepository,
      UpdateSeasonScheduleCommand,
      UpdateSeasonOverrideCommand,
      ClearSeasonOverrideCommand,
      { provide: SEASON_CONTEXT_PORT, useExisting: SeasonsService },
    ]);
    expect(moduleMetadata(SeasonsModule, 'exports')).toEqual([SEASON_CONTEXT_PORT]);
  });

  it('keeps root runtime files on the documented transitional compatibility surface', () => {
    const rootRuntimeFiles = productionTypeScriptFiles(seasonsRoot)
      .filter((path) => dirname(path) === seasonsRoot)
      .map((path) => rootRelativePath(path, seasonsRoot))
      .sort();

    expect(rootRuntimeFiles).toEqual([...transitionalRootRuntimeFiles].sort());
  });

  it('keeps runtime query, repository, mapper, policy, and neutral time split in dedicated files', () => {
    for (const file of requiredRuntimeFiles) {
      expect(existsSync(join(seasonsRoot, 'runtime', file))).toBe(true);
    }
    expect(existsSync(join(platformTimeRoot, 'kst-date.ts'))).toBe(true);
    expect(existsSync(join(platformTimeRoot, 'kst-date.spec.ts'))).toBe(true);
  });

  it('keeps admin operations commands, repositories, mapper, and controller in operations slice', () => {
    for (const file of requiredOperationsFiles) {
      expect(existsSync(join(seasonsRoot, 'operations', file))).toBe(true);
    }
  });

  it('keeps operations/runtime internals private and migrates external consumers to the public season port', () => {
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
    expect(runtimeOffenders).toEqual([]);

    const concreteServiceImport = /from\s+['"][^'"]*seasons\/seasons\.service(?:\.js)?['"]/;
    const concreteServiceOffenders = externalFiles
      .filter((path) => concreteServiceImport.test(readSource(path)))
      .map(relativeSourcePath)
      .sort();
    expect(concreteServiceOffenders).toEqual([]);
  });

  it('keeps SeasonsService as a thin facade that implements the public season context port', () => {
    const source = readSource(join(seasonsRoot, 'seasons.service.ts'));

    expect(source).toContain('implements SeasonContextPort');
    expect(source).toContain('CurrentSeasonContextQuery');
    expect(source).toContain('DormitoryMatchWindowQuery');
    expect(source).not.toMatch(
      /PrismaService|prisma\.|\$queryRawTyped|getCurrentTimestamp|season\.findMany/,
    );
  });

  it('keeps season.utils and season.types removed after canonical port migration', () => {
    const seasonUtilsPath = join(seasonsRoot, 'season.utils.ts');
    const seasonTypesPath = join(seasonsRoot, 'season.types.ts');
    const seasonTypesImport = /from\s+['"][^'"]*seasons\/season\.types(?:\.js)?['"]/;
    const seasonUtilsImport = /from\s+['"][^'"]*seasons\/season\.utils(?:\.js)?['"]/;
    const offenders = productionTypeScriptFiles(apiSourceRoot)
      .filter(
        (path) =>
          seasonUtilsImport.test(readSource(path)) || seasonTypesImport.test(readSource(path)),
      )
      .map(relativeSourcePath)
      .sort();

    expect(existsSync(seasonUtilsPath)).toBe(false);
    expect(existsSync(seasonTypesPath)).toBe(false);
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
