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
      findFirst: vi.fn(),
    },
    seasonParticipantProfileHistory: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    seasonMatchHistoryEntry: {
      count: vi.fn(),
      groupBy: vi.fn(),
      findFirst: vi.fn(),
    },
    seasonDormitoryOperation: {
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
    prisma.seasonParticipant.findFirst.mockResolvedValue(null);
    prisma.seasonParticipantProfileHistory.findMany.mockResolvedValue([]);
    prisma.seasonParticipantProfileHistory.count.mockResolvedValue(0);
    prisma.seasonMatchHistoryEntry.count.mockResolvedValue(0);
    prisma.seasonMatchHistoryEntry.groupBy.mockResolvedValue([]);
    prisma.seasonMatchHistoryEntry.findFirst.mockResolvedValue(null);
    prisma.seasonDormitoryOperation.count.mockResolvedValue(0);
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

  it('가장 최근 완료 시즌의 등록/성공 이력과 viewer activity aggregate를 반환한다', async () => {
    prisma.season.findMany.mockResolvedValue([
      makeSeasonRow({ id: 'future-season', end: '2026-12-20' }),
      makeSeasonRow({ id: 'last-season', name: '2026년 1학기', end: '2026-03-01' }),
      makeSeasonRow({ id: 'older-season', end: '2025-12-20' }),
    ]);
    prisma.seasonParticipant.findFirst.mockResolvedValue({ id: 'participant-viewer' });
    prisma.seasonParticipantProfileHistory.findMany.mockResolvedValue(
      Array.from({ length: 237 }, (_, index) => ({ participantId: `participant-${index}` })),
    );
    prisma.seasonParticipantProfileHistory.count.mockResolvedValue(1);
    prisma.seasonMatchHistoryEntry.count.mockImplementation(
      ({
        where,
      }: {
        where: {
          viewerParticipant?: { userId?: string };
          entryType?: string;
          entryResult?: string;
          viewerRequested?: boolean;
        };
      }) => {
        if (where.viewerParticipant?.userId === 'user-1') {
          if (where.entryType === 'REQUEST' && where.viewerRequested === true) {
            return Promise.resolve(2);
          }
          if (where.entryType === 'REQUEST' && where.viewerRequested === false) {
            return Promise.resolve(3);
          }
          if (where.entryType === 'MATCH' && where.entryResult === 'MATCHED_SUCCESS') {
            return Promise.resolve(1);
          }
          if (where.entryType === 'MATCH' && where.entryResult === 'UNMATCHED_AFTER_SUCCESS') {
            return Promise.resolve(0);
          }
          if (where.entryType === 'MATCH') {
            return Promise.resolve(1);
          }
          return Promise.resolve(0);
        }

        return Promise.resolve(where.entryResult === 'MATCHED_SUCCESS' ? 42 : 0);
      },
    );
    prisma.seasonMatchHistoryEntry.groupBy.mockResolvedValue([
      { pairKey: 'pair-1' },
      { pairKey: 'pair-2' },
      { pairKey: 'pair-3' },
    ]);
    prisma.seasonDormitoryOperation.count.mockResolvedValue(5);
    prisma.seasonMatchHistoryEntry.findFirst.mockResolvedValue({
      counterpartNicknameSnapshot: '상대방',
      counterpartRedactedAt: null,
    });

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
        viewerActivity: {
          sentRequestCount: 2,
          receivedRequestCount: 3,
          conversationCount: 1,
          finalResult: 'MATCHED',
          matchedPartnerNickname: '상대방',
        },
        aggregate: {
          matchedPairCount: 3,
          operatedDormitoryCount: 5,
        },
      },
    });
    expect(JSON.stringify(prisma.seasonParticipantProfileHistory.findMany.mock.calls)).toContain(
      '"source":"SEASON_REGISTRATION"',
    );
    expect(JSON.stringify(prisma.seasonParticipantProfileHistory.count.mock.calls)).toContain(
      '"participantId":"participant-viewer"',
    );
    expect(JSON.stringify(prisma.seasonMatchHistoryEntry.count.mock.calls)).toContain(
      '"entryResult":"MATCHED_SUCCESS"',
    );
    expect(JSON.stringify(prisma.seasonMatchHistoryEntry.count.mock.calls)).toContain(
      '"viewerRedactedAt":null',
    );
    expect(JSON.stringify(prisma.seasonMatchHistoryEntry.count.mock.calls)).toContain(
      '"entryType":"REQUEST"',
    );
    expect(JSON.stringify(prisma.seasonMatchHistoryEntry.count.mock.calls)).toContain(
      '"viewerRequested":true',
    );
    expect(JSON.stringify(prisma.seasonMatchHistoryEntry.groupBy.mock.calls)).toContain(
      '"pairKey"',
    );
    expect(JSON.stringify(prisma.seasonMatchHistoryEntry.findFirst.mock.calls)).toContain(
      '"counterpartNicknameSnapshot"',
    );
    expect(JSON.stringify(prisma.seasonDormitoryOperation.count.mock.calls)).toContain(
      '"isOperated":true',
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
