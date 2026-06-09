import { resolveCampusServiceState } from './campus-service-state.query.js';

const NOW = new Date('2026-06-01T00:00:00.000Z');

describe('resolveCampusServiceState', () => {
  it('비운영 campus는 season context 조회 없이 closed state를 반환한다', async () => {
    const prisma = {
      campusMaster: {
        findUnique: jest.fn().mockResolvedValue({ isOperated: false }),
      },
    };
    const seasonsService = {
      getCurrentSeasonContext: jest.fn(),
    };

    await expect(
      resolveCampusServiceState(prisma as never, seasonsService as never, 'CHUNCHEON', NOW),
    ).resolves.toEqual({
      campusOperated: false,
      seasonState: null,
      seasonContext: null,
    });
    expect(prisma.campusMaster.findUnique).toHaveBeenCalledWith({
      where: { code: 'CHUNCHEON' },
      select: { isOperated: true },
    });
    expect(seasonsService.getCurrentSeasonContext).not.toHaveBeenCalled();
  });

  it('운영 campus에 current season이 없으면 OFF_SEASON segment를 반환한다', async () => {
    const prisma = {
      campusMaster: {
        findUnique: jest.fn().mockResolvedValue({ isOperated: true }),
      },
    };
    const seasonsService = {
      getCurrentSeasonContext: jest.fn().mockResolvedValue(null),
    };

    await expect(
      resolveCampusServiceState(prisma as never, seasonsService as never, 'CHUNCHEON', NOW),
    ).resolves.toEqual({
      campusOperated: true,
      seasonState: 'OFF_SEASON',
      seasonContext: null,
    });
    expect(seasonsService.getCurrentSeasonContext).toHaveBeenCalledWith('CHUNCHEON', NOW);
  });

  it('운영 campus에 current season이 있으면 season context state를 그대로 반환한다', async () => {
    const seasonContext = {
      state: 'SEASON_OPEN',
      season: { id: 'season-1' },
      schedule: { seasonEnd: '2026-06-30' },
    };
    const prisma = {
      campusMaster: {
        findUnique: jest.fn().mockResolvedValue({ isOperated: true }),
      },
    };
    const seasonsService = {
      getCurrentSeasonContext: jest.fn().mockResolvedValue(seasonContext),
    };

    await expect(
      resolveCampusServiceState(prisma as never, seasonsService as never, 'CHUNCHEON', NOW),
    ).resolves.toEqual({
      campusOperated: true,
      seasonState: 'SEASON_OPEN',
      seasonContext,
    });
  });
});
