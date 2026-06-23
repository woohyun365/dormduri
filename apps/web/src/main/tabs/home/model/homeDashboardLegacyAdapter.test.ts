import { describe, expect, it } from 'vitest';
import { createHomeDashboardFixture } from '@/__fixtures__/home-dashboard';
import {
  hasUpcomingSeasonWindow,
  toLegacyActiveMatch,
  toLegacyBuildingStats,
  toLegacySeasonContext,
} from './homeDashboardLegacyAdapter';

describe('homeDashboardLegacyAdapter', () => {
  it('maps dashboard stats to the legacy HomeTab stats shape without mock fallback values', () => {
    const dashboard = createHomeDashboardFixture({
      stats: {
        totalParticipants: 10,
        assignedParticipants: 8,
        buildingTotal: 4,
        buildingMatchable: 3,
        todayNewTotal: 2,
        todayNewBuilding: 1,
        totalMatchSuccess: 6,
        buildingMatchSuccess: 2,
      },
    });

    expect(toLegacyBuildingStats(dashboard.stats)).toEqual({
      totalParticipants: 10,
      assignedParticipants: 8,
      buildingTotal: 4,
      buildingMatchable: 3,
      todayNewTotal: 2,
      todayNewBuilding: 1,
      totalMatchSuccess: 6,
      buildingMatchSuccess: 2,
      popularCondition: '-',
    });
  });

  it('uses dashboard season schedule as the Home season context source', () => {
    const dashboard = createHomeDashboardFixture();

    expect(
      toLegacySeasonContext(dashboard, {
        season: { name: 'fallback', roomSelectionDate: '2099-12-31' },
        state: 'OFF_SEASON',
        isOpen: false,
        isMatching: false,
        daysUntilEnd: 0,
      }),
    ).toEqual({
      season: { name: '2026년 1학기', roomSelectionDate: '2026-04-30' },
      state: 'SEASON_OPEN',
      isOpen: true,
      isMatching: false,
      daysUntilEnd: 30,
    });
    expect(hasUpcomingSeasonWindow(dashboard)).toBe(true);
  });

  it('maps dashboard active match into the current HomeTab active match shape', () => {
    const dashboard = createHomeDashboardFixture({
      matching: {
        pendingSentCount: 0,
        pendingReceivedCount: 0,
        unreadMessageCount: 0,
        recentReceivedRequests: [],
        activeMatch: {
          id: 'match-1',
          seasonId: 'season-2026-1',
          counterpartUserId: 'user-2',
          counterpartParticipantId: 'participant-2',
          counterpartNickname: '감자친구',
          status: 'ACTIVE',
          startedAt: '2026-04-01T00:00:00.000Z',
          endedAt: null,
          endReason: null,
          createdFromRequestId: 'request-1',
          matchScore: 91,
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
    });

    expect(toLegacyActiveMatch(dashboard)).toMatchObject({
      matchId: 'match-1',
      partnerUserId: 'user-2',
      partnerNickname: '감자친구',
      matchScore: 91,
      scoreType: 'full',
    });
  });
});
