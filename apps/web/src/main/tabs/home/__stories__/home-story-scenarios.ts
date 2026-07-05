import { createHomeDashboardTestResponse } from '@/main/test-support/home-dashboard.builder';
import type { SeasonState } from '@repo/shared/season/runtime';
import type { HomeDashboardResponse } from '@repo/shared/home';
import type { HomeStoryOperationsMode, HomeStoryProfileMode } from './home-story-api-fixtures';

type ActiveMatchSummary = NonNullable<HomeDashboardResponse['matching']['activeMatch']>;
type MatchRequestSummary = HomeDashboardResponse['matching']['recentReceivedRequests'][number];

export interface HomeStoryScenario {
  title: string;
  description: string;
  dashboard: HomeDashboardResponse;
  renderedAt?: number;
  operationsMode?: HomeStoryOperationsMode;
  profileMode?: HomeStoryProfileMode;
}

const ISO_NOW = '2026-04-05T09:00:00.000Z';
const SERVICE_INTRO_DISMISSED = [
  {
    noticeKey: 'service-intro' as const,
    dismissed: true,
    dismissedAt: '2026-04-01T00:00:00.000Z',
  },
];

function createDashboard(
  state: SeasonState,
  overrides: Partial<HomeDashboardResponse> = {},
): HomeDashboardResponse {
  const base = createHomeDashboardTestResponse();

  return {
    ...base,
    season: {
      ...base.season,
      state,
      isOpen: state === 'SEASON_OPEN' || state === 'SEASON_MATCHING',
      isMatching: state === 'SEASON_MATCHING',
      isPostMatch: state === 'SEASON_POST_MATCH',
      daysUntilMatchingEnd: state === 'SEASON_MATCHING' ? 25 : null,
      daysUntilSeasonEnd: state === 'SEASON_POST_MATCH' ? 0 : 86,
    },
    viewer: {
      ...base.viewer,
      onboarding: {
        dismissedNotices: SERVICE_INTRO_DISMISSED,
      },
    },
    generatedAt: ISO_NOW,
    ...overrides,
  };
}

function createNoCurrentSeasonDashboard(): HomeDashboardResponse {
  const base = createDashboard('OFF_SEASON');

  return {
    ...base,
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
    viewer: {
      ...base.viewer,
      seasonProfile: {
        ...base.viewer.seasonProfile,
        hasCurrentSeason: false,
        hasParticipantRow: false,
        intent: null,
        registered: false,
        profileExists: false,
        profileState: 'NONE',
        completion: {
          profileCompletionRequired: false,
          dormitorySelectionRequired: false,
          registrationUnavailable: true,
          registrationUnavailableReasons: ['NO_CURRENT_SEASON'],
        },
        draftWritable: false,
        canSelectDormitory: false,
        canFinalizeRegistration: false,
      },
      selection: {
        state: 'NOT_SELECTED',
        dormitoryId: null,
        source: null,
      },
      capabilities: {
        ...base.viewer.capabilities,
        canEnterRoommateSearch: false,
        canCreateOrUpdateSeasonProfileDraft: false,
        canSelectDormitory: false,
        canFinalizeSeasonRegistration: false,
        canRequestMatch: false,
        canStartChat: false,
        canViewMatchHistory: true,
      },
    },
  };
}

function createNoCurrentSeasonWithoutParticipationHistoryDashboard(): HomeDashboardResponse {
  const base = createNoCurrentSeasonDashboard();

  return {
    ...base,
    seasonHistorySummary: {
      lastSeason: base.seasonHistorySummary.lastSeason
        ? {
            ...base.seasonHistorySummary.lastSeason,
            viewerHadRegistration: false,
            viewerHadMatchSuccess: false,
            viewerActivity: {
              sentRequestCount: 0,
              receivedRequestCount: 0,
              conversationCount: 0,
              finalResult: 'NOT_PARTICIPATED',
              matchedPartnerNickname: null,
            },
          }
        : null,
    },
  };
}

function createNoCurrentSeasonWithMatchedHistoryDashboard(): HomeDashboardResponse {
  const base = createNoCurrentSeasonDashboard();

  return {
    ...base,
    seasonHistorySummary: {
      lastSeason: base.seasonHistorySummary.lastSeason
        ? {
            ...base.seasonHistorySummary.lastSeason,
            viewerHadRegistration: true,
            viewerHadMatchSuccess: true,
            viewerActivity: {
              sentRequestCount: 3,
              receivedRequestCount: 2,
              conversationCount: 4,
              finalResult: 'MATCHED',
              matchedPartnerNickname: '민지',
            },
          }
        : null,
    },
  };
}

function createNoCurrentSeasonWithNextSeasonNoServiceHistoryDashboard(): HomeDashboardResponse {
  const base = createNoCurrentSeasonDashboard();

  return {
    ...base,
    viewer: {
      ...base.viewer,
      capabilities: {
        ...base.viewer.capabilities,
        canViewMatchHistory: false,
      },
    },
    seasonHistorySummary: { lastSeason: null },
  };
}

function createNoCurrentSeasonWithoutNextSeasonDashboard(): HomeDashboardResponse {
  return {
    ...createNoCurrentSeasonDashboard(),
    nextSeasonPreview: null,
  };
}

function createNoCurrentSeasonWithoutNextSeasonNoServiceHistoryDashboard(): HomeDashboardResponse {
  const base = createNoCurrentSeasonWithoutNextSeasonDashboard();

  return {
    ...base,
    viewer: {
      ...base.viewer,
      capabilities: {
        ...base.viewer.capabilities,
        canViewMatchHistory: false,
      },
    },
    seasonHistorySummary: { lastSeason: null },
  };
}

function createOpenProfileAndDormitoryRequiredDashboard(): HomeDashboardResponse {
  const base = createDashboard('SEASON_OPEN');

  return {
    ...base,
    viewer: {
      ...base.viewer,
      seasonProfile: {
        ...base.viewer.seasonProfile,
        registered: false,
        profileExists: true,
        profileState: 'DRAFT',
        completion: {
          profileCompletionRequired: true,
          dormitorySelectionRequired: true,
          registrationUnavailable: true,
          registrationUnavailableReasons: ['PROFILE_INCOMPLETE', 'DORMITORY_SELECTION_REQUIRED'],
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
      capabilities: {
        ...base.viewer.capabilities,
        canEnterRoommateSearch: true,
        canCreateOrUpdateSeasonProfileDraft: true,
        canSelectDormitory: true,
        canFinalizeSeasonRegistration: false,
        canRequestMatch: false,
        canStartChat: false,
      },
    },
  };
}

function createOpenDormitoryRequiredDashboard(): HomeDashboardResponse {
  const base = createDashboard('SEASON_OPEN');

  return {
    ...base,
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
      capabilities: {
        ...base.viewer.capabilities,
        canEnterRoommateSearch: true,
        canCreateOrUpdateSeasonProfileDraft: true,
        canSelectDormitory: true,
        canFinalizeSeasonRegistration: false,
        canRequestMatch: false,
        canStartChat: false,
      },
    },
  };
}

function createOpenProfileRequiredDashboard(): HomeDashboardResponse {
  const base = createDashboard('SEASON_OPEN');

  return {
    ...base,
    viewer: {
      ...base.viewer,
      seasonProfile: {
        ...base.viewer.seasonProfile,
        intent: 'UNDECIDED',
        registered: false,
        profileExists: true,
        profileState: 'DRAFT',
        completion: {
          profileCompletionRequired: true,
          dormitorySelectionRequired: false,
          registrationUnavailable: true,
          registrationUnavailableReasons: ['PROFILE_INCOMPLETE'],
        },
        draftWritable: true,
        canSelectDormitory: true,
        canFinalizeRegistration: false,
      },
      selection: {
        state: 'SELECTED',
        dormitoryId: 'dasan',
        source: 'SEASON_PARTICIPANT',
      },
      capabilities: {
        ...base.viewer.capabilities,
        canEnterRoommateSearch: true,
        canCreateOrUpdateSeasonProfileDraft: true,
        canSelectDormitory: true,
        canFinalizeSeasonRegistration: false,
        canRequestMatch: false,
        canStartChat: false,
      },
    },
  };
}

function createOpenRegistrationReadyDashboard(): HomeDashboardResponse {
  const base = createDashboard('SEASON_OPEN');

  return {
    ...base,
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
          dormitorySelectionRequired: false,
          registrationUnavailable: false,
          registrationUnavailableReasons: [],
        },
        draftWritable: true,
        canSelectDormitory: true,
        canFinalizeRegistration: true,
      },
      selection: {
        state: 'SELECTED',
        dormitoryId: 'dasan',
        source: 'SEASON_PARTICIPANT',
      },
      capabilities: {
        ...base.viewer.capabilities,
        canEnterRoommateSearch: true,
        canCreateOrUpdateSeasonProfileDraft: true,
        canSelectDormitory: true,
        canFinalizeSeasonRegistration: true,
        canRequestMatch: false,
        canStartChat: false,
      },
    },
    matching: {
      ...base.matching,
      pendingSentCount: 0,
      pendingReceivedCount: 0,
      activeChatThreadCount: 0,
      unreadMessageCount: 0,
      recentReceivedRequests: [],
    },
  };
}

function createMatchingPreparationDashboard(
  dashboard: HomeDashboardResponse,
): HomeDashboardResponse {
  const base = createDashboard('SEASON_MATCHING');

  return {
    ...dashboard,
    season: base.season,
    matching: {
      ...dashboard.matching,
      pendingSentCount: 0,
      pendingReceivedCount: 0,
      activeChatThreadCount: 0,
      unreadMessageCount: 0,
      recentReceivedRequests: [],
    },
  };
}

function createMatchingProfileAndDormitoryRequiredDashboard(): HomeDashboardResponse {
  return createMatchingPreparationDashboard(createOpenProfileAndDormitoryRequiredDashboard());
}

function createMatchingDormitoryRequiredDashboard(): HomeDashboardResponse {
  return createMatchingPreparationDashboard(createOpenDormitoryRequiredDashboard());
}

function createMatchingProfileRequiredDashboard(): HomeDashboardResponse {
  return createMatchingPreparationDashboard(createOpenProfileRequiredDashboard());
}

function createMatchingRegistrationReadyDashboard(): HomeDashboardResponse {
  return createMatchingPreparationDashboard(createOpenRegistrationReadyDashboard());
}

function createMatchingRegisteredNoActivityDashboard(): HomeDashboardResponse {
  const base = createDashboard('SEASON_MATCHING');

  return {
    ...base,
    matching: {
      ...base.matching,
      pendingSentCount: 0,
      pendingReceivedCount: 0,
      activeChatThreadCount: 0,
      unreadMessageCount: 0,
      recentReceivedRequests: [],
    },
  };
}

function createOpenRegisteredPreviewDashboard(): HomeDashboardResponse {
  const base = createDashboard('SEASON_OPEN');

  return {
    ...base,
    viewer: {
      ...base.viewer,
      capabilities: {
        ...base.viewer.capabilities,
        canEnterRoommateSearch: true,
        canRequestMatch: false,
        canStartChat: true,
      },
    },
    matching: {
      ...base.matching,
      pendingSentCount: 0,
      pendingReceivedCount: 0,
      activeChatThreadCount: 0,
      unreadMessageCount: 0,
      recentReceivedRequests: [],
    },
  };
}

function createOpenNoMatchingSeasonDashboard(): HomeDashboardResponse {
  const base = createOpenRegisteredPreviewDashboard();

  return {
    ...base,
    season: {
      ...base.season,
      schedule: null,
    },
    nextSeasonPreview: null,
  };
}

function createOpenNoOperatedDormitoriesDashboard({
  profileComplete,
}: {
  profileComplete: boolean;
}): HomeDashboardResponse {
  const base = createDashboard('SEASON_OPEN');

  return {
    ...base,
    season: {
      ...base.season,
      operatedDormitories: [],
    },
    stats: {
      ...base.stats,
      totalParticipants: 0,
      assignedParticipants: 0,
      buildingTotal: 0,
      buildingMatchable: 0,
      todayNewTotal: 0,
      todayNewBuilding: 0,
      totalMatchSuccess: 0,
      buildingMatchSuccess: 0,
      todayMatchSuccessTotal: 0,
      todayMatchSuccessBuilding: 0,
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
          profileCompletionRequired: !profileComplete,
          dormitorySelectionRequired: true,
          registrationUnavailable: true,
          registrationUnavailableReasons: profileComplete
            ? ['NO_SELECTABLE_DORMITORY']
            : ['PROFILE_INCOMPLETE', 'NO_SELECTABLE_DORMITORY'],
        },
        draftWritable: true,
        canSelectDormitory: false,
        canFinalizeRegistration: false,
      },
      selection: {
        state: 'NOT_SELECTED',
        dormitoryId: null,
        source: null,
      },
      capabilities: {
        ...base.viewer.capabilities,
        canEnterRoommateSearch: false,
        canSelectDormitory: false,
        canFinalizeSeasonRegistration: false,
        canRequestMatch: false,
        canStartChat: false,
      },
    },
  };
}

function createSeasonMatchingRegistrationUnavailableDashboard(): HomeDashboardResponse {
  const base = createDashboard('SEASON_MATCHING');

  return {
    ...base,
    viewer: {
      ...base.viewer,
      seasonProfile: {
        ...base.viewer.seasonProfile,
        registered: false,
        completion: {
          profileCompletionRequired: false,
          dormitorySelectionRequired: false,
          registrationUnavailable: true,
          registrationUnavailableReasons: ['DORMITORY_SELECTION_CLOSED'],
        },
        canFinalizeRegistration: false,
      },
      capabilities: {
        ...base.viewer.capabilities,
        canEnterRoommateSearch: false,
        canFinalizeSeasonRegistration: false,
        canRequestMatch: false,
        canStartChat: false,
      },
    },
  };
}

function createDeregisteredDashboard(
  state: Extract<SeasonState, 'SEASON_OPEN' | 'SEASON_MATCHING'>,
): HomeDashboardResponse {
  const base = createDashboard(state);

  return {
    ...base,
    viewer: {
      ...base.viewer,
      seasonProfile: {
        ...base.viewer.seasonProfile,
        intent: 'DECLINED',
        registered: false,
        profileExists: true,
        profileState: 'COMPLETE',
        completion: {
          profileCompletionRequired: false,
          dormitorySelectionRequired: false,
          registrationUnavailable: true,
          registrationUnavailableReasons: ['WITHDRAWN_OR_DECLINED_LOCK'],
        },
        draftWritable: false,
        canSelectDormitory: false,
        canFinalizeRegistration: false,
      },
      match: {
        hasActiveMatch: false,
        activeMatch: null,
      },
      capabilities: {
        ...base.viewer.capabilities,
        canEnterRoommateSearch: false,
        canCreateOrUpdateSeasonProfileDraft: false,
        canSelectDormitory: false,
        canFinalizeSeasonRegistration: false,
        canRequestMatch: false,
        canStartChat: false,
      },
    },
    matching: {
      ...base.matching,
      pendingSentCount: 0,
      pendingReceivedCount: 0,
      activeChatThreadCount: 0,
      unreadMessageCount: 0,
      activeMatch: null,
      recentReceivedRequests: [],
    },
  };
}

function createMatchingUnmatchedDashboard(): HomeDashboardResponse {
  const base = createMatchingRegisteredNoActivityDashboard();

  return {
    ...base,
    matching: {
      ...base.matching,
      activeChatThreadCount: 1,
      unreadMessageCount: 0,
      activeMatch: null,
    },
    viewer: {
      ...base.viewer,
      match: {
        hasActiveMatch: false,
        activeMatch: null,
      },
      capabilities: {
        ...base.viewer.capabilities,
        canEnterRoommateSearch: true,
        canRequestMatch: true,
        canStartChat: true,
      },
    },
  };
}

function createPostMatchBaseDashboard(): HomeDashboardResponse {
  const base = createDashboard('SEASON_POST_MATCH');

  return {
    ...base,
    season: {
      ...base.season,
      state: 'SEASON_POST_MATCH',
      isOpen: false,
      isMatching: false,
      isPostMatch: true,
      daysUntilMatchingEnd: null,
      daysUntilSeasonEnd: 24,
      schedule: base.season.schedule
        ? {
            ...base.season.schedule,
            matchingEnd: '2026-08-06',
            seasonEnd: '2026-08-31',
          }
        : base.season.schedule,
    },
    viewer: {
      ...base.viewer,
      capabilities: {
        ...base.viewer.capabilities,
        canEnterRoommateSearch: true,
        canCreateOrUpdateSeasonProfileDraft: false,
        canSelectDormitory: false,
        canFinalizeSeasonRegistration: false,
        canRequestMatch: false,
        canStartChat: false,
        canViewMatchHistory: true,
      },
      match: {
        hasActiveMatch: false,
        activeMatch: null,
      },
    },
    matching: {
      ...base.matching,
      pendingSentCount: 0,
      pendingReceivedCount: 0,
      activeChatThreadCount: 0,
      unreadMessageCount: 0,
      activeMatch: null,
      recentReceivedRequests: [],
    },
    nextSeasonPreview: null,
  };
}

function createPostMatchNotRegisteredDashboard(): HomeDashboardResponse {
  const base = createPostMatchBaseDashboard();

  return {
    ...base,
    viewer: {
      ...base.viewer,
      seasonProfile: {
        ...base.viewer.seasonProfile,
        hasParticipantRow: false,
        intent: null,
        registered: false,
        profileExists: false,
        profileState: 'NONE',
        completion: {
          profileCompletionRequired: false,
          dormitorySelectionRequired: false,
          registrationUnavailable: true,
          registrationUnavailableReasons: ['SEASON_NOT_OPEN'],
        },
        draftWritable: false,
        canSelectDormitory: false,
        canFinalizeRegistration: false,
      },
      selection: {
        state: 'NOT_SELECTED',
        dormitoryId: null,
        source: null,
      },
      capabilities: {
        ...base.viewer.capabilities,
        canViewMatchHistory: false,
      },
    },
    seasonHistorySummary: {
      lastSeason: base.seasonHistorySummary.lastSeason
        ? {
            ...base.seasonHistorySummary.lastSeason,
            viewerHadRegistration: false,
            viewerHadMatchSuccess: false,
            viewerActivity: {
              sentRequestCount: 0,
              receivedRequestCount: 0,
              conversationCount: 0,
              finalResult: 'NOT_PARTICIPATED',
              matchedPartnerNickname: null,
            },
          }
        : null,
    },
  };
}

function createPostMatchDeregisteredDashboard(): HomeDashboardResponse {
  const base = createPostMatchBaseDashboard();

  return {
    ...base,
    viewer: {
      ...base.viewer,
      seasonProfile: {
        ...base.viewer.seasonProfile,
        intent: 'DECLINED',
        registered: false,
        profileExists: true,
        profileState: 'COMPLETE',
        completion: {
          profileCompletionRequired: false,
          dormitorySelectionRequired: false,
          registrationUnavailable: true,
          registrationUnavailableReasons: ['WITHDRAWN_OR_DECLINED_LOCK'],
        },
        draftWritable: false,
        canSelectDormitory: false,
        canFinalizeRegistration: false,
      },
      capabilities: {
        ...base.viewer.capabilities,
        canEnterRoommateSearch: false,
      },
    },
  };
}

function createPostMatchMatchedDashboard(): HomeDashboardResponse {
  const base = createPostMatchBaseDashboard();
  const activeMatch = createActiveMatch({
    unmatchProgress: {
      state: 'NONE',
      requestedByViewerAt: null,
      requestedByCounterpartAt: null,
      progressCount: 0,
      requiredCount: 2,
      canRequest: false,
      canCancel: false,
      availableUntil: null,
    },
  });

  return {
    ...base,
    viewer: {
      ...base.viewer,
      match: {
        hasActiveMatch: true,
        activeMatch,
      },
      capabilities: {
        ...base.viewer.capabilities,
        canStartChat: true,
      },
    },
    matching: {
      ...base.matching,
      activeChatThreadCount: 1,
      unreadMessageCount: 2,
      activeMatch,
    },
  };
}

function createPostMatchUnmatchedDashboard(): HomeDashboardResponse {
  const base = createPostMatchBaseDashboard();

  return {
    ...base,
    matching: {
      ...base.matching,
      activeChatThreadCount: 1,
    },
    seasonHistorySummary: {
      lastSeason: base.seasonHistorySummary.lastSeason
        ? {
            ...base.seasonHistorySummary.lastSeason,
            viewerHadRegistration: true,
            viewerHadMatchSuccess: true,
            viewerActivity: {
              sentRequestCount: 2,
              receivedRequestCount: 1,
              conversationCount: 3,
              finalResult: 'UNMATCHED_AFTER_SUCCESS',
              matchedPartnerNickname: null,
            },
          }
        : null,
    },
  };
}

function createPostMatchRegisteredNotMatchedDashboard(): HomeDashboardResponse {
  const base = createPostMatchBaseDashboard();

  return {
    ...base,
    seasonHistorySummary: {
      lastSeason: base.seasonHistorySummary.lastSeason
        ? {
            ...base.seasonHistorySummary.lastSeason,
            viewerHadRegistration: true,
            viewerHadMatchSuccess: false,
            viewerActivity: {
              sentRequestCount: 3,
              receivedRequestCount: 2,
              conversationCount: 4,
              finalResult: 'NO_MATCH',
              matchedPartnerNickname: null,
            },
          }
        : null,
    },
  };
}

function createPostMatchRegistrationUnavailableDashboard(): HomeDashboardResponse {
  const base = createPostMatchBaseDashboard();

  return {
    ...base,
    viewer: {
      ...base.viewer,
      seasonProfile: {
        ...base.viewer.seasonProfile,
        intent: 'UNDECIDED',
        registered: false,
        profileExists: true,
        profileState: 'COMPLETE',
        completion: {
          profileCompletionRequired: false,
          dormitorySelectionRequired: false,
          registrationUnavailable: true,
          registrationUnavailableReasons: ['SEASON_NOT_OPEN'],
        },
        draftWritable: false,
        canSelectDormitory: false,
        canFinalizeRegistration: false,
      },
      capabilities: {
        ...base.viewer.capabilities,
        canFinalizeSeasonRegistration: false,
        canRequestMatch: false,
        canStartChat: false,
      },
    },
  };
}

function createActiveMatch(overrides: Partial<ActiveMatchSummary> = {}): ActiveMatchSummary {
  const base: ActiveMatchSummary = {
    id: 'active-match-1',
    seasonId: 'season-2026-1',
    counterpartUserId: 'partner-user-1',
    counterpartParticipantId: 'partner-participant-1',
    counterpartNickname: '민지',
    counterpartSummary: {
      id: 'partner-user-1',
      sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
      relation: { type: 'MATCHED_PARTNER' },
      exposure: {
        listSummaryVisible: true,
        detailViewable: true,
        canViewFull: true,
        scoreVisible: true,
      },
      actions: {
        canBookmark: false,
        canRequestMatch: false,
        canStartChat: true,
        unavailableReasons: ['VIEWER_ALREADY_MATCHED'],
      },
      resultRead: {
        resultReadable: true,
        context: 'CURRENT_MATCHED_PARTNER',
      },
      profileSummary: {
        nickname: '민지',
        intro: '아침형 생활패턴이고, 조용한 방 분위기를 선호해요.',
        smokingBehavior: 'NO',
        sleepHabit: 'NONE',
        relationshipStyle: 'CLOSE',
      },
      matchScore: 92,
    },
    status: 'ACTIVE',
    startedAt: '2026-04-04T12:00:00.000Z',
    endedAt: null,
    endReason: null,
    createdFromRequestId: 'request-accepted-1',
    matchScore: 92,
    unmatchProgress: {
      state: 'NONE',
      requestedByViewerAt: null,
      requestedByCounterpartAt: null,
      progressCount: 0,
      requiredCount: 2,
      canRequest: true,
      canCancel: false,
      availableUntil: '2026-04-30T14:59:59.000Z',
    },
  };

  return {
    ...base,
    ...overrides,
    unmatchProgress: {
      ...base.unmatchProgress,
      ...(overrides.unmatchProgress ?? {}),
    },
  };
}

function createSeasonMatchingActiveMatchScenario({
  title,
  description,
  activeMatch,
}: {
  title: string;
  description: string;
  activeMatch: ActiveMatchSummary;
}): HomeStoryScenario {
  const base = createDashboard('SEASON_MATCHING');

  return {
    title,
    description,
    dashboard: createDashboard('SEASON_MATCHING', {
      viewer: {
        ...base.viewer,
        match: {
          hasActiveMatch: true,
          activeMatch,
        },
        capabilities: {
          ...base.viewer.capabilities,
          canRequestMatch: false,
          canStartChat: true,
        },
      },
      matching: {
        ...base.matching,
        pendingSentCount: 0,
        pendingReceivedCount: 0,
        activeChatThreadCount: 1,
        unreadMessageCount: 5,
        activeMatch,
        recentReceivedRequests: [],
      },
    }),
  };
}

function createReceivedRequest(
  nickname: string,
  index: number,
  fixture?: {
    requestId?: string;
    counterpartUserId?: string;
    counterpartParticipantId?: string;
    detailEntryToken?: string;
  },
): MatchRequestSummary {
  return {
    id: fixture?.requestId ?? `received-request-${index}`,
    seasonId: 'season-2026-1',
    direction: 'RECEIVED',
    counterpartUserId: fixture?.counterpartUserId ?? `counterpart-user-${index}`,
    counterpartParticipantId:
      fixture?.counterpartParticipantId ?? `counterpart-participant-${index}`,
    counterpartSummary: {
      id: `counterpart-profile-${index}`,
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
        canRequestMatch: false,
        canStartChat: true,
        unavailableReasons: [],
      },
      resultRead: {
        resultReadable: false,
        context: 'NONE',
      },
      profileSummary: {
        nickname,
        intro: '생활패턴을 확인하고 대화해보고 싶어요.',
        smokingBehavior: 'NO',
        sleepHabit: 'NONE',
        relationshipStyle: 'CASUAL',
      },
      bookmark: {
        bookmarked: false,
      },
      detailEntryToken: fixture?.detailEntryToken ?? `story-token-${index}`,
      matchScore: 88 - index,
    },
    status: 'PENDING',
    note: '안녕하세요! 생활패턴이 비슷해서 요청드려요.',
    createdAt: '2026-04-04T08:00:00.000Z',
    expiresAt: '2026-04-06T08:00:00.000Z',
    terminalAt: null,
    acceptedAt: null,
    terminalReason: null,
  };
}

type SentPendingBucket = '0' | '1' | '3';
type ReceivedPendingBucket = '0' | '1+';
type ChattingBucket = '0' | '1+';

interface MatchingPendingMatrixInput {
  sentBucket: SentPendingBucket;
  receivedBucket: ReceivedPendingBucket;
  chattingBucket: ChattingBucket;
}

interface MatchingReceivedRequesterFixture {
  userId: string;
  participantId: string;
  nickname: string;
}

interface MatchingPendingMatrixBeFixture {
  key: string;
  email: string;
  nickname: string;
  viewerUserId: string;
  viewerParticipantId: string;
  sentTargetParticipantIds: string[];
  receivedRequesters: MatchingReceivedRequesterFixture[];
  activeChatThreadIds: string[];
  unreadMessageCount: number;
}

function resolveSentPendingCount(bucket: SentPendingBucket): number {
  if (bucket === '3') {
    return 3;
  }

  if (bucket === '1') {
    return 1;
  }

  return 0;
}

function resolveReceivedPendingCount(bucket: ReceivedPendingBucket): number {
  return bucket === '1+' ? 2 : 0;
}

function createMatchingPendingMatrixKey({
  sentBucket,
  receivedBucket,
  chattingBucket,
}: MatchingPendingMatrixInput): string {
  return `${sentBucket}-${receivedBucket}-${chattingBucket}`.replace(/\+/g, 'p');
}

function createMatchingPendingMatrixBeFixture(
  input: MatchingPendingMatrixInput,
): MatchingPendingMatrixBeFixture {
  const key = createMatchingPendingMatrixKey(input);
  const sentCount = resolveSentPendingCount(input.sentBucket);
  const receivedCount = resolveReceivedPendingCount(input.receivedBucket);
  const activeChatThreadCount = input.chattingBucket === '1+' ? 2 : 0;
  const nickname = `S${input.sentBucket}R${input.receivedBucket}C${input.chattingBucket}`
    .replace(/\+/g, 'plus')
    .replace(/-/g, 'to');
  const receivedNicknames = ['서연', '지우', '하린'];

  return {
    key,
    email: `home-${key}@kangwon.ac.kr`,
    nickname,
    viewerUserId: `story-${key}-user`,
    viewerParticipantId: `story-${key}-participant`,
    // BE HomeDashboardCountsQuery 기준:
    // - sent는 viewer가 requester인 PENDING matchRequest count
    // - received는 viewer가 receiver인 PENDING matchRequest count + recentReceivedRequests
    // - chatting은 viewer가 속한 active conversationThread count
    sentTargetParticipantIds: Array.from(
      { length: sentCount },
      (_, index) => `story-${key}-sent-target-participant-${index + 1}`,
    ),
    receivedRequesters: Array.from({ length: receivedCount }, (_, index) => ({
      userId: `story-${key}-received-user-${index + 1}`,
      participantId: `story-${key}-received-participant-${index + 1}`,
      nickname: receivedNicknames[index] ?? `후보${index + 1}`,
    })),
    activeChatThreadIds: Array.from(
      { length: activeChatThreadCount },
      (_, index) => `story-${key}-thread-${index + 1}`,
    ),
    unreadMessageCount: activeChatThreadCount > 0 ? 2 : 0,
  };
}

function applyStoryViewerAccount(
  dashboard: HomeDashboardResponse,
  fixture: MatchingPendingMatrixBeFixture,
): HomeDashboardResponse {
  return {
    ...dashboard,
    viewer: {
      ...dashboard.viewer,
      identity: {
        ...dashboard.viewer.identity,
        user: {
          ...dashboard.viewer.identity.user,
          id: fixture.viewerUserId,
          email: fixture.email,
          nickname: fixture.nickname,
        },
        displayIdentity: {
          ...dashboard.viewer.identity.displayIdentity,
          userId: fixture.viewerUserId,
          nickname: fixture.nickname,
        },
      },
    },
  };
}

function createMatchingRegisteredPendingDashboard(
  input: MatchingPendingMatrixInput,
): HomeDashboardResponse {
  const fixture = createMatchingPendingMatrixBeFixture(input);
  const base = applyStoryViewerAccount(createMatchingRegisteredNoActivityDashboard(), fixture);

  return {
    ...base,
    matching: {
      ...base.matching,
      pendingSentCount: fixture.sentTargetParticipantIds.length,
      pendingReceivedCount: fixture.receivedRequesters.length,
      activeChatThreadCount: fixture.activeChatThreadIds.length,
      unreadMessageCount: fixture.unreadMessageCount,
      recentReceivedRequests: fixture.receivedRequesters.map((requester, index) =>
        createReceivedRequest(requester.nickname, index + 1, {
          requestId: `story-${fixture.key}-received-request-${index + 1}`,
          counterpartUserId: requester.userId,
          counterpartParticipantId: requester.participantId,
          detailEntryToken: `story-${fixture.key}-received-token-${index + 1}`,
        }),
      ),
    },
  };
}

function createMatchingPendingMatrixScenario(input: MatchingPendingMatrixInput): HomeStoryScenario {
  const sentLabel = `S ${input.sentBucket}`;
  const receivedLabel = `R ${input.receivedBucket}`;
  const chatLabel = `C ${input.chattingBucket}`;

  return {
    title: `Season Matching / registered + ${sentLabel} + ${receivedLabel} + ${chatLabel}`,
    description:
      'S=보낸 요청, R=받은 요청, C=활성 대화 조합이 PrimaryCard와 매칭 활동 CTA에 미치는 영향을 비교합니다. 각 scenario는 서로 다른 viewer 계정 fixture를 사용합니다.',
    dashboard: createMatchingRegisteredPendingDashboard(input),
  };
}

export const homeStoryScenarios = {
  offSeasonNextSeason: {
    title: 'Off season + next Season',
    description: '활성 시즌이 없을 때 지난 시즌 요약과 다음 시즌 준비 일정을 함께 안내합니다.',
    dashboard: createNoCurrentSeasonDashboard(),
  },
  offSeasonNoNextSeason: {
    title: 'Off Season + no next Season',
    description:
      '새 학기 이후 다음 시즌 공식 일정이 아직 등록되지 않았을 때 따뜻한 비시즌 안내를 보여줍니다.',
    dashboard: createNoCurrentSeasonWithoutNextSeasonDashboard(),
  },
  offSeasonNextSeasonNoServiceHistory: {
    title: 'Off season + next Season + no service history',
    description:
      '첫 서비스 릴리즈처럼 다음 시즌 preview는 있지만 완료된 서비스 시즌 기록이 아직 없는 상태입니다.',
    dashboard: createNoCurrentSeasonWithNextSeasonNoServiceHistoryDashboard(),
  },
  offSeasonNextSeasonNoUserHistory: {
    title: 'Off season + next Season + no user history',
    description:
      '다음 시즌 preview와 직전 시즌 기록은 있지만 사용자가 이전 시즌에 참여하지 않은 상태를 보여줍니다.',
    dashboard: createNoCurrentSeasonWithoutParticipationHistoryDashboard(),
  },
  offSeasonNextSeasonUserMatchedHistory: {
    title: 'Off season + next Season + user matched history',
    description: '다음 시즌 preview와 함께 사용자의 이전 시즌 매칭 성공 이력을 보여줍니다.',
    dashboard: createNoCurrentSeasonWithMatchedHistoryDashboard(),
  },
  offSeasonNoNextSeasonNoServiceHistory: {
    title: 'Off season + no next Season + no service history',
    description:
      '활성 시즌, 다음 시즌 preview, 완료된 서비스 시즌 기록이 모두 없을 때 안전한 fallback을 확인합니다.',
    dashboard: createNoCurrentSeasonWithoutNextSeasonNoServiceHistoryDashboard(),
  },
  seasonOpenProfileAndDormitoryRequired: {
    title: '시즌 오픈 / 생활패턴·기숙사 필요',
    description:
      '시즌 프로필 설정과 기숙사 선택이 모두 남아 있지만 룸메 후보 미리보기 진입은 가능한 상태입니다.',
    dashboard: createOpenProfileAndDormitoryRequiredDashboard(),
  },
  seasonOpenDormitoryRequired: {
    title: '시즌 오픈 / 기숙사 필요',
    description:
      '시즌 프로필은 준비됐고 실제 기숙사 선택이 남아 있는 시즌 참여 신청 전 상태입니다.',
    dashboard: createOpenDormitoryRequiredDashboard(),
  },
  seasonOpenProfileRequired: {
    title: '시즌 오픈 / 시즌 프로필 설정 필요',
    description: '기숙사 draft는 저장됐지만 시즌 프로필 보강이 남아 있는 상태입니다.',
    dashboard: createOpenProfileRequiredDashboard(),
  },
  seasonOpenRegistrationReady: {
    title: '시즌 오픈 / 참여 신청 가능',
    description:
      '시즌 프로필과 기숙사 선택은 끝났고 시즌 참여 신청만 남은 registration candidate 상태입니다.',
    dashboard: createOpenRegistrationReadyDashboard(),
  },
  seasonOpenRegisteredPreview: {
    title: '시즌 오픈 / 참여 완료·룸메 후보 미리보기',
    description:
      '시즌 참여 신청 완료 상태의 조건 섹션은 유지하고, 별도 통계 chip 없이 활동 섹션과 빠른 메뉴로 진입점을 분리한 상태입니다.',
    dashboard: createOpenRegisteredPreviewDashboard(),
  },
  seasonOpenDeregistered: {
    title: 'Season Open / after season de-registration',
    description: '시즌 오픈 기간에 시즌 참여를 철회한 뒤 같은 시즌 재참여가 제한되는 상태입니다.',
    dashboard: createDeregisteredDashboard('SEASON_OPEN'),
  },
  seasonOpenNoMatchingSeason: {
    title: 'Season Open No Matching Season',
    description:
      '시즌 오픈 상태이지만 매칭 시작일이 아직 확정되지 않았을 때 날짜 fallback과 준비 안내를 확인합니다.',
    dashboard: createOpenNoMatchingSeasonDashboard(),
  },
  seasonOpenNoOperatedDormitoriesProfileIncomplete: {
    title: '시즌 오픈 / 운영 기숙사 준비 중·시즌 프로필 미완료',
    description:
      'current season은 있지만 선택 가능한 운영 기숙사가 없고 시즌 프로필 설정도 남아 있는 상태입니다.',
    dashboard: createOpenNoOperatedDormitoriesDashboard({ profileComplete: false }),
  },
  seasonOpenNoOperatedDormitoriesProfileComplete: {
    title: '시즌 오픈 / 운영 기숙사 준비 중·시즌 프로필 완료',
    description:
      '시즌 프로필은 준비됐지만 선택 가능한 운영 기숙사가 없어 시즌 참여 신청을 마칠 수 없는 상태입니다.',
    dashboard: createOpenNoOperatedDormitoriesDashboard({ profileComplete: true }),
  },
  seasonMatchingProfileAndDormitoryRequired: {
    title: 'Season Matching / profile + dormitory required',
    description:
      '매칭 기간에 유입된 사용자가 시즌 프로필과 기숙사 설정을 모두 마쳐야 시즌 참여 신청을 진행할 수 있는 상태입니다.',
    dashboard: createMatchingProfileAndDormitoryRequiredDashboard(),
  },
  seasonMatchingProfileRequired: {
    title: 'Season Matching / profile required',
    description:
      '기숙사 draft는 저장됐지만 시즌 프로필 보강이 남아 있어 시즌 참여 신청 전 준비가 필요한 상태입니다.',
    dashboard: createMatchingProfileRequiredDashboard(),
  },
  seasonMatchingDormitoryRequired: {
    title: 'Season Matching / dormitory required',
    description:
      '시즌 프로필은 준비됐고 기숙사 설정이 남아 있어 시즌 참여 신청 전 준비가 필요한 상태입니다.',
    dashboard: createMatchingDormitoryRequiredDashboard(),
  },
  seasonMatchingRegistrationReady: {
    title: 'Season Matching / registration ready',
    description:
      '매칭 기간 중 시즌 프로필과 기숙사 설정이 끝났고 시즌 참여 신청만 남은 registration candidate 상태입니다.',
    dashboard: createMatchingRegistrationReadyDashboard(),
  },
  seasonMatchingRegisteredNoActivity: {
    title: 'Season Matching / registered + no activity',
    description:
      '시즌 참여와 기숙사 확정이 끝났고 active match나 pending request가 없어 룸메 후보 탐색을 시작할 수 있는 상태입니다.',
    dashboard: createMatchingRegisteredNoActivityDashboard(),
  },
  seasonMatchingRegisteredProgress40: {
    title: 'Season Matching / registered + 40% progress',
    description:
      '매칭 시작일과 호실 선택일 사이 40% 지점의 진행률, 일정, 통계 card contrast를 고정 비교합니다.',
    dashboard: createMatchingRegisteredNoActivityDashboard(),
    renderedAt: new Date('2026-08-03T09:36:00+09:00').getTime(),
  },
  seasonMatchingRegisteredProgress75: {
    title: 'Season Matching / registered + 75% progress',
    description:
      '매칭 기간이 70% 이상 지난 시점에는 ProgressBar만 warning tone으로 변하고 PrimaryCard 색상은 유지되는지 확인합니다.',
    dashboard: createMatchingRegisteredNoActivityDashboard(),
    renderedAt: new Date('2026-08-05T12:00:00+09:00').getTime(),
  },
  seasonMatchingRegisteredProgress92: {
    title: 'Season Matching / registered + 92% progress',
    description:
      '호실 선택일에 가까운 90% 이상 진행 시점에는 ProgressBar만 critical tone으로 변하고 PrimaryCard 색상은 유지되는지 확인합니다.',
    dashboard: createMatchingRegisteredNoActivityDashboard(),
    renderedAt: new Date('2026-08-06T12:30:00+09:00').getTime(),
  },
  seasonMatchingDeregistered: {
    title: 'Season Matching / after season de-registration',
    description:
      '시즌 매칭 기간에 시즌 참여를 철회한 뒤 탐색·요청·채팅 진입이 닫히고 재참여 제한 안내가 노출되는 상태입니다.',
    dashboard: createDeregisteredDashboard('SEASON_MATCHING'),
  },
  seasonMatchingUnmatched: {
    title: 'Season Matching / after unmatched',
    description:
      '확정 매칭이 상호 해제로 종료되어 activeMatch는 없고, 다시 룸메 후보를 탐색할 수 있는 상태입니다.',
    dashboard: createMatchingUnmatchedDashboard(),
  },
  seasonMatchingRegisteredS1R0C1: createMatchingPendingMatrixScenario({
    sentBucket: '1',
    receivedBucket: '0',
    chattingBucket: '1+',
  }),
  seasonMatchingRegisteredS1R1C1: createMatchingPendingMatrixScenario({
    sentBucket: '1',
    receivedBucket: '1+',
    chattingBucket: '1+',
  }),
  seasonMatchingActiveMatch: createSeasonMatchingActiveMatchScenario({
    title: 'Season Matching / active match',
    description:
      '확정 매칭이 있고 아직 해제 요청이 없는 기본 ActiveMatch 상태입니다. 신규 후보 action은 닫히고 확정 룸메 대화·결과 확인이 유지됩니다.',
    activeMatch: createActiveMatch(),
  }),
  seasonMatchingActiveMatchCounterpartCancelRequest: createSeasonMatchingActiveMatchScenario({
    title: 'Season Matching / active match + counterpart cancel request',
    description:
      '상대가 먼저 매칭 해제를 요청한 상태입니다. BE unmatchProgress 기준 WAITING_FOR_ME/canRequest=true 조합을 검토합니다.',
    activeMatch: createActiveMatch({
      unmatchProgress: {
        state: 'WAITING_FOR_ME',
        requestedByViewerAt: null,
        requestedByCounterpartAt: '2026-04-05T01:30:00.000Z',
        progressCount: 1,
        requiredCount: 2,
        canRequest: true,
        canCancel: false,
        availableUntil: '2026-04-30T14:59:59.000Z',
      },
    }),
  }),
  seasonMatchingActiveMatchSelfCancelRequest: createSeasonMatchingActiveMatchScenario({
    title: 'Season Matching / active match + self cancel request',
    description:
      '내가 먼저 매칭 해제를 요청한 상태입니다. BE unmatchProgress 기준 WAITING_FOR_COUNTERPART/canCancel=true 조합을 검토합니다.',
    activeMatch: createActiveMatch({
      unmatchProgress: {
        state: 'WAITING_FOR_COUNTERPART',
        requestedByViewerAt: '2026-04-05T01:30:00.000Z',
        requestedByCounterpartAt: null,
        progressCount: 1,
        requiredCount: 2,
        canRequest: false,
        canCancel: true,
        availableUntil: '2026-04-30T14:59:59.000Z',
      },
    }),
  }),
  postMatchNotRegistered: {
    title: 'Post Match / not registered',
    description:
      '시즌 마감 정리 기간에 이번 시즌 참여 기록이 없는 사용자는 신규 registration·match action 없이 summary/result 안내만 확인합니다.',
    dashboard: createPostMatchNotRegisteredDashboard(),
  },
  postMatchDeregistered: {
    title: 'Post Match / final de-registered',
    description:
      '시즌 오픈·매칭 중 참여 철회/거절로 같은 시즌 재참여가 잠긴 상태가 post-match까지 유지되는지 확인합니다.',
    dashboard: createPostMatchDeregisteredDashboard(),
  },
  postMatchMatched: {
    title: 'Post Match / registered + matched',
    description:
      '확정 매칭 관계는 seasonEndDate 전까지 결과 확인과 matched chat write 예외가 유지되지만 신규 action과 unmatch는 닫힙니다.',
    dashboard: createPostMatchMatchedDashboard(),
  },
  postMatchUnmatched: {
    title: 'Post Match / registered + unmatched after success',
    description:
      '매칭 성공 후 roomSelectionDate 전에 상호 해제되어 최종 결과는 summary history로만 남는 상태입니다.',
    dashboard: createPostMatchUnmatchedDashboard(),
  },
  postMatchRegisteredNotMatched: {
    title: 'Post Match / registered + not matched',
    description: '시즌 참여는 완료했지만 최종 확정 매칭 없이 마감 정리 기간에 들어온 상태입니다.',
    dashboard: createPostMatchRegisteredNotMatchedDashboard(),
  },
  postMatchUserHistory: {
    title: 'Post Match / user history base',
    description:
      '기존 사용자 이력과 post-match result-read 안내를 함께 비교하기 위한 기본 상태입니다.',
    dashboard: createPostMatchBaseDashboard(),
  },
  postMatchRegistrationUnavailable: {
    title: 'Post Match / registration unavailable after cutoff',
    description:
      'roomSelectionDate 이후 post-match에 진입하면 registration finalize는 동일하게 닫히므로, “during register” 예외와 registration-unavailable은 하나의 cutoff 상태로 압축합니다.',
    dashboard: createPostMatchRegistrationUnavailableDashboard(),
  },
  seasonMatchingRegistrationUnavailable: {
    title: 'Season Matching / registration closed after dormitory cutoff',
    description:
      '전체 시즌은 매칭 기간이지만 사용자의 선택 가능 기숙사 roomSelectionDate가 지나 시즌 참여 신청이 닫힌 상태입니다.',
    dashboard: createSeasonMatchingRegistrationUnavailableDashboard(),
  },

  profileCounterpartError: {
    title: 'Profile modal / counterpart error fallback',
    description:
      '확정 룸메 상대 프로필 detail API가 실패했을 때 modal이 safe fallback copy를 보여주는지 확인합니다.',
    dashboard: createSeasonMatchingActiveMatchScenario({
      title: 'Profile modal / counterpart error fallback base',
      description: '상대 프로필 API error fixture를 붙이기 위한 active match dashboard입니다.',
      activeMatch: createActiveMatch(),
    }).dashboard,
    profileMode: 'counterpart-error',
  },
  nonOperatedCampus: {
    title: '비운영 캠퍼스',
    description: '삼척/도계 등 운영 준비 중 캠퍼스의 inert overlay와 계정 확인 CTA를 검토합니다.',
    dashboard: createDashboard('OFF_SEASON', {
      viewer: {
        ...createDashboard('OFF_SEASON').viewer,
        campusOperated: false,
        identity: {
          ...createDashboard('OFF_SEASON').viewer.identity,
          user: {
            ...createDashboard('OFF_SEASON').viewer.identity.user,
            nickname: '삼척유저',
            campus: 'SAMCHEOK',
          },
          displayIdentity: {
            ...createDashboard('OFF_SEASON').viewer.identity.displayIdentity,
            nickname: '삼척유저',
          },
        },
        selection: {
          state: 'NOT_SELECTED',
          dormitoryId: null,
          source: null,
        },
        capabilities: {
          ...createDashboard('OFF_SEASON').viewer.capabilities,
          canEnterRoommateSearch: false,
          canRequestMatch: false,
          canStartChat: false,
        },
      },
    }),
  },
} satisfies Record<string, HomeStoryScenario>;
