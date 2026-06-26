import { createHomeDashboardTestResponse } from '@/main/test-support/home-dashboard.builder';
import type { SeasonState } from '@repo/shared/season/runtime';
import type { HomeDashboardResponse } from '@repo/shared/home';

type ActiveMatchSummary = NonNullable<HomeDashboardResponse['matching']['activeMatch']>;
type MatchRequestSummary = HomeDashboardResponse['matching']['recentReceivedRequests'][number];

export interface HomeStoryScenario {
  title: string;
  description: string;
  dashboard: HomeDashboardResponse;
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

function createNoCurrentSeasonWithoutNextSeasonDashboard(): HomeDashboardResponse {
  return {
    ...createNoCurrentSeasonDashboard(),
    nextSeasonPreview: null,
  };
}

function createOpenIncompleteDashboard(): HomeDashboardResponse {
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
        canEnterRoommateSearch: false,
        canCreateOrUpdateSeasonProfileDraft: true,
        canSelectDormitory: true,
        canFinalizeSeasonRegistration: false,
        canRequestMatch: false,
        canStartChat: false,
      },
    },
  };
}

function createOpenRegistrationPendingDashboard(): HomeDashboardResponse {
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
        canSelectDormitory: false,
        canFinalizeRegistration: true,
      },
      selection: {
        state: 'SELECTED',
        dormitoryId: 'dasan',
        source: 'SEASON_PARTICIPANT',
      },
      capabilities: {
        ...base.viewer.capabilities,
        canEnterRoommateSearch: false,
        canCreateOrUpdateSeasonProfileDraft: true,
        canSelectDormitory: false,
        canFinalizeSeasonRegistration: true,
        canRequestMatch: false,
        canStartChat: false,
      },
    },
    matching: {
      ...base.matching,
      pendingSentCount: 0,
      pendingReceivedCount: 0,
      unreadMessageCount: 0,
      recentReceivedRequests: [],
    },
  };
}

function createUnassignedDashboard(): HomeDashboardResponse {
  const base = createDashboard('SEASON_MATCHING');

  return {
    ...base,
    viewer: {
      ...base.viewer,
      selection: {
        state: 'UNASSIGNED',
        dormitoryId: null,
        source: 'SEASON_PARTICIPANT',
      },
      capabilities: {
        ...base.viewer.capabilities,
        canEnterRoommateSearch: false,
        canSelectDormitory: true,
        canRequestMatch: false,
      },
    },
  };
}

function createRegistrationUnavailableDashboard(): HomeDashboardResponse {
  const base = createDashboard('SEASON_OPEN');

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

function createActiveMatch(): ActiveMatchSummary {
  return {
    id: 'active-match-1',
    seasonId: 'season-2026-1',
    counterpartUserId: 'partner-user-1',
    counterpartParticipantId: 'partner-participant-1',
    counterpartNickname: '민지',
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
}

function createReceivedRequest(nickname: string, index: number): MatchRequestSummary {
  return {
    id: `received-request-${index}`,
    seasonId: 'season-2026-1',
    direction: 'RECEIVED',
    counterpartUserId: `counterpart-user-${index}`,
    counterpartParticipantId: `counterpart-participant-${index}`,
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
      detailEntryToken: `story-token-${index}`,
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
  offSeasonNextSeasonNoHistory: {
    title: 'Off season + No history',
    description: '다음 시즌 preview는 있지만 사용자가 이전 시즌에 참여하지 않은 상태를 보여줍니다.',
    dashboard: createNoCurrentSeasonWithoutParticipationHistoryDashboard(),
  },
  offSeasonNextSeasonActiveMatchedHistory: {
    title: 'Off season + active matched history',
    description: '다음 시즌 preview와 함께 사용자의 이전 시즌 매칭 성공 이력을 보여줍니다.',
    dashboard: createNoCurrentSeasonWithMatchedHistoryDashboard(),
  },
  seasonOpenProfileIncomplete: {
    title: '시즌 오픈 / 프로필 준비 필요',
    description: '생활패턴과 건물 선택이 남아 있어 등록 준비 CTA를 우선 노출합니다.',
    dashboard: createOpenIncompleteDashboard(),
  },
  seasonOpenRegistrationPending: {
    title: '시즌 오픈 / 시즌 등록 전',
    description: '생활패턴과 건물 선택은 끝났지만 최종 시즌 등록을 아직 누르지 않은 상태입니다.',
    dashboard: createOpenRegistrationPendingDashboard(),
  },
  seasonOpenRegisteredAssigned: {
    title: '시즌 오픈 / 등록 완료',
    description: '등록은 끝났지만 매칭 요청은 아직 열리지 않은 준비 완료 상태입니다.',
    dashboard: createDashboard('SEASON_OPEN'),
  },
  matchingNoBuilding: {
    title: '매칭 기간 / 건물 미배정',
    description: '건물 배정이 없어 탐색과 요청이 잠긴 상태의 안내입니다.',
    dashboard: createUnassignedDashboard(),
  },
  registrationUnavailable: {
    title: '시즌 오픈 / 등록 불가 reason',
    description:
      '등록 불가 reason이 있을 때 checklist와 quick action이 사용자용 사유를 보여줍니다.',
    dashboard: createRegistrationUnavailableDashboard(),
  },
  matchingPendingReceived: {
    title: '매칭 기간 / 받은 요청 있음',
    description: '받은 요청이 있어 응답 CTA와 expiring summary를 확인하는 상태입니다.',
    dashboard: createDashboard('SEASON_MATCHING', {
      matching: {
        ...createDashboard('SEASON_MATCHING').matching,
        pendingSentCount: 0,
        pendingReceivedCount: 2,
        unreadMessageCount: 1,
        recentReceivedRequests: [
          createReceivedRequest('서연', 1),
          createReceivedRequest('지우', 2),
        ],
      },
    }),
  },
  matchingPendingSent: {
    title: '매칭 기간 / 보낸 요청 대기',
    description: '보낸 요청은 있지만 아직 수락된 매칭은 없는 진행 상태입니다.',
    dashboard: createDashboard('SEASON_MATCHING', {
      matching: {
        ...createDashboard('SEASON_MATCHING').matching,
        pendingSentCount: 3,
        pendingReceivedCount: 0,
        unreadMessageCount: 0,
        recentReceivedRequests: [],
      },
    }),
  },
  activeMatchUnreadChat: {
    title: '매칭 확정 / 읽지 않은 채팅',
    description: '확정된 룸메와 unread chat이 있는 상태의 결과·채팅 CTA를 확인합니다.',
    dashboard: (() => {
      const activeMatch = createActiveMatch();
      return createDashboard('SEASON_MATCHING', {
        viewer: {
          ...createDashboard('SEASON_MATCHING').viewer,
          match: {
            hasActiveMatch: true,
            activeMatch,
          },
        },
        matching: {
          ...createDashboard('SEASON_MATCHING').matching,
          pendingSentCount: 0,
          pendingReceivedCount: 0,
          unreadMessageCount: 5,
          activeMatch,
          recentReceivedRequests: [],
        },
      });
    })(),
  },
  postMatchHistory: {
    title: '시즌 마감 / 결과 확인',
    description: '새 요청은 닫히고 결과·이전 기록 중심으로 이동하는 post-match 상태입니다.',
    dashboard: createDashboard('SEASON_POST_MATCH'),
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
  onboardingNoticeOpen: {
    title: '서비스 시작 안내 열림',
    description: '계정 단위 service-intro 안내를 아직 닫지 않은 사용자의 bottom sheet 상태입니다.',
    dashboard: (() => {
      const base = createDashboard('SEASON_OPEN');
      return {
        ...base,
        viewer: {
          ...base.viewer,
          onboarding: {
            dismissedNotices: [
              {
                noticeKey: 'service-intro' as const,
                dismissed: false,
                dismissedAt: null,
              },
            ],
          },
        },
      };
    })(),
  },
  onboardingNoticeDismissed: {
    title: '서비스 시작 안내 닫힘',
    description: 'service-intro를 이미 다시 보지 않기로 닫은 사용자의 기본 Home 상태입니다.',
    dashboard: createDashboard('SEASON_OPEN'),
  },
} satisfies Record<string, HomeStoryScenario>;
