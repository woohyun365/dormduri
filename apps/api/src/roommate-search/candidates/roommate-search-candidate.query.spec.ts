import { describe, expect, it, vi } from 'vitest';
import {
  buildRoommateSearchCandidateWhere,
  createRoommateSearchCandidateQuery,
} from './roommate-search-candidate.query.js';
import type { VisibleProfileViewerContext } from '../../profiles/contracts/profile-public-target-reader.port.js';
import { currentParticipant } from '../../season-participants/test-support/season-participants.spec-fixtures.js';

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

describe('roommate-search-candidate.query', () => {
  it('미등록 viewer의 SAME_BUILDING_ONLY gate scope는 후보 DB 조회 없이 빈 목록을 반환한다', async () => {
    const findMany = vi.fn();
    const query = createRoommateSearchCandidateQuery({
      prisma: {
        seasonParticipant: { findMany },
      } as never,
    });

    const result = await query.findCandidates({
      viewerContext: {
        ...viewerContext,
        viewerParticipant: currentParticipant({
          id: 'viewer-participant',
          userId: 'viewer-user',
          participationIntent: 'UNDECIDED',
          registeredAt: null,
          dormitoryId: null,
          dormitorySelectionState: 'NOT_SELECTED',
          participantStatus: 'NOT_STARTED',
        }) as NonNullable<VisibleProfileViewerContext['viewerParticipant']>,
        viewerSelection: {
          dormitoryId: null,
          dormitorySelectionState: 'NOT_SELECTED',
          source: 'SEASON_PARTICIPANT',
        },
        viewerHasOperatedAssignedDormitory: false,
      },
      scope: 'SAME_BUILDING_ONLY',
      query: { scope: 'SAME_BUILDING_ONLY', limit: 20 },
    });

    expect(result).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('SAME_BUILDING_ONLY candidate query는 registration complete public target 후보를 DB 조건으로 먼저 줄인다', () => {
    const where = buildRoommateSearchCandidateWhere({
      viewerContext,
      scope: 'SAME_BUILDING_ONLY',
      query: {
        scope: 'SAME_BUILDING_ONLY',
        college: { operator: 'EXCLUDE', values: ['CHUNCHEON_IT'] },
        mbtiTraits: { energy: 'E', decision: 'T' },
        ageBand: { values: ['20'] },
        limit: 20,
      },
    });

    expect(where).toMatchObject({
      id: { not: 'viewer-participant' },
      seasonId: 'season-1',
      userId: { not: 'viewer-user' },
      campusCodeSnapshot: 'CHUNCHEON',
      genderSnapshot: 'M',
      participationIntent: 'REGISTERED',
      registeredAt: { not: null },
      dormitorySelectionState: 'ASSIGNED',
      dormitoryId: 'dasan',
      participantStatus: { notIn: ['WITHDRAWN', 'EXPIRED'] },
      hiddenByAdminAt: null,
      deactivatedAt: null,
      user: {
        deletedAt: null,
      },
    });
    expect(where.user).toEqual({ deletedAt: null });
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
      collegeCode: { notIn: ['CHUNCHEON_IT'] },
      OR: [{ birthYear: 2007 }],
    });
    expect(filterCondition.mbti.in).toEqual(expect.arrayContaining(['ENTJ', 'ESTJ']));
  });

  it('ageBand query는 시즌 기준 연도가 바뀌면 같은 한국식 나이 code를 다음 birthYear로 변환한다', () => {
    const where = buildRoommateSearchCandidateWhere({
      viewerContext: {
        ...viewerContext,
        seasonReferenceYear: 2027,
      },
      scope: 'SAME_BUILDING_ONLY',
      query: {
        scope: 'SAME_BUILDING_ONLY',
        ageBand: { values: ['20', '25_PLUS'] },
        limit: 20,
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

    const filterCondition = profileWhere.is.AND.at(1) as {
      OR: Array<{ birthYear: number } | { birthYear: { lte: number } }>;
    };

    expect(filterCondition.OR).toEqual([{ birthYear: 2008 }, { birthYear: { lte: 2003 } }]);
  });
});
