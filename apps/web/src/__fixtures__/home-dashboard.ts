import type { HomeDashboardResponse } from '@repo/shared/home';

export function createHomeDashboardFixture(
  overrides: Partial<HomeDashboardResponse> = {},
): HomeDashboardResponse {
  const base: HomeDashboardResponse = {
    season: {
      hasCurrentSeason: true,
      state: 'SEASON_OPEN',
      summary: {
        id: 'season-2026-1',
        name: '2026년 1학기',
        preparationStartDate: '2026-03-01',
        matchingStartDate: '2026-03-29',
        seasonEndDate: '2026-06-30',
      },
      schedule: {
        preparationStart: '2026-03-01',
        matchingStart: '2026-03-29',
        matchingEnd: '2026-04-30',
        seasonEnd: '2026-06-30',
      },
      isOpen: true,
      isMatching: false,
      isPostMatch: false,
      daysUntilMatchingEnd: 30,
      daysUntilSeasonEnd: 92,
    },
    viewer: {
      campusOperated: true,
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
        state: 'SELECTED',
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
