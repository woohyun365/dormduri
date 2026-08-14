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
import { toMatchRequestSummary } from '../../matches/requests/presenters/match-request.presenter.js';
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
    seasonParticipantProfileHistory: {
      findMany: vi.fn(),
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
  const matchOverviewQuery = {
    executeAt: vi.fn(),
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
    matchOverviewQuery as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(now);
    prisma.season.findMany.mockResolvedValue([]);
    prisma.seasonParticipant.count.mockResolvedValue(0);
    prisma.seasonParticipantProfileHistory.findMany.mockResolvedValue([]);
    prisma.seasonParticipantProfileHistory.count.mockResolvedValue(0);
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
    matchOverviewQuery.executeAt.mockResolvedValue({ sentRequests: [], receivedRequests: [] });
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
    prisma.seasonParticipantProfileHistory.findMany.mockResolvedValue([
      { participantId: 'participant-1' },
    ]);

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
    prisma.seasonParticipantProfileHistory.findMany.mockResolvedValue([
      { participantId: 'participant-1' },
      { participantId: 'participant-2' },
      { participantId: 'participant-3' },
      { participantId: 'participant-4' },
      { participantId: 'participant-5' },
      { participantId: 'participant-6' },
      { participantId: 'participant-7' },
      { participantId: 'participant-8' },
      { participantId: 'participant-9' },
      { participantId: 'participant-10' },
    ]);
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
    const receivedRequest = toMatchRequestSummary(makeMatchRequestRecord(), 'participant-1');
    const secondReceivedRequest = { ...receivedRequest, id: 'request-2' };
    const sentRequest = toMatchRequestSummary(
      {
        ...makeMatchRequestRecord(),
        id: 'request-sent',
        requesterParticipantId: 'participant-1',
        receiverParticipantId: 'participant-2',
      },
      'participant-1',
    );
    matchOverviewQuery.executeAt.mockResolvedValue({
      sentRequests: [sentRequest],
      receivedRequests: [receivedRequest, secondReceivedRequest],
    });
    prisma.conversationThreadMember.count.mockResolvedValue(2);
    prisma.conversationThreadMember.findMany.mockResolvedValue([
      { threadId: 'thread-1', lastReadAt: new Date('2026-02-10T02:00:00.000Z') },
      { threadId: 'thread-2', lastReadAt: null },
    ]);
    prisma.conversationMessage.count.mockResolvedValueOnce(3).mockResolvedValueOnce(4);
    prisma.seasonMatchHistoryEntry.count.mockResolvedValue(1);

    const response = await query.execute(authUser);

    expect(response.stats).toMatchObject({
      totalParticipants: 8,
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
    const activeMatchQuery = prisma.activeMatch.findMany.mock.calls[0]?.[0] as unknown as {
      where: {
        seasonId: string;
        status: string;
        endedAt: Date | null;
        participantA: { dormitoryId?: string };
        participantB: { dormitoryId?: string };
      };
    };
    expect(activeMatchQuery.where).toMatchObject({
      seasonId: 'season-1',
      status: 'ACTIVE',
      endedAt: null,
    });
    expect(activeMatchQuery.where.participantA).toMatchObject({ dormitoryId: 'dasan' });
    expect(activeMatchQuery.where.participantB).toMatchObject({ dormitoryId: 'dasan' });
    expect(response.matching).toMatchObject({
      pendingSentCount: 1,
      pendingReceivedCount: 2,
      activeChatThreadCount: 2,
      unreadMessageCount: 7,
    });
    expect(response.matching.recentReceivedRequests).toHaveLength(2);
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
    status: 'PENDING' as const,
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
        smokingTolerance: 'NO_ONLY',
        indoorEatingTolerance: 'NO_SMELL',
        phoneTolerance: 'BRIEF_OK',
        earphoneExpectation: 'MUST',
        cleanExpectation: 'STRICT',
        drinkingTolerance: 'LOW_ONLY',
        sleepEnvPreference: 'NO_SPEAKER',
        screenTolerance: 'LOW_OK',
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
  } satisfies Parameters<typeof toMatchRequestSummary>[0];
}
