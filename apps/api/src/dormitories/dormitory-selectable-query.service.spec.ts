import { DormitorySelectableQueryService } from './dormitory-selectable-query.service.js';

function makeSeasonRow(
  overrides: Partial<{
    id: string;
    campusCode: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
    name: string;
    preparationStartDate: Date;
    matchingStartDate: Date;
    seasonEndDate: Date;
    overrideState: 'OFF_SEASON' | 'SEASON_OPEN' | 'SEASON_MATCHING' | 'SEASON_POST_MATCH' | null;
    overrideReason: string | null;
    overrideStartedAt: Date | null;
    overrideEndsAt: Date | null;
    dormitoryOperations: Array<{
      dormitoryId: string;
      isOperated: boolean;
      roomSelectionDate: Date;
    }>;
  }> = {},
) {
  return {
    id: 'season-1',
    campusCode: 'CHUNCHEON' as const,
    name: '2026년 1학기',
    preparationStartDate: new Date('2026-01-01T00:00:00.000Z'),
    matchingStartDate: new Date('2026-01-28T00:00:00.000Z'),
    seasonEndDate: new Date('2026-02-28T00:00:00.000Z'),
    overrideState: null,
    overrideReason: null,
    overrideStartedAt: null,
    overrideEndsAt: null,
    dormitoryOperations: [
      {
        dormitoryId: 'dasan',
        isOperated: true,
        roomSelectionDate: new Date('2026-02-11T00:00:00.000Z'),
      },
      {
        dormitoryId: 'saerom',
        isOperated: true,
        roomSelectionDate: new Date('2026-02-12T00:00:00.000Z'),
      },
    ],
    ...overrides,
  };
}

describe('DormitorySelectableQueryService', () => {
  const prisma = {
    campusMaster: {
      findUnique: jest.fn(),
    },
    season: {
      findMany: jest.fn(),
    },
    seasonDormitoryOperation: {
      findMany: jest.fn(),
    },
    $queryRawTyped: jest.fn(),
  };

  const service = new DormitorySelectableQueryService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$queryRawTyped.mockResolvedValue([{ now: new Date('2026-02-10T03:00:00.000Z') }]);
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
    expect(prisma.season.findMany).not.toHaveBeenCalled();
  });

  it('current season의 운영 기숙사만 selectable 목록으로 반환한다', async () => {
    prisma.campusMaster.findUnique.mockResolvedValue({
      code: 'CHUNCHEON',
      nameKo: '춘천캠퍼스',
      isOperated: true,
    });
    prisma.season.findMany.mockResolvedValue([
      makeSeasonRow(),
      makeSeasonRow({
        id: 'season-2',
        name: '2026년 2학기',
        preparationStartDate: new Date('2026-07-01T00:00:00.000Z'),
        matchingStartDate: new Date('2026-08-18T00:00:00.000Z'),
        seasonEndDate: new Date('2026-08-31T00:00:00.000Z'),
      }),
    ]);
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
    expect(prisma.seasonDormitoryOperation.findMany).toHaveBeenCalled();
    const seasonDormitoryFindMany = prisma.seasonDormitoryOperation.findMany;
    const [firstCallArg] = (seasonDormitoryFindMany.mock.calls[0] ?? []) as [unknown?];

    expect(firstCallArg).toMatchObject({
      where: {
        seasonId: 'season-1',
        isOperated: true,
      },
    });
  });

  it('future season row만 있으면 selectable 목록은 빈 items를 반환한다', async () => {
    prisma.campusMaster.findUnique.mockResolvedValue({
      code: 'CHUNCHEON',
      nameKo: '춘천캠퍼스',
      isOperated: true,
    });
    prisma.season.findMany.mockResolvedValue([
      makeSeasonRow({
        id: 'season-2',
        name: '2026년 2학기',
        preparationStartDate: new Date('2026-07-01T00:00:00.000Z'),
        matchingStartDate: new Date('2026-08-18T00:00:00.000Z'),
        seasonEndDate: new Date('2026-08-31T00:00:00.000Z'),
      }),
    ]);

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
    prisma.season.findMany.mockResolvedValue([
      makeSeasonRow({
        dormitoryOperations: [
          {
            dormitoryId: 'dasan',
            isOperated: false,
            roomSelectionDate: new Date('2026-02-11T00:00:00.000Z'),
          },
        ],
      }),
    ]);
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
