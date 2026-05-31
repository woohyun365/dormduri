import type { VisibleProfileViewerContext } from './visible-profile-owner.js';
import {
  resolveRoommateSearchScopeAvailability,
  resolveRoommateSearchScopeContext,
} from './roommate-search-scope.owner.js';

function viewerContext(
  overrides: Partial<VisibleProfileViewerContext> = {},
): VisibleProfileViewerContext {
  return {
    viewer: {
      id: 'viewer',
      emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
      gender: 'M',
      campus: 'CHUNCHEON',
    },
    viewerParticipant: {
      id: 'participant-viewer',
      seasonId: 'season-1',
      userId: 'viewer',
      participationIntent: 'REGISTERED',
      registeredAt: new Date('2026-01-10T00:00:00.000Z'),
      declinedAt: null,
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
      participantStatus: 'ACTIVE',
      campusCodeSnapshot: 'CHUNCHEON',
      genderSnapshot: 'M',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
      activatedAt: new Date('2026-01-10T00:00:00.000Z'),
      matchedAt: null,
      withdrawnAt: null,
      expiredAt: null,
      hiddenByAdminAt: null,
      hiddenReasonCode: null,
      hiddenReasonDetail: null,
      deactivatedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      profile: null,
    },
    viewerSelection: {
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
      source: 'SEASON_PARTICIPANT',
    },
    viewerLifestyle: null,
    viewerSeasonProfileComplete: true,
    viewerHasOperatedAssignedDormitory: true,
    currentSeasonId: 'season-1',
    seasonReferenceYear: 2026,
    serviceState: {
      campusOperated: true,
      seasonState: 'SEASON_MATCHING',
    },
    operatedDormitoryIds: new Set(['dasan']),
    currentDormitoryCanMatch: true,
    ...overrides,
  };
}

describe('roommate-search-scope.owner', () => {
  it('OFF_SEASON은 모든 browse scope를 닫는다', () => {
    expect(
      resolveRoommateSearchScopeAvailability(
        viewerContext({
          serviceState: { campusOperated: true, seasonState: 'OFF_SEASON' },
          currentSeasonId: null,
        }),
      ),
    ).toEqual({ campusMerged: false, sameBuildingOnly: false });
  });

  it('등록+배정 viewer의 scope purpose를 season state에 맞춰 분리한다', () => {
    expect(
      resolveRoommateSearchScopeContext(
        viewerContext({ serviceState: { campusOperated: true, seasonState: 'SEASON_OPEN' } }),
        'SAME_BUILDING_ONLY',
      ),
    ).toMatchObject({
      scopeAvailability: { campusMerged: true, sameBuildingOnly: true },
      scope: 'SAME_BUILDING_ONLY',
      purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
    });

    expect(
      resolveRoommateSearchScopeContext(
        viewerContext({
          serviceState: { campusOperated: true, seasonState: 'SEASON_POST_MATCH' },
        }),
        'SAME_BUILDING_ONLY',
      ).purpose,
    ).toBe('POST_MATCH_COHORT_REVIEW');
  });

  it('SEASON_MATCHING 미등록 viewer는 campus broad preview만 사용할 수 있다', () => {
    const context = viewerContext({
      viewerParticipant: {
        ...viewerContext().viewerParticipant!,
        participationIntent: 'UNDECIDED',
        registeredAt: null,
        dormitoryId: null,
        dormitorySelectionState: 'NOT_SELECTED',
        participantStatus: 'NOT_STARTED',
      },
      viewerSelection: {
        dormitoryId: null,
        dormitorySelectionState: 'NOT_SELECTED',
        source: 'SEASON_PARTICIPANT',
      },
      viewerHasOperatedAssignedDormitory: false,
    });

    expect(resolveRoommateSearchScopeContext(context, undefined)).toMatchObject({
      scopeAvailability: { campusMerged: true, sameBuildingOnly: false },
      scope: 'CAMPUS_MERGED',
      purpose: 'BROAD_PREVIEW',
    });
    expect(() => resolveRoommateSearchScopeContext(context, 'SAME_BUILDING_ONLY')).toThrow();
  });
});
