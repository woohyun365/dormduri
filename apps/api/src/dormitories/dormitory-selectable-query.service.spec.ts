import { DormitorySelectableQueryService } from './dormitory-selectable-query.service.js';

function objectContaining(shape: Record<string, unknown>): unknown {
  return expect.objectContaining(shape) as unknown;
}

describe('DormitorySelectableQueryService', () => {
  const prisma = {
    campusMaster: {
      findUnique: jest.fn(),
    },
    seasonDormitoryOperation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const seasonsService = {
    getCurrentSeasonContext: jest.fn(),
  };

  const service = new DormitorySelectableQueryService(prisma as never, seasonsService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      season: { id: 'season-1' },
      state: 'SEASON_MATCHING',
      operatedDormitories: [
        { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-02-11' },
        { dormitoryId: 'saerom', isOperated: true, roomSelectionDate: '2026-02-12' },
      ],
      schedule: {
        preparationStart: '2026-01-01',
        matchingStart: '2026-01-28',
        matchingEnd: '2026-02-12',
        seasonEnd: '2026-02-28',
      },
      isActive: true,
      isOpen: false,
      isMatching: true,
      isPostMatch: false,
      daysUntilMatchingEnd: 2,
      daysUntilSeasonEnd: 18,
      override: {
        active: false,
        state: null,
        reason: null,
        startedAt: null,
        endsAt: null,
      },
    });
  });

  it('비운영 캠퍼스 selectable 목록은 빈 items를 반환한다', async () => {
    prisma.campusMaster.findUnique.mockResolvedValue({
      code: 'SAMCHEOK',
      nameKo: '삼척캠퍼스',
      isOperated: false,
    });

    await expect(service.getSelectableDormitories('SAMCHEOK', 'M')).resolves.toEqual({
      campus: {
        code: 'SAMCHEOK',
        nameKo: '삼척캠퍼스',
        isOperated: false,
      },
      items: [],
    });
    expect(seasonsService.getCurrentSeasonContext).not.toHaveBeenCalled();
  });

  it('current season의 운영 기숙사만 selectable 목록으로 반환한다', async () => {
    prisma.campusMaster.findUnique.mockResolvedValue({
      code: 'CHUNCHEON',
      nameKo: '춘천캠퍼스',
      isOperated: true,
    });
    prisma.seasonDormitoryOperation.findMany.mockResolvedValue([
      {
        roomSelectionDate: new Date('2026-02-12T00:00:00.000Z'),
        dormitory: {
          id: 'saerom',
          nameKo: '새롬관',
          roomType: 2,
          genderPolicy: 'BOTH',
          sortOrder: 6,
        },
      },
      {
        roomSelectionDate: new Date('2026-02-11T00:00:00.000Z'),
        dormitory: {
          id: 'dasan',
          nameKo: '다산관',
          roomType: 2,
          genderPolicy: 'M',
          sortOrder: 2,
        },
      },
    ]);

    await expect(service.getSelectableDormitories('CHUNCHEON', 'M')).resolves.toEqual({
      campus: {
        code: 'CHUNCHEON',
        nameKo: '춘천캠퍼스',
        isOperated: true,
      },
      items: [
        { id: 'dasan', name: '다산관', roomType: 2, genderPolicy: 'M', isOperated: true },
        { id: 'saerom', name: '새롬관', roomType: 2, genderPolicy: 'BOTH', isOperated: true },
      ],
    });
    expect(seasonsService.getCurrentSeasonContext).toHaveBeenCalledWith('CHUNCHEON', undefined);
    expect(prisma.seasonDormitoryOperation.findMany).toHaveBeenCalled();
    const [firstCallArg] = (prisma.seasonDormitoryOperation.findMany.mock.calls[0] ?? []) as [
      unknown?,
    ];

    expect(firstCallArg).toMatchObject({
      where: {
        seasonId: 'season-1',
        isOperated: true,
      },
    });
  });

  it('current season이 없으면 selectable 목록은 빈 items를 반환한다', async () => {
    prisma.campusMaster.findUnique.mockResolvedValue({
      code: 'CHUNCHEON',
      nameKo: '춘천캠퍼스',
      isOperated: true,
    });
    seasonsService.getCurrentSeasonContext.mockResolvedValue(null);

    await expect(
      service.getSelectableDormitories('CHUNCHEON', 'M', new Date('2026-06-10T12:00:00+09:00')),
    ).resolves.toEqual({
      campus: {
        code: 'CHUNCHEON',
        nameKo: '춘천캠퍼스',
        isOperated: true,
      },
      items: [],
    });
    expect(prisma.seasonDormitoryOperation.findMany).not.toHaveBeenCalled();
  });

  it('current season row는 있으나 operated dormitory가 0개면 빈 items를 반환한다', async () => {
    prisma.campusMaster.findUnique.mockResolvedValue({
      code: 'CHUNCHEON',
      nameKo: '춘천캠퍼스',
      isOperated: true,
    });
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      season: { id: 'season-1' },
      state: 'SEASON_OPEN',
      operatedDormitories: [],
      schedule: {
        preparationStart: '2026-01-01',
        matchingStart: '2026-01-28',
        matchingEnd: '2026-01-28',
        seasonEnd: '2026-02-28',
      },
      isActive: true,
      isOpen: true,
      isMatching: false,
      isPostMatch: false,
      daysUntilMatchingEnd: 0,
      daysUntilSeasonEnd: 18,
      override: {
        active: false,
        state: null,
        reason: null,
        startedAt: null,
        endsAt: null,
      },
    });
    prisma.seasonDormitoryOperation.findMany.mockResolvedValue([]);

    await expect(service.getSelectableDormitories('CHUNCHEON', 'M')).resolves.toEqual({
      campus: {
        code: 'CHUNCHEON',
        nameKo: '춘천캠퍼스',
        isOperated: true,
      },
      items: [],
    });
    expect(prisma.seasonDormitoryOperation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          seasonId: 'season-1',
          isOperated: true,
          dormitory: {
            campusCode: 'CHUNCHEON',
            OR: [{ genderPolicy: 'M' }, { genderPolicy: 'BOTH' }],
          },
        },
      }),
    );
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

  it('season participant용 validation은 tx client와 compound key lookup을 사용한다', async () => {
    const tx = {
      seasonDormitoryOperation: {
        findUnique: jest.fn().mockResolvedValue({
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
        tx: tx as never,
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
