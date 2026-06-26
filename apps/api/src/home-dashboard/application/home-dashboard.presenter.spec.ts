import { describe, expect, it } from 'vitest';
import { homeDashboardResponseSchema, type HomeDashboardMatching } from '@repo/shared/home';
import { HomeDashboardPresenter } from './home-dashboard.presenter.js';
import {
  makeCurrentUserResponse,
  makeNextSeasonPreview,
  makeSeasonContext,
  makeSeasonHistorySummary,
} from '../test-support/home-dashboard.spec-fixtures.js';

describe('HomeDashboardPresenter', () => {
  it('current-user와 season context를 HomeDashboardResponse allowlist로 매핑한다', () => {
    const presenter = new HomeDashboardPresenter();
    const response = presenter.build({
      currentUser: makeCurrentUserResponse({ seasonState: 'SEASON_POST_MATCH' }),
      seasonContext: makeSeasonContext({ state: 'SEASON_POST_MATCH' }),
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
      matching: makeEmptyMatching(),
      seasonHistorySummary: makeSeasonHistorySummary(),
      nextSeasonPreview: makeNextSeasonPreview(),
      canViewMatchHistory: true,
      generatedAt: new Date('2026-02-10T03:00:00.000Z'),
    });

    expect(homeDashboardResponseSchema.safeParse(response).success).toBe(true);
    expect(response.season).toMatchObject({
      hasCurrentSeason: true,
      state: 'SEASON_POST_MATCH',
      isPostMatch: true,
    });
    expect(response.viewer.identity).toMatchObject({
      user: { id: 'user-1', email: 'user1@kangwon.ac.kr', nickname: '감자룸메' },
      displayIdentity: { userId: 'user-1', nickname: '감자룸메' },
      academicIdentity: { collegeCode: 'IT', birthYear: 2002 },
    });
    expect(response.seasonHistorySummary.lastSeason).toMatchObject({
      id: 'season-previous',
      totalParticipants: 120,
      totalMatchSuccess: 36,
    });
    expect(response.nextSeasonPreview).toMatchObject({ id: 'season-next', visibleToUser: true });
    expect(response.viewer.capabilities).toMatchObject({
      canRequestMatch: false,
      canStartChat: false,
      canViewMatchHistory: true,
    });
  });

  it('비운영 campus/no season 상태는 fail-closed dashboard로 반환한다', () => {
    const presenter = new HomeDashboardPresenter();
    const response = presenter.build({
      currentUser: makeCurrentUserResponse({ campusOperated: false, seasonState: null }),
      seasonContext: null,
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
      matching: makeEmptyMatching(),
      seasonHistorySummary: makeSeasonHistorySummary(),
      nextSeasonPreview: makeNextSeasonPreview(),
      canViewMatchHistory: false,
      generatedAt: new Date('2026-02-10T03:00:00.000Z'),
    });

    expect(response.season).toMatchObject({
      hasCurrentSeason: false,
      state: null,
      summary: null,
      schedule: null,
    });
    expect(response.viewer.campusOperated).toBe(false);
    expect(response.viewer.capabilities.canEnterRoommateSearch).toBe(false);
  });

  it('internal/safety/raw retention 필드는 response에 포함하지 않는다', () => {
    const presenter = new HomeDashboardPresenter();
    const response = presenter.build({
      currentUser: makeCurrentUserResponse(),
      seasonContext: makeSeasonContext(),
      stats: {
        totalParticipants: 1,
        assignedParticipants: 1,
        buildingTotal: 1,
        buildingMatchable: 0,
        todayNewTotal: 1,
        todayNewBuilding: 1,
        totalMatchSuccess: 0,
        buildingMatchSuccess: 0,
      },
      matching: makeEmptyMatching(),
      seasonHistorySummary: makeSeasonHistorySummary(),
      nextSeasonPreview: makeNextSeasonPreview(),
      canViewMatchHistory: false,
      generatedAt: new Date('2026-02-10T03:00:00.000Z'),
    });

    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain('hiddenByAdminAt');
    expect(serialized).not.toContain('deactivatedAt');
    expect(serialized).not.toContain('deletedAt');
    expect(serialized).not.toContain('retention');
    expect(serialized).not.toContain('moderation');
    expect(serialized).not.toContain('hiddenReasonDetail');
    expect(serialized).not.toContain('sessionToken');
    expect(serialized).not.toContain('refreshToken');
    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain('audit');
  });
});

function makeEmptyMatching(): HomeDashboardMatching {
  return {
    pendingSentCount: 0,
    pendingReceivedCount: 0,
    unreadMessageCount: 0,
    activeMatch: null,
    recentReceivedRequests: [],
  };
}
