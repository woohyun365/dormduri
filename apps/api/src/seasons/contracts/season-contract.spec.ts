import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as seasonContract from '@repo/shared/season';
import * as seasonOperationsContract from '@repo/shared/season/operations';
import * as seasonPrimitivesContract from '@repo/shared/season/primitives';
import * as seasonResponseContract from '@repo/shared/season/response';
import * as seasonRuntimeContract from '@repo/shared/season/runtime';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SHARED_SRC_DIR = path.resolve(CURRENT_DIR, '../../../../../packages/shared/src');
const SHARED_PACKAGE_JSON_PATH = path.resolve(
  CURRENT_DIR,
  '../../../../../packages/shared/package.json',
);

describe('season shared contract', () => {
  it('season canonical barrel은 runtime/operations/participation schema surface를 제공한다', () => {
    expect(seasonContract.seasonStateSchema).toBe(seasonRuntimeContract.seasonStateSchema);
    expect(seasonContract.seasonRuntimeOverrideSchema).toBe(
      seasonPrimitivesContract.seasonRuntimeOverrideSchema,
    );
    expect(seasonContract.seasonStateSchema).toBe(seasonRuntimeContract.seasonStateSchema);
    expect(seasonPrimitivesContract.seasonStateSchema).toBe(
      seasonRuntimeContract.seasonStateSchema,
    );
    expect(seasonContract.currentSeasonResponseSchema).toBe(
      seasonResponseContract.currentSeasonResponseSchema,
    );
    expect(seasonResponseContract.currentSeasonResponseSchema).toBe(
      seasonRuntimeContract.currentSeasonResponseSchema,
    );
    expect(seasonContract.updateSeasonScheduleRequestSchema).toBe(
      seasonOperationsContract.updateSeasonScheduleRequestSchema,
    );
  });

  it('season runtime/current-season response contract shape를 유지한다', () => {
    expect(
      seasonPrimitivesContract.seasonRuntimeOverrideSchema.parse({
        active: false,
        state: null,
        reason: null,
        startedAt: null,
        endsAt: null,
      }),
    ).toMatchObject({ active: false, state: null });

    expect(
      seasonResponseContract.currentSeasonResponseSchema.parse({
        campusCode: 'CHUNCHEON',
        season: {
          id: 'season-1',
          name: '2026 1학기',
          preparationStartDate: '2026-01-01',
          matchingStartDate: '2026-01-28',
          seasonEndDate: '2026-02-28',
        },
        operatedDormitories: [
          {
            dormitoryId: 'dasan',
            isOperated: true,
            roomSelectionDate: '2026-02-11',
          },
        ],
        state: 'SEASON_MATCHING',
        isActive: true,
        isOpen: false,
        isMatching: true,
        isPostMatch: false,
        daysUntilMatchingEnd: 3,
        daysUntilSeasonEnd: 20,
        schedule: {
          preparationStart: '2026-01-01',
          matchingStart: '2026-01-28',
          matchingEnd: '2026-02-12',
          seasonEnd: '2026-02-28',
        },
        override: {
          active: false,
          state: null,
          reason: null,
          startedAt: null,
          endsAt: null,
        },
      }),
    ).toMatchObject({ state: 'SEASON_MATCHING', isMatching: true });
  });

  it('season operations contract는 schedule/override/concurrency/audit response shape를 고정한다', () => {
    expect(
      seasonOperationsContract.updateSeasonScheduleRequestSchema.parse({
        expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
        preparationStartDate: '2026-02-01',
        matchingStartDate: '2026-02-10',
        seasonEndDate: '2026-02-28',
        reason: 'academic calendar changed',
      }),
    ).toMatchObject({ matchingStartDate: '2026-02-10' });

    expect(
      seasonOperationsContract.updateSeasonOverrideRequestSchema.parse({
        expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
        state: 'SEASON_MATCHING',
        reason: 'incident response',
        startsAt: '2026-02-10T00:00:00.000Z',
        endsAt: null,
      }),
    ).toMatchObject({ state: 'SEASON_MATCHING', endsAt: null });

    expect(
      seasonOperationsContract.seasonOperationResponseSchema.parse({
        auditEventId: 'audit-1',
        action: 'UPDATE_SCHEDULE',
        season: {
          campusCode: 'CHUNCHEON',
          season: {
            id: 'season-1',
            name: '2026 1학기',
            preparationStartDate: '2026-02-01',
            matchingStartDate: '2026-02-10',
            seasonEndDate: '2026-02-28',
          },
          updatedAt: '2026-01-02T00:00:00.000Z',
          override: {
            active: false,
            state: null,
            reason: null,
            startedAt: null,
            endsAt: null,
          },
        },
      }),
    ).toMatchObject({ auditEventId: 'audit-1', action: 'UPDATE_SCHEDULE' });
  });

  it('season legacy root/compat files를 남기지 않는다', () => {
    for (const legacyRootFile of [
      'season-contract.ts',
      'season-contract-primitives.ts',
      'season-contract-response.ts',
      'compat/season-contract.ts',
    ]) {
      expect(existsSync(path.join(SHARED_SRC_DIR, legacyRootFile))).toBe(false);
    }
  });

  it('season package exports는 canonical granular subpath만 제공한다', () => {
    const packageJson = JSON.parse(readFileSync(SHARED_PACKAGE_JSON_PATH, 'utf8')) as {
      exports: Record<string, { types: string; default: string }>;
    };

    expect(packageJson.exports['./season-contract']).toBeUndefined();
    expect(packageJson.exports['./season']).toEqual({
      types: './dist/season/index.d.ts',
      default: './dist/season/index.js',
    });
    expect(packageJson.exports['./season/runtime']).toEqual({
      types: './dist/season/runtime/index.d.ts',
      default: './dist/season/runtime/index.js',
    });
    expect(packageJson.exports['./season/primitives']).toEqual({
      types: './dist/season/runtime/primitives.d.ts',
      default: './dist/season/runtime/primitives.js',
    });
    expect(packageJson.exports['./season/response']).toEqual({
      types: './dist/season/runtime/response.d.ts',
      default: './dist/season/runtime/response.js',
    });
    expect(packageJson.exports['./season/operations']).toEqual({
      types: './dist/season/operations/index.d.ts',
      default: './dist/season/operations/index.js',
    });
    expect(packageJson.exports['./season/participation']).toEqual({
      types: './dist/season/participation/index.d.ts',
      default: './dist/season/participation/index.js',
    });
  });
});
