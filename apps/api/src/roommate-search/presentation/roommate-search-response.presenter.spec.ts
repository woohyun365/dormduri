import { createRoommateSearchResponseOwner } from './roommate-search-response.presenter.js';
import { createRoommateSearchTokenOwner } from '../pagination/roommate-search-token.codec.js';

function entry(input: { scoreVisible: boolean; matchScore?: number }) {
  return {
    user: { id: 'target-user' },
    targetParticipant: { id: 'target-participant' },
    sourceProfile: {
      nickname: '가가',
      nicknameNormalized: '가가',
      intro: '',
      lifestyle: {
        smokingBehavior: 'NO',
        sleepHabit: 'NONE',
        relationshipStyle: 'QUIET',
      },
    },
    publicTargetPolicy: {
      sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
      relation: { relationToViewer: 'GENERAL' },
      exposure: {
        detailViewable: input.scoreVisible,
        canViewFull: input.scoreVisible,
        scoreVisible: input.scoreVisible,
      },
      actions: {
        canBookmark: false,
        canRequestMatch: false,
        canStartChat: false,
      },
      resultRead: {
        context: 'NONE',
      },
    },
    ...(typeof input.matchScore === 'number' ? { matchScore: input.matchScore } : {}),
  } as never;
}

const viewerContext = {
  viewer: { id: 'viewer-user' },
  currentSeasonId: 'season-1',
} as never;

describe('roommate-search-response.owner', () => {
  it('score-visible summary는 matchScore와 detailEntryToken을 포함한다', () => {
    const owner = createRoommateSearchResponseOwner(createRoommateSearchTokenOwner());
    const result = owner.toMaterializedItem({
      entry: entry({ scoreVisible: true, matchScore: 95 }),
      viewerContext,
      scope: 'SAME_BUILDING_ONLY',
      purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
      now: new Date('2026-05-31T00:00:00.000Z'),
    });

    expect(result.summary).toMatchObject({
      matchScore: 95,
      exposure: { scoreVisible: true },
    });
    expect(typeof result.summary.detailEntryToken).toBe('string');
    expect(result.cursorBoundary).toMatchObject({ matchScore: 95 });
  });

  it('POST_MATCH_COHORT_REVIEW summary는 policy가 score-visible이어도 list score를 닫는다', () => {
    const owner = createRoommateSearchResponseOwner(createRoommateSearchTokenOwner());
    const result = owner.toMaterializedItem({
      entry: entry({ scoreVisible: true, matchScore: 95 }),
      viewerContext,
      scope: 'SAME_BUILDING_ONLY',
      purpose: 'POST_MATCH_COHORT_REVIEW',
      now: new Date('2026-05-31T00:00:00.000Z'),
    });

    expect(result.summary.exposure.scoreVisible).toBe(false);
    expect(result.summary).not.toHaveProperty('matchScore');
    expect(result.cursorBoundary).not.toHaveProperty('matchScore');
  });

  it('score-visible target에 matchScore가 없으면 materialization을 fail-fast한다', () => {
    const owner = createRoommateSearchResponseOwner(createRoommateSearchTokenOwner());

    expect(() =>
      owner.toMaterializedItem({
        entry: entry({ scoreVisible: true }),
        viewerContext,
        scope: 'SAME_BUILDING_ONLY',
        purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
        now: new Date('2026-05-31T00:00:00.000Z'),
      }),
    ).toThrow('[roommate-search-response-owner] score-visible summary target must have matchScore');
  });
});
