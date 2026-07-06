import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../platform/database/prisma.service.js', () => ({
  PrismaService: class PrismaService {},
}));
import { homeDashboardResponseSchema } from '@repo/shared/home';
import { HomeDashboardQuery } from './home-dashboard.query.js';
import { HomeDashboardCountsQuery } from './home-dashboard-counts.query.js';
import { HomeDashboardHistoryQuery } from './home-dashboard-history.query.js';
import { HomeDashboardNextSeasonQuery } from './home-dashboard-next-season.query.js';
import { HomeDashboardPresenter } from './home-dashboard.presenter.js';
import {
  makeCurrentUserResponse,
  makeSeasonContext,
} from '../test-support/home-dashboard.spec-fixtures.js';

const now = new Date('2026-02-10T03:00:00.000Z');
const authUser = {
  id: 'user-1',
  gender: 'M',
  campus: 'CHUNCHEON',
} as const;

function createPrismaMock() {
  return {
    getDatabaseNow: vi.fn().mockResolvedValue(now),
    season: {
      findMany: vi.fn(),
    },
    seasonParticipant: {
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    activeMatch: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    matchRequest: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    conversationThreadMember: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    conversationMessage: {
      count: vi.fn(),
    },
    seasonMatchHistoryEntry: {
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    seasonDormitoryOperation: {
      count: vi.fn(),
    },
  };
}

describe('HomeDashboardQuery', () => {
  const prisma = createPrismaMock();
  const currentUserViewService = {
    getCurrentUserAt: vi.fn(),
  };
  const seasonsService = {
    getCurrentSeasonContext: vi.fn(),
  };
  const countsQuery = new HomeDashboardCountsQuery(prisma as never);
  const historyQuery = new HomeDashboardHistoryQuery(prisma as never);
  const nextSeasonQuery = new HomeDashboardNextSeasonQuery(prisma as never);
  const query = new HomeDashboardQuery(
    prisma as never,
    currentUserViewService as never,
    seasonsService as never,
    countsQuery,
    historyQuery,
    nextSeasonQuery,
    new HomeDashboardPresenter(),
  );

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(now);
    prisma.season.findMany.mockResolvedValue([]);
    prisma.seasonParticipant.count.mockResolvedValue(0);
    prisma.activeMatch.count.mockResolvedValue(0);
    prisma.activeMatch.findMany.mockResolvedValue([]);
    prisma.matchRequest.count.mockResolvedValue(0);
    prisma.matchRequest.findMany.mockResolvedValue([]);
    prisma.conversationThreadMember.count.mockResolvedValue(0);
    prisma.conversationThreadMember.findMany.mockResolvedValue([]);
    prisma.conversationMessage.count.mockResolvedValue(0);
    prisma.seasonMatchHistoryEntry.count.mockResolvedValue(0);
    prisma.seasonMatchHistoryEntry.groupBy.mockResolvedValue([]);
    prisma.seasonDormitoryOperation.count.mockResolvedValue(0);
  });

  it('DB now 하나를 current-user/season/count composition에 주입한다', async () => {
    currentUserViewService.getCurrentUserAt.mockResolvedValue(makeCurrentUserResponse());
    seasonsService.getCurrentSeasonContext.mockResolvedValue(makeSeasonContext());
    prisma.seasonParticipant.findFirst.mockResolvedValue({
      id: 'participant-1',
      dormitoryId: 'dasan',
      registeredAt: now,
      dormitorySelectionState: 'ASSIGNED',
    });

    const response = await query.execute(authUser);

    expect(prisma.getDatabaseNow).toHaveBeenCalledTimes(1);
    expect(currentUserViewService.getCurrentUserAt).toHaveBeenCalledWith(authUser, now);
    expect(seasonsService.getCurrentSeasonContext).toHaveBeenCalledWith('CHUNCHEON', now);
    expect(homeDashboardResponseSchema.safeParse(response).success).toBe(true);
    expect(response.generatedAt).toBe(now.toISOString());
    expect(response.seasonHistorySummary.lastSeason).toBeNull();
    expect(response.nextSeasonPreview).toBeNull();
  });

  it('current season이 없으면 stats/matching을 fail-closed empty로 반환한다', async () => {
    currentUserViewService.getCurrentUserAt.mockResolvedValue(
      makeCurrentUserResponse({ seasonState: 'OFF_SEASON', registered: false, dormitoryId: null }),
    );
    seasonsService.getCurrentSeasonContext.mockResolvedValue(null);
    prisma.seasonParticipant.findFirst.mockResolvedValue(null);

    const response = await query.execute(authUser);

    expect(response.season).toMatchObject({
      hasCurrentSeason: false,
      state: 'OFF_SEASON',
      summary: null,
      schedule: null,
    });
    expect(response.stats.totalParticipants).toBe(0);
    expect(response.matching.pendingReceivedCount).toBe(0);
    expect(prisma.matchRequest.count).not.toHaveBeenCalled();
  });

  it('matching season에서는 pending request/read count와 user-facing aggregate를 조합한다', async () => {
    currentUserViewService.getCurrentUserAt.mockResolvedValue(makeCurrentUserResponse());
    seasonsService.getCurrentSeasonContext.mockResolvedValue(makeSeasonContext());
    prisma.seasonParticipant.findFirst.mockResolvedValue({
      id: 'participant-1',
      dormitoryId: 'dasan',
      registeredAt: now,
      dormitorySelectionState: 'ASSIGNED',
    });
    prisma.seasonParticipant.count.mockImplementation(
      ({
        where,
      }: {
        where: {
          dormitoryId?: unknown;
          registeredAt?: unknown;
          dormitorySelectionState?: unknown;
        };
      }) => {
        const registeredAt = where.registeredAt as Record<string, unknown> | undefined;
        const todayRange = Boolean(registeredAt && 'gte' in registeredAt);

        if (todayRange && where.dormitoryId === 'dasan') return Promise.resolve(1);
        if (todayRange) return Promise.resolve(2);
        if (where.dormitoryId === 'dasan') return Promise.resolve(4);
        if (where.dormitorySelectionState === 'ASSIGNED') return Promise.resolve(8);
        return Promise.resolve(10);
      },
    );
    prisma.activeMatch.count.mockResolvedValue(2);
    prisma.activeMatch.findMany.mockResolvedValue([
      {
        startedAt: now,
      },
    ]);
    prisma.matchRequest.count.mockImplementation(
      ({
        where,
      }: {
        where: { requesterParticipantId?: string; receiverParticipantId?: string };
      }) => {
        if (where.requesterParticipantId === 'participant-1') return Promise.resolve(1);
        if (where.receiverParticipantId === 'participant-1') return Promise.resolve(2);
        return Promise.resolve(0);
      },
    );
    prisma.matchRequest.findMany.mockResolvedValue([makeMatchRequestRecord()]);
    prisma.conversationThreadMember.count.mockResolvedValue(2);
    prisma.conversationThreadMember.findMany.mockResolvedValue([
      { threadId: 'thread-1', lastReadAt: new Date('2026-02-10T02:00:00.000Z') },
      { threadId: 'thread-2', lastReadAt: null },
    ]);
    prisma.conversationMessage.count.mockResolvedValueOnce(3).mockResolvedValueOnce(4);
    prisma.seasonMatchHistoryEntry.count.mockResolvedValue(1);

    const response = await query.execute(authUser);

    expect(response.stats).toMatchObject({
      totalParticipants: 10,
      assignedParticipants: 8,
      buildingTotal: 4,
      buildingMatchable: 3,
      todayNewTotal: 2,
      todayNewBuilding: 1,
      totalMatchSuccess: 4,
      buildingMatchSuccess: 2,
      todayMatchSuccessTotal: 4,
      todayMatchSuccessBuilding: 2,
    });
    expect(prisma.activeMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          seasonId: 'season-1',
          status: 'ACTIVE',
          endedAt: null,
          participantA: { dormitoryId: 'dasan' },
          participantB: { dormitoryId: 'dasan' },
        },
      }),
    );
    expect(response.matching).toMatchObject({
      pendingSentCount: 1,
      pendingReceivedCount: 2,
      activeChatThreadCount: 2,
      unreadMessageCount: 7,
    });
    expect(response.matching.recentReceivedRequests).toHaveLength(1);
    expect(response.viewer.capabilities.canViewMatchHistory).toBe(true);
    expect(response.viewer.identity.user.id).toBe('user-1');
  });
});

function makeMatchRequestRecord() {
  return {
    id: 'request-1',
    seasonId: 'season-1',
    requesterParticipantId: 'participant-2',
    receiverParticipantId: 'participant-1',
    status: 'PENDING',
    note: null,
    createdAt: new Date('2026-02-10T02:30:00.000Z'),
    expiresAt: new Date('2026-02-12T02:30:00.000Z'),
    terminalAt: null,
    acceptedAt: null,
    terminalReason: null,
    requesterParticipant: {
      userId: 'user-2',
      registeredAt: new Date('2026-02-10T01:00:00.000Z'),
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
      participationIntent: 'REGISTERED',
      participantStatus: 'ACTIVE',
      declinedAt: null,
      withdrawnAt: null,
      hiddenByAdminAt: null,
      deactivatedAt: null,
      user: { deletedAt: null },
      profile: {
        nicknameSnapshot: '상대방',
        intro: '안녕하세요',
        bedtime: 'BEFORE_22',
        wakeTime: 'BEFORE_07',
        sleepHabit: 'NONE',
        sleepEnvironment: 'QUIET',
        screenUsage: 'NONE',
        noiseSensitivity: 'NORMAL',
        smokingBehavior: 'NO',
        indoorEating: 'RARELY',
        phoneBehavior: 'RARELY',
        earphoneUsage: 'ALWAYS',
        cleanLevel: 'WHEN_DIRTY',
        drinkingFrequency: 'NONE',
        relationshipStyle: 'CASUAL',
        temperatureSensitivity: 'NORMAL',
      },
    },
    receiverParticipant: {
      userId: 'user-1',
      registeredAt: new Date('2026-02-10T01:00:00.000Z'),
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
      participationIntent: 'REGISTERED',
      participantStatus: 'ACTIVE',
      declinedAt: null,
      withdrawnAt: null,
      hiddenByAdminAt: null,
      deactivatedAt: null,
      user: { deletedAt: null },
      profile: null,
    },
  };
}
