import { SeasonsService } from './seasons.service.js';

describe('SeasonsService', () => {
  const prisma = {
    season: {
      findMany: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
  };

  const service = new SeasonsService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$queryRawUnsafe.mockResolvedValue([{ now: new Date('2026-04-12T03:00:00.000Z') }]);
  });

  it('현재 또는 예정 시즌을 선택해 3-state 응답을 계산한다', async () => {
    prisma.season.findMany.mockResolvedValue([
      {
        id: 'season-1',
        name: '2026년 1학기',
        roomSelectionDate: new Date('2026-04-30T00:00:00.000Z'),
        openStartDate: new Date('2026-03-26T00:00:00.000Z'),
        matchStartDate: new Date('2026-04-02T00:00:00.000Z'),
        matchEndDate: new Date('2026-04-30T00:00:00.000Z'),
        overrideState: null,
        overrideReason: null,
        overrideStartedAt: null,
        overrideEndsAt: null,
      },
      {
        id: 'season-2',
        name: '2026년 2학기',
        roomSelectionDate: new Date('2026-10-30T00:00:00.000Z'),
        openStartDate: new Date('2026-09-25T00:00:00.000Z'),
        matchStartDate: new Date('2026-10-02T00:00:00.000Z'),
        matchEndDate: new Date('2026-10-30T00:00:00.000Z'),
        overrideState: null,
        overrideReason: null,
        overrideStartedAt: null,
        overrideEndsAt: null,
      },
    ]);

    const result = await service.getCurrentSeason(new Date('2026-04-12T00:00:00+09:00'));

    expect(result).toMatchObject({
      state: 'SEASON_MATCHING',
      isActive: true,
      isMatching: true,
      schedule: {
        openStart: '2026-03-26',
        matchStart: '2026-04-02',
        matchEnd: '2026-04-30',
      },
      nextSeason: {
        id: 'season-2',
        name: '2026년 2학기',
        roomSelectionDate: '2026-10-30',
      },
    });
  });

  it('시즌이 없으면 null을 반환한다', async () => {
    prisma.season.findMany.mockResolvedValue([]);

    await expect(service.getCurrentSeason()).resolves.toBeNull();
  });

  it('비시즌에는 다음 시즌 메타로 예정 시즌 자체를 반환한다', async () => {
    prisma.season.findMany.mockResolvedValue([
      {
        id: 'season-1',
        name: '2026년 1학기',
        roomSelectionDate: new Date('2026-04-30T00:00:00.000Z'),
        openStartDate: new Date('2026-03-26T00:00:00.000Z'),
        matchStartDate: new Date('2026-04-02T00:00:00.000Z'),
        matchEndDate: new Date('2026-04-30T00:00:00.000Z'),
        overrideState: null,
        overrideReason: null,
        overrideStartedAt: null,
        overrideEndsAt: null,
      },
    ]);

    const result = await service.getCurrentSeason(new Date('2026-02-01T00:00:00+09:00'));

    expect(result).toMatchObject({
      state: 'OFF_SEASON',
      nextSeason: {
        id: 'season-1',
        name: '2026년 1학기',
        roomSelectionDate: '2026-04-30',
      },
    });
  });

  it('명시적 운영 일정이 있으면 roomSelectionDate 공식보다 저장 일정을 우선한다', async () => {
    prisma.season.findMany.mockResolvedValue([
      {
        id: 'season-1',
        name: '2026년 1학기',
        roomSelectionDate: new Date('2026-04-30T00:00:00.000Z'),
        openStartDate: new Date('2026-03-20T00:00:00.000Z'),
        matchStartDate: new Date('2026-04-05T00:00:00.000Z'),
        matchEndDate: new Date('2026-05-02T00:00:00.000Z'),
        overrideState: null,
        overrideReason: null,
        overrideStartedAt: null,
        overrideEndsAt: null,
      },
    ]);

    const result = await service.getCurrentSeason(new Date('2026-04-04T12:00:00+09:00'));

    expect(result).toMatchObject({
      state: 'SEASON_OPEN',
      schedule: {
        openStart: '2026-03-20',
        matchStart: '2026-04-05',
        matchEnd: '2026-05-02',
      },
    });
  });

  it('활성 override가 있으면 저장 일정 대신 override state를 우선한다', async () => {
    prisma.season.findMany.mockResolvedValue([
      {
        id: 'season-1',
        name: '2026년 1학기',
        roomSelectionDate: new Date('2026-04-30T00:00:00.000Z'),
        openStartDate: new Date('2026-03-26T00:00:00.000Z'),
        matchStartDate: new Date('2026-04-02T00:00:00.000Z'),
        matchEndDate: new Date('2026-04-30T00:00:00.000Z'),
        overrideState: 'OFF_SEASON',
        overrideReason: '운영자 수동 비활성화',
        overrideStartedAt: new Date('2026-04-10T00:00:00+09:00'),
        overrideEndsAt: null,
      },
    ]);

    const result = await service.getCurrentSeason(new Date('2026-04-12T12:00:00+09:00'));

    expect(result).toMatchObject({
      state: 'OFF_SEASON',
      isActive: false,
      isOpen: false,
      isMatching: false,
      daysUntilEnd: 0,
      schedule: {
        matchStart: '2026-04-02',
        matchEnd: '2026-04-30',
      },
    });
  });

  it('다른 도메인이 쓸 현재 시즌 context와 override 메타를 제공한다', async () => {
    prisma.season.findMany.mockResolvedValue([
      {
        id: 'season-1',
        name: '2026년 1학기',
        roomSelectionDate: new Date('2026-04-30T00:00:00.000Z'),
        openStartDate: new Date('2026-03-26T00:00:00.000Z'),
        matchStartDate: new Date('2026-04-02T00:00:00.000Z'),
        matchEndDate: new Date('2026-04-30T00:00:00.000Z'),
        overrideState: 'OFF_SEASON',
        overrideReason: '테스트 override',
        overrideStartedAt: new Date('2026-04-10T00:00:00+09:00'),
        overrideEndsAt: null,
      },
    ]);

    const context = await service.getCurrentSeasonContext(new Date('2026-04-12T12:00:00+09:00'));

    expect(context).toMatchObject({
      state: 'OFF_SEASON',
      override: {
        active: true,
        state: 'OFF_SEASON',
        reason: '테스트 override',
      },
    });
  });

  it('편의 인터페이스로 현재 시즌 상태를 조회할 수 있다', async () => {
    prisma.season.findMany.mockResolvedValue([
      {
        id: 'season-1',
        name: '2026년 1학기',
        roomSelectionDate: new Date('2026-04-30T00:00:00.000Z'),
        openStartDate: new Date('2026-03-26T00:00:00.000Z'),
        matchStartDate: new Date('2026-04-02T00:00:00.000Z'),
        matchEndDate: new Date('2026-04-30T00:00:00.000Z'),
        overrideState: null,
        overrideReason: null,
        overrideStartedAt: null,
        overrideEndsAt: null,
      },
    ]);

    await expect(
      service.getCurrentSeasonState(new Date('2026-04-12T12:00:00+09:00')),
    ).resolves.toBe('SEASON_MATCHING');
    await expect(
      service.isCurrentSeasonMatching(new Date('2026-04-12T12:00:00+09:00')),
    ).resolves.toBe(true);
  });

  it('기준 시각을 넘기지 않으면 DB current timestamp를 사용한다', async () => {
    prisma.season.findMany.mockResolvedValue([
      {
        id: 'season-1',
        name: '2026년 1학기',
        roomSelectionDate: new Date('2026-04-30T00:00:00.000Z'),
        openStartDate: new Date('2026-03-26T00:00:00.000Z'),
        matchStartDate: new Date('2026-04-02T00:00:00.000Z'),
        matchEndDate: new Date('2026-04-30T00:00:00.000Z'),
        overrideState: null,
        overrideReason: null,
        overrideStartedAt: null,
        overrideEndsAt: null,
      },
    ]);

    await expect(service.getCurrentSeasonState()).resolves.toBe('SEASON_MATCHING');
    expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
  });
});
