import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaDormitorySelectionCatalogAdapter } from './prisma-dormitory-selection-catalog.adapter.js';

function objectContaining(shape: Record<string, unknown>): unknown {
  return expect.objectContaining(shape) as unknown;
}

describe('PrismaDormitorySelectionCatalogAdapter', () => {
  const prisma = {
    campusMaster: {
      findUnique: vi.fn(),
    },
    seasonDormitoryOperation: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  };
  const service = new PrismaDormitorySelectionCatalogAdapter(prisma as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('season participant용 selectable 조회는 snapshot 기준으로 cutoff를 적용하고 season contract item을 반환한다', async () => {
    const now = new Date('2026-02-10T03:00:00.000Z');
    prisma.seasonDormitoryOperation.findMany.mockResolvedValue([
      {
        seasonId: 'season-1',
        dormitoryId: 'dasan',
        isOperated: true,
        roomSelectionDate: new Date('2026-02-11T00:00:00.000Z'),
        dormitory: {
          id: 'dasan',
          campusCode: 'CHUNCHEON',
          nameKo: '다산관',
          roomType: 2,
          genderPolicy: 'M',
          sortOrder: 2,
        },
      },
    ]);

    await expect(
      service.listSelectableDormitoriesForSeasonParticipant({
        seasonContext: {
          season: { id: 'season-1' },
          state: 'SEASON_MATCHING',
        } as never,
        campusCodeSnapshot: 'CHUNCHEON',
        genderSnapshot: 'M',
        now,
      }),
    ).resolves.toEqual([
      {
        id: 'dasan',
        name: '다산관',
        campusCode: 'CHUNCHEON',
        roomType: 2,
        genderPolicy: 'M',
        roomSelectionDate: '2026-02-11',
      },
    ]);

    expect(prisma.seasonDormitoryOperation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: objectContaining({
          seasonId: 'season-1',
          isOperated: true,
          dormitory: {
            campusCode: 'CHUNCHEON',
            genderPolicy: { in: ['M', 'BOTH'] },
          },
          roomSelectionDate: { gte: new Date('2026-02-10T00:00:00.000Z') },
        }),
      }),
    );
  });

  it('season participant용 selectable 조회는 전달된 query client를 사용한다', async () => {
    const queryClient = {
      seasonDormitoryOperation: {
        findMany: vi.fn().mockResolvedValue([
          {
            seasonId: 'season-1',
            dormitoryId: 'dasan',
            isOperated: true,
            roomSelectionDate: new Date('2026-02-11T00:00:00.000Z'),
            dormitory: {
              id: 'dasan',
              campusCode: 'CHUNCHEON',
              nameKo: '다산관',
              roomType: 2,
              genderPolicy: 'M',
              sortOrder: 2,
            },
          },
        ]),
      },
    };

    await expect(
      service.listSelectableDormitoriesForSeasonParticipant({
        seasonContext: {
          season: { id: 'season-1' },
          state: 'SEASON_MATCHING',
        } as never,
        campusCodeSnapshot: 'CHUNCHEON',
        genderSnapshot: 'M',
        now: new Date('2026-02-10T03:00:00.000Z'),
        queryClient: queryClient as never,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'dasan',
        campusCode: 'CHUNCHEON',
        roomSelectionDate: '2026-02-11',
      }),
    ]);

    expect(queryClient.seasonDormitoryOperation.findMany).toHaveBeenCalled();
    expect(prisma.seasonDormitoryOperation.findMany).not.toHaveBeenCalled();
  });

  it('season participant용 validation은 query client와 compound key lookup을 사용한다', async () => {
    const tx = {
      seasonDormitoryOperation: {
        findUnique: vi.fn().mockResolvedValue({
          seasonId: 'season-1',
          dormitoryId: 'dasan',
          isOperated: true,
          roomSelectionDate: new Date('2026-02-11T00:00:00.000Z'),
          dormitory: {
            id: 'dasan',
            campusCode: 'CHUNCHEON',
            nameKo: '다산관',
            roomType: 2,
            genderPolicy: 'M',
            sortOrder: 2,
          },
        }),
      },
    };

    await expect(
      service.validateSelectableDormitoryForSeasonParticipant({
        seasonContext: {
          season: { id: 'season-1' },
          state: 'SEASON_MATCHING',
        } as never,
        campusCodeSnapshot: 'CHUNCHEON',
        genderSnapshot: 'M',
        dormitoryId: 'dasan',
        now: new Date('2026-02-10T03:00:00.000Z'),
        queryClient: tx as never,
      }),
    ).resolves.toEqual({
      valid: true,
      item: {
        id: 'dasan',
        name: '다산관',
        campusCode: 'CHUNCHEON',
        roomType: 2,
        genderPolicy: 'M',
        roomSelectionDate: '2026-02-11',
      },
    });

    expect(tx.seasonDormitoryOperation.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          seasonId_dormitoryId: {
            seasonId: 'season-1',
            dormitoryId: 'dasan',
          },
        },
      }),
    );
    expect(prisma.seasonDormitoryOperation.findUnique).not.toHaveBeenCalled();
  });

  it('season participant용 validation은 operated/campus/gender/cutoff 실패 reason을 반환한다', async () => {
    const baseInput = {
      seasonContext: {
        season: { id: 'season-1' },
        state: 'SEASON_MATCHING',
      } as never,
      campusCodeSnapshot: 'CHUNCHEON' as const,
      genderSnapshot: 'M' as const,
      dormitoryId: 'dasan',
      now: new Date('2026-02-10T03:00:00.000Z'),
    };

    prisma.seasonDormitoryOperation.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.validateSelectableDormitoryForSeasonParticipant(baseInput),
    ).resolves.toEqual({
      valid: false,
      reason: 'DORMITORY_NOT_FOUND',
    });

    prisma.seasonDormitoryOperation.findUnique.mockResolvedValueOnce({
      seasonId: 'season-1',
      dormitoryId: 'dasan',
      isOperated: false,
      roomSelectionDate: new Date('2026-02-11T00:00:00.000Z'),
      dormitory: {
        id: 'dasan',
        campusCode: 'CHUNCHEON',
        nameKo: '다산관',
        roomType: 2,
        genderPolicy: 'M',
        sortOrder: 2,
      },
    });
    await expect(
      service.validateSelectableDormitoryForSeasonParticipant(baseInput),
    ).resolves.toEqual({
      valid: false,
      reason: 'DORMITORY_NOT_OPERATED',
    });

    prisma.seasonDormitoryOperation.findUnique.mockResolvedValueOnce({
      seasonId: 'season-1',
      dormitoryId: 'dasan',
      isOperated: true,
      roomSelectionDate: new Date('2026-02-11T00:00:00.000Z'),
      dormitory: {
        id: 'dasan',
        campusCode: 'SAMCHEOK',
        nameKo: '다산관',
        roomType: 2,
        genderPolicy: 'M',
        sortOrder: 2,
      },
    });
    await expect(
      service.validateSelectableDormitoryForSeasonParticipant(baseInput),
    ).resolves.toEqual({
      valid: false,
      reason: 'DORMITORY_CAMPUS_MISMATCH',
    });

    prisma.seasonDormitoryOperation.findUnique.mockResolvedValueOnce({
      seasonId: 'season-1',
      dormitoryId: 'dasan',
      isOperated: true,
      roomSelectionDate: new Date('2026-02-11T00:00:00.000Z'),
      dormitory: {
        id: 'dasan',
        campusCode: 'CHUNCHEON',
        nameKo: '다산관',
        roomType: 2,
        genderPolicy: 'F',
        sortOrder: 2,
      },
    });
    await expect(
      service.validateSelectableDormitoryForSeasonParticipant(baseInput),
    ).resolves.toEqual({
      valid: false,
      reason: 'DORMITORY_GENDER_MISMATCH',
    });

    prisma.seasonDormitoryOperation.findUnique.mockResolvedValueOnce({
      seasonId: 'season-1',
      dormitoryId: 'dasan',
      isOperated: true,
      roomSelectionDate: new Date('2026-02-09T00:00:00.000Z'),
      dormitory: {
        id: 'dasan',
        campusCode: 'CHUNCHEON',
        nameKo: '다산관',
        roomType: 2,
        genderPolicy: 'M',
        sortOrder: 2,
      },
    });
    await expect(
      service.validateSelectableDormitoryForSeasonParticipant(baseInput),
    ).resolves.toEqual({
      valid: false,
      reason: 'DORMITORY_SELECTION_CLOSED',
    });
  });
});
