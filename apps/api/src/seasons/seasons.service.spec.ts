import { SeasonsService } from './seasons.service.js';

function makeSeasonRow(
  overrides: Partial<{
    id: string;
    campusCode: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
    name: string;
    preparationStartDate: Date;
    matchingStartDate: Date;
    seasonEndDate: Date;
    overrideState:
      | 'OFF_SEASON'
      | 'SEASON_PREPARATION'
      | 'SEASON_MATCHING'
      | 'SEASON_POST_MATCH'
      | null;
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
        dormitoryId: 'irum',
        isOperated: true,
        roomSelectionDate: new Date('2026-02-12T00:00:00.000Z'),
      },
    ],
    ...overrides,
  };
}

describe('SeasonsService', () => {
  const prisma = {
    campusMaster: {
      findUnique: jest.fn(),
    },
    season: {
      findMany: jest.fn(),
    },
    $queryRawTyped: jest.fn(),
  };

  const service = new SeasonsService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.campusMaster.findUnique.mockResolvedValue({ isOperated: true });
    prisma.$queryRawTyped.mockResolvedValue([{ now: new Date('2026-02-10T03:00:00.000Z') }]);
  });

  it('캠퍼스별 현재 시즌과 운영 기숙사 메타를 반환한다', async () => {
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

    const result = await service.getCurrentSeason(
      'CHUNCHEON',
      new Date('2026-02-10T12:00:00+09:00'),
    );

    expect(result).toMatchObject({
      campusCode: 'CHUNCHEON',
      state: 'SEASON_MATCHING',
      isMatching: true,
      isPreparation: false,
      isPostMatch: false,
      daysUntilMatchingEnd: 3,
      daysUntilSeasonEnd: 19,
      season: {
        preparationStartDate: '2026-01-01',
        matchingStartDate: '2026-01-28',
        seasonEndDate: '2026-02-28',
      },
      operatedDormitories: [
        { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-02-11' },
        { dormitoryId: 'irum', isOperated: true, roomSelectionDate: '2026-02-12' },
      ],
      schedule: {
        preparationStart: '2026-01-01',
        matchingStart: '2026-01-28',
        matchingEnd: '2026-02-12',
        seasonEnd: '2026-02-28',
      },
    });
  });

  it('비운영 dormitory row는 operatedDormitories 응답에서 제외한다', async () => {
    prisma.season.findMany.mockResolvedValue([
      makeSeasonRow({
        dormitoryOperations: [
          {
            dormitoryId: 'dasan',
            isOperated: true,
            roomSelectionDate: new Date('2026-02-11T00:00:00.000Z'),
          },
          {
            dormitoryId: 'irum',
            isOperated: false,
            roomSelectionDate: new Date('2026-02-12T00:00:00.000Z'),
          },
        ],
      }),
    ]);

    const result = await service.getCurrentSeason(
      'CHUNCHEON',
      new Date('2026-02-10T12:00:00+09:00'),
    );

    expect(result?.operatedDormitories).toEqual([
      { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-02-11' },
    ]);
    expect(result?.schedule.matchingEnd).toBe('2026-02-11');
  });

  it('future season row만 있으면 current season은 null을 반환한다', async () => {
    prisma.season.findMany.mockResolvedValue([
      makeSeasonRow({
        id: 'season-2',
        name: '2026년 2학기',
        preparationStartDate: new Date('2026-07-01T00:00:00.000Z'),
        matchingStartDate: new Date('2026-08-18T00:00:00.000Z'),
        seasonEndDate: new Date('2026-08-31T00:00:00.000Z'),
      }),
      makeSeasonRow({
        id: 'season-3',
        name: '2027년 1학기',
        preparationStartDate: new Date('2027-01-01T00:00:00.000Z'),
        matchingStartDate: new Date('2027-01-25T00:00:00.000Z'),
        seasonEndDate: new Date('2027-02-28T00:00:00.000Z'),
      }),
    ]);

    await expect(
      service.getCurrentSeason('CHUNCHEON', new Date('2026-06-10T12:00:00+09:00')),
    ).resolves.toBeNull();
  });

  it('시즌이 없으면 null을 반환한다', async () => {
    prisma.season.findMany.mockResolvedValue([]);

    await expect(service.getCurrentSeason('SAMCHEOK')).resolves.toBeNull();
  });

  it('비운영 캠퍼스는 사용자용 current season 리소스를 제공하지 않는다', async () => {
    prisma.campusMaster.findUnique.mockResolvedValue({ isOperated: false });

    await expect(service.getCurrentSeason('SAMCHEOK')).resolves.toBeNull();
    expect(prisma.season.findMany).not.toHaveBeenCalled();
  });

  it('준비 기간에는 SEASON_PREPARATION을 반환한다', async () => {
    prisma.season.findMany.mockResolvedValue([makeSeasonRow()]);

    const result = await service.getCurrentSeason(
      'CHUNCHEON',
      new Date('2026-01-10T12:00:00+09:00'),
    );

    expect(result).toMatchObject({
      state: 'SEASON_PREPARATION',
      isPreparation: true,
      isMatching: false,
      isPostMatch: false,
    });
  });

  it('마지막 운영 기숙사 종료 뒤 seasonEnd 전에는 SEASON_POST_MATCH를 반환한다', async () => {
    prisma.season.findMany.mockResolvedValue([makeSeasonRow()]);

    const result = await service.getCurrentSeason(
      'CHUNCHEON',
      new Date('2026-02-20T12:00:00+09:00'),
    );

    expect(result).toMatchObject({
      state: 'SEASON_POST_MATCH',
      isPreparation: false,
      isMatching: false,
      isPostMatch: true,
      daysUntilMatchingEnd: 0,
      daysUntilSeasonEnd: 9,
    });
  });

  it('operated dormitory가 0개면 상태를 최대 SEASON_PREPARATION까지만 허용한다', async () => {
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

    const result = await service.getCurrentSeason(
      'CHUNCHEON',
      new Date('2026-02-10T12:00:00+09:00'),
    );

    expect(result).toMatchObject({
      state: 'SEASON_PREPARATION',
      isPreparation: true,
      isMatching: false,
      operatedDormitories: [],
      daysUntilMatchingEnd: 0,
    });
  });

  it('활성 override가 있으면 저장된 기간 대신 override state를 우선한다', async () => {
    prisma.season.findMany.mockResolvedValue([
      makeSeasonRow({
        overrideState: 'OFF_SEASON',
        overrideReason: '운영자 수동 비활성화',
        overrideStartedAt: new Date('2026-02-01T00:00:00+09:00'),
      }),
    ]);

    const result = await service.getCurrentSeason(
      'CHUNCHEON',
      new Date('2026-02-10T12:00:00+09:00'),
    );

    expect(result).toMatchObject({
      state: 'OFF_SEASON',
      isActive: false,
      override: {
        active: true,
        state: 'OFF_SEASON',
        reason: '운영자 수동 비활성화',
      },
    });
  });

  it('기숙사별 매칭 윈도우를 반환한다', async () => {
    prisma.season.findMany.mockResolvedValue([makeSeasonRow()]);

    const result = await service.getCurrentDormitoryMatchWindow(
      'CHUNCHEON',
      'dasan',
      new Date('2026-02-10T12:00:00+09:00'),
    );

    expect(result).toEqual({
      dormitoryId: 'dasan',
      matchingStartDate: '2026-01-28',
      matchingEndDate: '2026-02-11',
      canMatch: true,
    });
  });
});
