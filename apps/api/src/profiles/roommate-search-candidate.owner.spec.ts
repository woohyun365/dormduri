import { buildRoommateSearchCandidateWhere } from './roommate-search-candidate.owner.js';
import type { VisibleProfileViewerContext } from './targets/public-profile-target.types.js';
import { currentParticipant } from '../season-participants/test-support/season-participants.spec-fixtures.js';

const viewerContext = {
  viewer: {
    id: 'viewer-user',
    emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    gender: 'M',
    campus: 'CHUNCHEON',
  },
  viewerParticipant: currentParticipant({
    id: 'viewer-participant',
    userId: 'viewer-user',
    dormitoryId: 'dasan',
    dormitorySelectionState: 'ASSIGNED',
  }) as NonNullable<VisibleProfileViewerContext['viewerParticipant']>,
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
} satisfies VisibleProfileViewerContext;

describe('roommate-search-candidate.owner', () => {
  it('SAME_BUILDING_ONLY candidate query는 registration complete public target 후보를 DB 조건으로 먼저 줄인다', () => {
    const where = buildRoommateSearchCandidateWhere({
      viewerContext,
      scope: 'SAME_BUILDING_ONLY',
      query: {
        scope: 'SAME_BUILDING_ONLY',
        college: { operator: 'EXCLUDE', values: ['IT'] },
        mbtiTraits: { energy: 'E', decision: 'T' },
        ageBand: { values: ['24'] },
        limit: 20,
      },
    });

    expect(where).toMatchObject({
      id: { not: 'viewer-participant' },
      seasonId: 'season-1',
      userId: { not: 'viewer-user' },
      participationIntent: 'REGISTERED',
      registeredAt: { not: null },
      dormitorySelectionState: 'ASSIGNED',
      dormitoryId: 'dasan',
      participantStatus: { notIn: ['WITHDRAWN', 'EXPIRED'] },
      hiddenByAdminAt: null,
      deactivatedAt: null,
      user: {
        deletedAt: null,
        campus: 'CHUNCHEON',
        gender: 'M',
      },
    });
    const profileWhere = where.profile;
    if (
      !profileWhere ||
      typeof profileWhere !== 'object' ||
      !('is' in profileWhere) ||
      !profileWhere.is ||
      typeof profileWhere.is !== 'object' ||
      !('AND' in profileWhere.is) ||
      !Array.isArray(profileWhere.is.AND)
    ) {
      throw new Error('expected profile AND candidate where');
    }

    const [completeProfileCondition, filterCondition] = profileWhere.is.AND as [
      {
        collegeCode: { not: null };
        birthYear: { not: null };
        grade: { not: null };
        mbti: { not: null };
        bedtime: { not: null };
      },
      {
        collegeCode: { notIn: string[] };
        mbti: { in: string[] };
        OR: Array<{ birthYear: number }>;
      },
    ];

    expect(completeProfileCondition).toMatchObject({
      collegeCode: { not: null },
      birthYear: { not: null },
      grade: { not: null },
      mbti: { not: null },
      bedtime: { not: null },
    });
    expect(filterCondition).toMatchObject({
      collegeCode: { notIn: ['IT'] },
      OR: [{ birthYear: 2002 }],
    });
    expect(filterCondition.mbti.in).toEqual(expect.arrayContaining(['ENTJ', 'ESTJ']));
  });
});
