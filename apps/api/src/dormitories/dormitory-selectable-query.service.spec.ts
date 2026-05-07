import { DormitorySelectableQueryService } from './dormitory-selectable-query.service.js';

describe('DormitorySelectableQueryService', () => {
  const prisma = {
    campusMaster: {
      findUnique: jest.fn(),
    },
    seasonDormitoryOperation: {
      findMany: jest.fn(),
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
});
