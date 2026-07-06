import { describe, expect, it } from 'vitest';
import { createHomeDashboardTestResponse } from '@/main/test-support/home-dashboard.builder';
import { buildHomeDashboardViewModel, toHomeActiveMatch } from './homeDashboardViewModel';
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
  it('derives Home season runtime only from dashboard response', () => {
    const dashboard = createHomeDashboardTestResponse();
    const viewModel = buildHomeDashboardViewModel({
      dashboard,
      renderedAt: new Date('2026-03-01T00:00:00.000Z').getTime(),
    });

    expect(viewModel).toMatchObject({
      hasCurrentSeason: true,
      seasonState: 'SEASON_OPEN',
      daysUntilEnd: 54,
      isSeasonOpen: true,
      isSeasonMatching: false,
    });
  });

  it('does not invent a current-season schedule when dashboard has no current season', () => {
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
        operatedDormitories: [],
      },
      nextSeasonPreview: null,
    });
    const viewModel = buildHomeDashboardViewModel({
      dashboard,
      renderedAt: new Date('2026-07-01T00:00:00.000Z').getTime(),
    });

    expect(viewModel).toMatchObject({
      hasCurrentSeason: false,
      seasonState: 'OFF_SEASON',
      daysUntilEnd: 0,
      isSeasonOpen: false,
      isSeasonMatching: false,
      seasonSummary: {
        nextSeasonDate: '',
        nextSeasonName: '',
        hasNextSeasonPreview: false,
      },
    });
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
        activeChatThreadCount: 2,
        recentReceivedRequests: [createReceivedRequest()],
      },
    });

    const viewModel = buildHomeDashboardViewModel({
      dashboard,
      renderedAt: new Date('2026-06-22T00:00:00.000Z').getTime(),
    });

    expect(viewModel.hasCurrentSeason).toBe(true);
    expect(viewModel.matchingSummary.status).toBe('HAS_ACTIVITY');
    expect(viewModel.matchingSummary.stats).toMatchObject({
      sentRequests: 1,
      receivedRequests: 1,
      activeChats: 2,
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
      renderedAt: new Date('2026-04-01T00:00:00.000Z').getTime(),
    });

    expect(viewModel.isUnassigned).toBe(false);
    expect(viewModel.dormitory?.name).toBe('다산관');
    expect(viewModel.matchingSummary.gatingReason).toBeNull();
  });

  it('시즌 매칭 registration 전 상태를 registration-required gate로 표현한다', () => {
    const base = createHomeDashboardTestResponse();
    const dashboard = createHomeDashboardTestResponse({
      season: {
        ...base.season,
        state: 'SEASON_MATCHING',
        isOpen: true,
        isMatching: true,
      },
      viewer: {
        ...base.viewer,
        seasonProfile: {
          ...base.viewer.seasonProfile,
          intent: 'UNDECIDED',
          registered: false,
          profileExists: true,
          profileState: 'DRAFT',
          completion: {
            profileCompletionRequired: false,
            dormitorySelectionRequired: true,
            registrationUnavailable: true,
            registrationUnavailableReasons: ['DORMITORY_SELECTION_REQUIRED'],
          },
          draftWritable: true,
          canSelectDormitory: true,
          canFinalizeRegistration: false,
        },
        selection: {
          state: 'NOT_SELECTED',
          dormitoryId: null,
          source: null,
        },
      },
    });

    const viewModel = buildHomeDashboardViewModel({
      dashboard,
      renderedAt: new Date('2026-04-01T00:00:00.000Z').getTime(),
    });

    expect(viewModel.matchingSummary.gatingReason).toBe('registration_required');
    expect(viewModel.tip.seasonStatus).toBe('SEASON_MATCHING_REGISTRATION_REQUIRED');
  });

  it('시즌 매칭 기간은 선택 기숙사의 호실 선택일 기준으로 계산한다', () => {
    const base = createHomeDashboardTestResponse();
    const dashboard = createHomeDashboardTestResponse({
      season: {
        ...base.season,
        state: 'SEASON_MATCHING',
        isOpen: false,
        isMatching: true,
      },
      viewer: {
        ...base.viewer,
        selection: {
          state: 'ASSIGNED',
          dormitoryId: 'dasan',
          source: 'SEASON_PARTICIPANT',
        },
      },
    });

    const viewModel = buildHomeDashboardViewModel({
      dashboard,
      renderedAt: new Date('2026-08-03T00:00:00+09:00').getTime(),
    });

    expect(viewModel.matchingWindow).toEqual({
      matchingStartDate: '2026.08.01',
      matchingStartDateShort: '08.01',
      roomSelectionDate: '2026.08.06',
      roomSelectionDateShort: '08.06',
      roomSelectionDormitoryName: '다산관',
      daysUntilRoomSelection: 4,
      progressPercent: 33,
    });
  });

  it('keeps not-operated campus status from masking as a registration-required gate', () => {
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
      renderedAt: new Date('2026-04-01T00:00:00.000Z').getTime(),
    });

    expect(viewModel.isCampusOperated).toBe(false);
    expect(viewModel.matchingSummary.status).toBe('NOT_OPERATED');
    expect(viewModel.matchingSummary.gatingReason).toBeNull();
    expect(viewModel.tip.seasonStatus).toBe('NOT_OPERATED');
  });

  it('current season 운영 기숙사가 없으면 nextSeasonPreview로 보정하지 않는다', () => {
    const dashboard = createHomeDashboardTestResponse({
      season: {
        ...createHomeDashboardTestResponse().season,
        operatedDormitories: [],
      },
    });

    const viewModel = buildHomeDashboardViewModel({
      dashboard,
      renderedAt: new Date('2026-07-01T00:00:00.000Z').getTime(),
    });

    expect(viewModel.operatedDormitories).toEqual([]);
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
        operatedDormitories: [],
      },
    });

    const viewModel = buildHomeDashboardViewModel({
      dashboard,
      renderedAt: new Date('2026-07-01T00:00:00.000Z').getTime(),
    });

    expect(viewModel.hasCurrentSeason).toBe(false);
    expect(viewModel.seasonSummary).toMatchObject({
      daysUntilNext: 22,
      nextSeasonDate: '2026.07.23',
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
        todayMatchSuccessTotal: 8,
        todayMatchSuccessBuilding: 4,
      },
    });

    const viewModel = buildHomeDashboardViewModel({
      dashboard,
      renderedAt: new Date('2026-05-01T00:00:00.000Z').getTime(),
    });

    expect(viewModel.statsBar.totalCount).toBe(190);
    expect(viewModel.statsBar.matchSuccessCount).toBe(42);
    expect(viewModel.statsBar.todayMatchSuccessCount).toBe(0);
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
