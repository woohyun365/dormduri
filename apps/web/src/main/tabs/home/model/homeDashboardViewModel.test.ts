import { describe, expect, it } from 'vitest';
import { createHomeDashboardTestResponse } from '@/main/test-support/home-dashboard.builder';
import {
  buildHomeDashboardViewModel,
  toHomeActiveMatch,
  toHomeSeasonContext,
} from './homeDashboardViewModel';
import type { MatchRequestSummary } from '@repo/shared/match/contract';

function createReceivedRequest(overrides: Partial<MatchRequestSummary> = {}): MatchRequestSummary {
  return {
    id: 'request-1',
    seasonId: 'season-2026-1',
    direction: 'RECEIVED',
    counterpartUserId: 'user-2',
    counterpartParticipantId: 'participant-2',
    counterpartSummary: {
      id: 'profile-2',
      sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
      relation: { type: 'GENERAL' },
      exposure: {
        listSummaryVisible: true,
        detailViewable: true,
        canViewFull: true,
        scoreVisible: true,
      },
      actions: {
        canBookmark: true,
        canRequestMatch: true,
        canStartChat: true,
        unavailableReasons: [],
      },
      resultRead: {
        resultReadable: false,
        context: 'NONE',
      },
      profileSummary: {
        nickname: '요청자',
        intro: '안녕하세요',
        smokingBehavior: 'NO',
        sleepHabit: 'NONE',
        relationshipStyle: 'CASUAL',
      },
    },
    status: 'PENDING',
    note: null,
    createdAt: '2026-03-29T00:00:00.000Z',
    expiresAt: '2026-06-23T12:00:00.000Z',
    terminalAt: null,
    acceptedAt: null,
    terminalReason: null,
    ...overrides,
  };
}

describe('homeDashboardViewModel', () => {
  it('maps dashboard season context without legacy widget calls', () => {
    const dashboard = createHomeDashboardTestResponse();
    const context = toHomeSeasonContext(dashboard, {
      season: { name: 'fallback', roomSelectionDate: '2099-01-01' },
      state: 'OFF_SEASON',
      isOpen: false,
      isMatching: false,
      daysUntilEnd: 0,
    });

    expect(context).toEqual({
      season: { name: '2026년 1학기', roomSelectionDate: '2026-04-30' },
      state: 'SEASON_OPEN',
      isOpen: true,
      isMatching: false,
      daysUntilEnd: 30,
    });
  });

  it('keeps fallback season context when dashboard has no current season', () => {
    const dashboard = createHomeDashboardTestResponse({
      season: {
        hasCurrentSeason: false,
        state: null,
        summary: null,
        schedule: null,
        isOpen: false,
        isMatching: false,
        isPostMatch: false,
        daysUntilMatchingEnd: null,
        daysUntilSeasonEnd: null,
      },
    });
    const fallback = {
      season: { name: 'fallback', roomSelectionDate: '2099-01-01' },
      state: 'OFF_SEASON' as const,
      isOpen: false,
      isMatching: false,
      daysUntilEnd: 0,
    };

    expect(toHomeSeasonContext(dashboard, fallback)).toEqual(fallback);
  });

  it('builds matching summary from dashboard counts and recent received request names', () => {
    const dashboard = createHomeDashboardTestResponse({
      season: {
        ...createHomeDashboardTestResponse().season,
        state: 'SEASON_MATCHING',
        isOpen: false,
        isMatching: true,
      },
      matching: {
        ...createHomeDashboardTestResponse().matching,
        pendingSentCount: 1,
        pendingReceivedCount: 1,
        recentReceivedRequests: [createReceivedRequest()],
      },
    });

    const viewModel = buildHomeDashboardViewModel({
      dashboard,
      season: { name: '2026년 1학기', roomSelectionDate: '2026-04-30' },
      seasonState: 'SEASON_MATCHING',
      daysUntilEnd: 7,
      renderedAt: new Date('2026-06-22T00:00:00.000Z').getTime(),
    });

    expect(viewModel.hasCurrentSeason).toBe(true);
    expect(viewModel.matchingSummary.status).toBe('HAS_ACTIVITY');
    expect(viewModel.matchingSummary.stats).toMatchObject({
      sentRequests: 1,
      receivedRequests: 1,
      activeChats: 0,
      expiringCount: 1,
    });
    expect(viewModel.matchingSummary.receivedRequesters).toEqual(['요청자']);
    expect(viewModel.tip.unreadMessages).toBe(3);
  });

  it('uses dashboard selection as the Home building source of truth', () => {
    const dashboard = createHomeDashboardTestResponse({
      viewer: {
        ...createHomeDashboardTestResponse().viewer,
        selection: {
          state: 'SELECTED',
          dormitoryId: 'dasan',
          source: 'SEASON_PARTICIPANT',
        },
      },
    });
    const viewModel = buildHomeDashboardViewModel({
      dashboard,
      season: { name: '2026년 1학기', roomSelectionDate: '2026-04-30' },
      seasonState: 'SEASON_OPEN',
      daysUntilEnd: 30,
      renderedAt: new Date('2026-03-01T00:00:00.000Z').getTime(),
    });

    expect(viewModel.isUnassigned).toBe(false);
    expect(viewModel.dormitory?.name).toBe('다산관');
    expect(viewModel.preparation.hasBuilding).toBe(true);
  });

  it('treats ASSIGNED dashboard selection as an assigned Home building state', () => {
    const dashboard = createHomeDashboardTestResponse({
      viewer: {
        ...createHomeDashboardTestResponse().viewer,
        selection: {
          state: 'ASSIGNED',
          dormitoryId: 'dasan',
          source: 'SEASON_PARTICIPANT',
        },
      },
    });

    const viewModel = buildHomeDashboardViewModel({
      dashboard,
      season: { name: '2026년 1학기', roomSelectionDate: '2026-04-30' },
      seasonState: 'SEASON_MATCHING',
      daysUntilEnd: 7,
      renderedAt: new Date('2026-04-01T00:00:00.000Z').getTime(),
    });

    expect(viewModel.isUnassigned).toBe(false);
    expect(viewModel.dormitory?.name).toBe('다산관');
    expect(viewModel.matchingSummary.gatingReason).toBeNull();
  });

  it('keeps not-operated campus status from masking as a no-building gate', () => {
    const dashboard = createHomeDashboardTestResponse({
      viewer: {
        ...createHomeDashboardTestResponse().viewer,
        campusOperated: false,
        selection: {
          state: 'NOT_SELECTED',
          dormitoryId: null,
          source: null,
        },
      },
    });

    const viewModel = buildHomeDashboardViewModel({
      dashboard,
      season: { name: '2026년 1학기', roomSelectionDate: '2026-04-30' },
      seasonState: 'SEASON_MATCHING',
      daysUntilEnd: 7,
      renderedAt: new Date('2026-04-01T00:00:00.000Z').getTime(),
    });

    expect(viewModel.isCampusOperated).toBe(false);
    expect(viewModel.matchingSummary.status).toBe('NOT_OPERATED');
    expect(viewModel.matchingSummary.gatingReason).toBeNull();
    expect(viewModel.tip.seasonStatus).toBe('NOT_OPERATED');
  });

  it('uses visible next-season preview even when there is no current season schedule', () => {
    const dashboard = createHomeDashboardTestResponse({
      season: {
        hasCurrentSeason: false,
        state: null,
        summary: null,
        schedule: null,
        isOpen: false,
        isMatching: false,
        isPostMatch: false,
        daysUntilMatchingEnd: null,
        daysUntilSeasonEnd: null,
      },
    });

    const viewModel = buildHomeDashboardViewModel({
      dashboard,
      season: { name: '2026년 1학기', roomSelectionDate: '2026-04-30' },
      seasonState: 'OFF_SEASON',
      daysUntilEnd: 0,
      renderedAt: new Date('2026-07-01T00:00:00.000Z').getTime(),
    });

    expect(viewModel.hasCurrentSeason).toBe(false);
    expect(viewModel.seasonSummary).toMatchObject({
      daysUntilNext: 50,
      nextSeasonDate: '2026.08.20',
      nextSeasonName: '2026년 2학기',
    });
  });

  it('keeps post-match stats focused on result-read summary counts', () => {
    const dashboard = createHomeDashboardTestResponse({
      season: {
        ...createHomeDashboardTestResponse().season,
        state: 'SEASON_POST_MATCH',
        isOpen: false,
        isMatching: false,
        isPostMatch: true,
      },
      stats: {
        ...createHomeDashboardTestResponse().stats,
        assignedParticipants: 190,
        totalMatchSuccess: 42,
        buildingMatchSuccess: 12,
      },
    });

    const viewModel = buildHomeDashboardViewModel({
      dashboard,
      season: { name: '2026년 1학기', roomSelectionDate: '2026-04-30' },
      seasonState: 'SEASON_POST_MATCH',
      daysUntilEnd: 0,
      renderedAt: new Date('2026-05-01T00:00:00.000Z').getTime(),
    });

    expect(viewModel.statsBar.totalCount).toBe(190);
    expect(viewModel.statsBar.matchSuccessCount).toBe(42);
  });

  it('maps active match summary to Home active match view state', () => {
    const dashboard = createHomeDashboardTestResponse({
      viewer: {
        ...createHomeDashboardTestResponse().viewer,
        match: {
          hasActiveMatch: true,
          activeMatch: {
            id: 'match-1',
            seasonId: 'season-2026-1',
            counterpartUserId: 'user-2',
            counterpartParticipantId: 'participant-2',
            counterpartNickname: '상대방',
            status: 'ACTIVE',
            startedAt: '2026-04-01T00:00:00.000Z',
            endedAt: null,
            endReason: null,
            createdFromRequestId: 'request-1',
            matchScore: 88,
            unmatchProgress: {
              state: 'NONE',
              requestedByViewerAt: null,
              requestedByCounterpartAt: null,
              progressCount: 0,
              requiredCount: 2,
              canRequest: true,
              canCancel: false,
              availableUntil: null,
            },
          },
        },
      },
    });

    expect(toHomeActiveMatch(dashboard)).toMatchObject({
      matchId: 'match-1',
      partnerNickname: '상대방',
      matchScore: 88,
      scoreType: 'full',
    });
  });
});
