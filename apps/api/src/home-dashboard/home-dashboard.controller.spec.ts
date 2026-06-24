import { describe, expect, it, vi } from 'vitest';
import { homeDashboardResponseSchema, type HomeDashboardResponse } from '@repo/shared/home';
import { HomeDashboardController } from './home-dashboard.controller.js';
import type { HomeDashboardQueryPort } from './home-dashboard.tokens.js';

const authUser = {
  id: 'user-1',
  gender: 'M',
  campus: 'CHUNCHEON',
} as const;

describe('HomeDashboardController', () => {
  it('GET /api/home/dashboard는 read-only dashboard query로 위임하고 shared contract를 반환한다', async () => {
    const dashboard = makeHomeDashboardResponse();
    const execute = vi.fn().mockResolvedValue(dashboard);
    const query: HomeDashboardQueryPort = { execute };
    const controller = new HomeDashboardController(query);

    await expect(controller.getDashboard(authUser)).resolves.toBe(dashboard);

    expect(execute).toHaveBeenCalledWith(authUser);
    expect(homeDashboardResponseSchema.safeParse(dashboard).success).toBe(true);
  });
});

function makeHomeDashboardResponse(): HomeDashboardResponse {
  return {
    season: {
      hasCurrentSeason: false,
      state: 'OFF_SEASON',
      summary: null,
      schedule: null,
      isOpen: false,
      isMatching: false,
      isPostMatch: false,
      daysUntilMatchingEnd: null,
      daysUntilSeasonEnd: null,
    },
    viewer: {
      campusOperated: true,
      seasonProfile: {
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
      selection: { state: 'NOT_SELECTED', dormitoryId: null, source: null },
      match: { hasActiveMatch: false, activeMatch: null },
      capabilities: {
        canEnterRoommateSearch: false,
        canCreateOrUpdateSeasonProfileDraft: false,
        canSelectDormitory: false,
        canFinalizeSeasonRegistration: false,
        canRequestMatch: false,
        canStartChat: false,
        canViewMatchHistory: false,
      },
      onboarding: {
        dismissedNotices: [{ noticeKey: 'service-intro', dismissed: false, dismissedAt: null }],
      },
    },
    stats: {
      totalParticipants: 0,
      assignedParticipants: 0,
      buildingTotal: 0,
      buildingMatchable: 0,
      todayNewTotal: 0,
      todayNewBuilding: 0,
      totalMatchSuccess: 0,
      buildingMatchSuccess: 0,
    },
    matching: {
      pendingSentCount: 0,
      pendingReceivedCount: 0,
      unreadMessageCount: 0,
      activeMatch: null,
      recentReceivedRequests: [],
    },
    generatedAt: '2026-02-10T03:00:00.000Z',
  };
}
