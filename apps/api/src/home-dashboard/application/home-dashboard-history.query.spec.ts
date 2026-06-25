import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../platform/database/prisma.service.js', () => ({
  PrismaService: class PrismaService {},
}));
import { HomeDashboardHistoryQuery } from './home-dashboard-history.query.js';

const now = new Date('2026-06-25T03:00:00.000Z');

function createPrismaMock() {
  return {
    season: {
      findMany: vi.fn(),
    },
    seasonParticipant: {
      count: vi.fn(),
    },
    seasonMatchHistoryEntry: {
      count: vi.fn(),
    },
  };
}

describe('HomeDashboardHistoryQuery', () => {
  const prisma = createPrismaMock();
  const query = new HomeDashboardHistoryQuery(prisma as never);

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.season.findMany.mockResolvedValue([]);
    prisma.seasonParticipant.count.mockResolvedValue(0);
    prisma.seasonMatchHistoryEntry.count.mockResolvedValue(0);
  });

  it('비운영 campus는 과거 시즌 요약을 노출하지 않는다', async () => {
    await expect(
      query.getSeasonHistorySummary({
        campusCode: 'SAMCHEOK',
        userId: 'user-1',
        now,
        campusOperated: false,
      }),
    ).resolves.toEqual({ lastSeason: null });

    expect(prisma.season.findMany).not.toHaveBeenCalled();
  });

  it('가장 최근 완료 시즌의 등록/성공 이력과 viewer boolean만 반환한다', async () => {
    prisma.season.findMany.mockResolvedValue([
      makeSeasonRow({ id: 'future-season', end: '2026-12-20' }),
      makeSeasonRow({ id: 'last-season', name: '2026년 1학기', end: '2026-03-01' }),
      makeSeasonRow({ id: 'older-season', end: '2025-12-20' }),
    ]);
    prisma.seasonParticipant.count.mockImplementation(({ where }: { where: { userId?: string } }) =>
      Promise.resolve(where.userId === 'user-1' ? 1 : 237),
    );
    prisma.seasonMatchHistoryEntry.count.mockImplementation(
      ({ where }: { where: { viewerParticipant?: { userId?: string }; entryResult?: string } }) =>
        Promise.resolve(
          where.viewerParticipant?.userId === 'user-1'
            ? 1
            : where.entryResult === 'MATCHED_SUCCESS'
              ? 42
              : 0,
        ),
    );

    const summary = await query.getSeasonHistorySummary({
      campusCode: 'CHUNCHEON',
      userId: 'user-1',
      now,
      campusOperated: true,
    });

    expect(summary).toEqual({
      lastSeason: {
        id: 'last-season',
        name: '2026년 1학기',
        totalParticipants: 237,
        totalMatchSuccess: 42,
        viewerHadRegistration: true,
        viewerHadMatchSuccess: true,
      },
    });
    expect(JSON.stringify(prisma.seasonParticipant.count.mock.calls)).toContain(
      '"seasonId":"last-season"',
    );
    expect(JSON.stringify(prisma.seasonParticipant.count.mock.calls)).toContain(
      '"registeredAt":{"not":null}',
    );
    expect(JSON.stringify(prisma.seasonMatchHistoryEntry.count.mock.calls)).toContain(
      '"entryResult":"MATCHED_SUCCESS"',
    );
    expect(JSON.stringify(prisma.seasonMatchHistoryEntry.count.mock.calls)).toContain(
      '"viewerRedactedAt":null',
    );
  });
});

function makeSeasonRow({ id, name = '시즌', end }: { id: string; name?: string; end: string }) {
  return {
    id,
    name,
    preparationStartDate: new Date('2026-01-01T00:00:00.000Z'),
    matchingStartDate: new Date('2026-02-01T00:00:00.000Z'),
    seasonEndDate: new Date(`${end}T00:00:00.000Z`),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}
