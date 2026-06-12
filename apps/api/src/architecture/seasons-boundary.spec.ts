import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { SeasonsService } from '../seasons/application/seasons.service.js';
import { ClearSeasonOverrideCommand } from '../seasons/operations/clear-season-override.command.js';
import { SeasonOperationalMetricsService } from '../seasons/operations/season-operational-metrics.service.js';
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

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const apiTestRoot = join(apiRoot, 'test');
const seasonsRoot = join(apiSourceRoot, 'seasons');
const platformTimeRoot = join(apiSourceRoot, 'platform/time');

const finalRootRuntimeFiles = ['seasons.controller.ts', 'seasons.module.ts'] as const;

const finalRootSpecFiles = ['seasons.controller.spec.ts'] as const;

const requiredApplicationFiles = ['seasons.service.ts', 'seasons.service.spec.ts'] as const;

const requiredErrorFiles = ['seasons.errors.ts'] as const;

const requiredRuntimeFiles = [
  'campus-service-state.query.ts',
  'campus-service-state.query.spec.ts',
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
  'season-operational-metrics.service.ts',
  'season-operational-metrics.service.spec.ts',
  'season-operations-audit.repository.ts',
  'season-operations.mapper.ts',
  'season-operations.policy.ts',
  'season-operations.repository.ts',
  'seasons-operations.controller.ts',
  'update-season-override.command.ts',
  'update-season-schedule.command.ts',
] as const;

const requiredCacheFiles = [
  'season-context-cache.ts',
  'season-context-cache.spec.ts',
  'season-context-memoizer.ts',
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

function specTypeScriptFiles(root: string): string[] {
  return walkTypeScriptFiles(root).filter((path) => path.endsWith('.spec.ts'));
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
      SeasonOperationalMetricsService,
      UpdateSeasonScheduleCommand,
      UpdateSeasonOverrideCommand,
      ClearSeasonOverrideCommand,
      { provide: SEASON_CONTEXT_PORT, useExisting: SeasonsService },
    ]);
    expect(moduleMetadata(SeasonsModule, 'exports')).toEqual([SEASON_CONTEXT_PORT]);
  });

  it('keeps root production files on the documented final public/facade surface', () => {
    const rootRuntimeFiles = productionTypeScriptFiles(seasonsRoot)
      .filter((path) => dirname(path) === seasonsRoot)
      .map((path) => rootRelativePath(path, seasonsRoot))
      .sort();

    expect(rootRuntimeFiles).toEqual([...finalRootRuntimeFiles].sort());
  });

  it('keeps only route regression spec on the root spec surface', () => {
    const rootSpecFiles = specTypeScriptFiles(seasonsRoot)
      .filter((path) => dirname(path) === seasonsRoot)
      .map((path) => rootRelativePath(path, seasonsRoot))
      .sort();

    expect(rootSpecFiles).toEqual([...finalRootSpecFiles].sort());
  });

  it('keeps facade service and error contract out of the root directory', () => {
    for (const file of requiredApplicationFiles) {
      expect(existsSync(join(seasonsRoot, 'application', file))).toBe(true);
    }

    for (const file of requiredErrorFiles) {
      expect(existsSync(join(seasonsRoot, 'errors', file))).toBe(true);
    }
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

  it('keeps request/method-level season context memoization in the cache slice', () => {
    for (const file of requiredCacheFiles) {
      expect(existsSync(join(seasonsRoot, 'cache', file))).toBe(true);
    }

    expect(existsSync(join(seasonsRoot, 'cache', 'redis-season-context-cache.ts'))).toBe(false);
  });

  it('keeps admin mutation operations independent from request cache state', () => {
    const cacheImport = /from\s+['"](?:[^'"]*seasons\/cache\/|\.\.\/cache\/)[^'"]+['"]/;
    const operationCacheOffenders = productionTypeScriptFiles(join(seasonsRoot, 'operations'))
      .filter((path) => cacheImport.test(readSource(path)))
      .map(relativeSourcePath)
      .sort();

    expect(operationCacheOffenders).toEqual([]);
  });

  it('keeps operations/runtime internals private and migrates external consumers to the public season port', () => {
    const privateSeasonSliceImport =
      /from\s+['"][^'"]*seasons\/(?:application|errors|operations|runtime)\/[^'"]+['"]/;
    const stableRuntimeImport = /seasons\/runtime\/campus-service-state\.query(?:\.js)?['"]/;
    const externalFiles = productionTypeScriptFiles(apiSourceRoot).filter(
      (path) => !path.startsWith(seasonsRoot),
    );
    const privateSliceOffenders = externalFiles
      .filter((path) => {
        const source = readSource(path);
        return privateSeasonSliceImport.test(source) && !stableRuntimeImport.test(source);
      })
      .map(relativeSourcePath)
      .sort();

    expect(privateSliceOffenders).toEqual([]);

    const concreteServiceImport = /from\s+['"][^'"]*seasons\/seasons\.service(?:\.js)?['"]/;
    const concreteServiceOffenders = externalFiles
      .filter((path) => concreteServiceImport.test(readSource(path)))
      .map(relativeSourcePath)
      .sort();
    expect(concreteServiceOffenders).toEqual([]);
  });

  it('keeps SeasonsService as a thin facade that implements the public season context port', () => {
    const source = readSource(join(seasonsRoot, 'application', 'seasons.service.ts'));

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
    const sourceAndTestFiles = [
      ...productionTypeScriptFiles(apiSourceRoot),
      ...walkTypeScriptFiles(apiTestRoot),
    ];
    const offenders = sourceAndTestFiles
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

  it('documents the seasons product boundary without plan-dependent wording', () => {
    const source = expectReadmeSections(join(seasonsRoot, 'README.md'), [
      '## Public boundary',
      '## Source of truth',
      '## Directory responsibilities',
      '## Hard rules',
      '## Architecture guard',
      '## Where to change',
      '## Useful verification',
    ]);

    expect(source).toContain('override는 schedule/history/audit 원장이 아니다');
    expect(source).toContain(
      'Root production TypeScript file은 `seasons.controller.ts`, `seasons.module.ts`만 허용한다',
    );
    expect(source).toContain(
      'Redis/process-wide cache는 현재 source-of-truth나 기본 cache strategy가 아니다',
    );
    expect(source).toContain(
      'Metric/log payload는 actor/session/reason/snapshot 원문을 포함하지 않는다',
    );
    expect(source).toContain(
      'shared season contract는 `packages/shared/src/season/{runtime,operations,participation}/**`가 canonical owner이며 public import는 `@repo/shared/season`과 granular `@repo/shared/season/*`만 사용한다',
    );
    const removedSeasonContractSpecifier = '@repo/shared/' + 'season-contract';
    expect(source).not.toContain(removedSeasonContractSpecifier);
    expect(source).toContain('BackOffice UI는 seasons API module 범위가 아니다');
    expect(source).not.toMatch(/Phase \d|#208|#209|\.omx\/plans/);
  });
});
