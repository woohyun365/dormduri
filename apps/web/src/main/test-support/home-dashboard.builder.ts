import type { HomeDashboardResponse } from '@repo/shared/home';

export function createHomeDashboardTestResponse(
  overrides: Partial<HomeDashboardResponse> = {},
): HomeDashboardResponse {
  const base: HomeDashboardResponse = {
    season: {
      hasCurrentSeason: true,
      state: 'SEASON_OPEN',
      summary: {
        id: 'season-2026-2',
        name: '2026년 2학기',
        preparationStartDate: '2026-07-23',
        matchingStartDate: '2026-08-01',
        seasonEndDate: '2026-08-31',
      },
      schedule: {
        preparationStart: '2026-07-23',
        matchingStart: '2026-08-01',
        matchingEnd: '2026-08-20',
        seasonEnd: '2026-08-31',
      },
      isOpen: true,
      isMatching: false,
      isPostMatch: false,
      daysUntilMatchingEnd: 54,
      daysUntilSeasonEnd: 65,
      operatedDormitories: [
        { dormitoryId: 'daon', isOperated: true, roomSelectionDate: '2026-08-06' },
        { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-08-06' },
        { dormitoryId: 'irum', isOperated: true, roomSelectionDate: '2026-08-06' },
        { dormitoryId: 'saerom', isOperated: true, roomSelectionDate: '2026-08-06' },
        { dormitoryId: 'yeji', isOperated: true, roomSelectionDate: '2026-08-06' },
      ],
    },
    viewer: {
      campusOperated: true,
      identity: {
        user: {
          id: 'user-1',
          email: 'home-user@kangwon.ac.kr',
          nickname: '홈유저',
          gender: 'F',
          campus: 'CHUNCHEON',
        },
        displayIdentity: {
          userId: 'user-1',
          nickname: '홈유저',
          nicknameSource: 'USER_DISPLAY_IDENTITY',
          nicknameChangedAt: null,
        },
        academicIdentity: {
          collegeCode: 'IT',
          birthYear: 2002,
        },
      },
      seasonProfile: {
        hasCurrentSeason: true,
        hasParticipantRow: true,
        intent: 'REGISTERED',
        registered: true,
        profileExists: true,
        profileState: 'REGISTRATION_FINALIZED',
        completion: {
          profileCompletionRequired: false,
          dormitorySelectionRequired: false,
          registrationUnavailable: false,
          registrationUnavailableReasons: [],
        },
        draftWritable: false,
        canSelectDormitory: false,
        canFinalizeRegistration: false,
      },
      selection: {
        state: 'ASSIGNED',
        dormitoryId: 'dasan',
        source: 'SEASON_PARTICIPANT',
      },
      match: {
        hasActiveMatch: false,
        activeMatch: null,
      },
      capabilities: {
        canEnterRoommateSearch: true,
        canCreateOrUpdateSeasonProfileDraft: false,
        canSelectDormitory: false,
        canFinalizeSeasonRegistration: false,
        canRequestMatch: true,
        canStartChat: true,
        canViewMatchHistory: true,
      },
      onboarding: {
        dismissedNotices: [
          {
            noticeKey: 'service-intro',
            dismissed: false,
            dismissedAt: null,
          },
        ],
      },
    },
    stats: {
      totalParticipants: 237,
      assignedParticipants: 190,
      buildingTotal: 64,
      buildingMatchable: 41,
      todayNewTotal: 8,
      todayNewBuilding: 3,
      totalMatchSuccess: 42,
      buildingMatchSuccess: 12,
    },
    seasonHistorySummary: {
      lastSeason: {
        id: 'season-2025-2',
        name: '2025년 2학기',
        totalParticipants: 210,
        totalMatchSuccess: 38,
        viewerHadRegistration: true,
        viewerHadMatchSuccess: false,
        viewerActivity: {
          sentRequestCount: 2,
          receivedRequestCount: 1,
          conversationCount: 0,
          finalResult: 'NO_MATCH',
          matchedPartnerNickname: null,
        },
        aggregate: {
          matchedPairCount: 19,
          operatedDormitoryCount: 5,
        },
      },
    },
    nextSeasonPreview: {
      id: 'season-2026-2',
      name: '2026년 2학기',
      preparationStartDate: '2026-07-23',
      matchingStartDate: '2026-08-01',
      seasonEndDate: '2026-08-31',
      visibleToUser: true,
      operatedDormitories: [
        { dormitoryId: 'daon', isOperated: true, roomSelectionDate: '2026-08-06' },
        { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-08-06' },
        { dormitoryId: 'irum', isOperated: true, roomSelectionDate: '2026-08-06' },
        { dormitoryId: 'saerom', isOperated: true, roomSelectionDate: '2026-08-06' },
        { dormitoryId: 'yeji', isOperated: true, roomSelectionDate: '2026-08-06' },
      ],
    },
    matching: {
      pendingSentCount: 1,
      pendingReceivedCount: 2,
      unreadMessageCount: 3,
      activeMatch: null,
      recentReceivedRequests: [],
    },
    generatedAt: '2026-06-23T00:00:00.000Z',
  };

  return {
    ...base,
    ...overrides,
  };
}
