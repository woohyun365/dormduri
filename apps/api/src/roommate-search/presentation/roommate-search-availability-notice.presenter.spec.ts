import { buildRoommateSearchAvailabilityNotices } from './roommate-search-availability-notice.presenter.js';

const summary = (input: {
  canBookmark?: boolean;
  canRequestMatch?: boolean;
  canViewFull?: boolean;
}) =>
  ({
    actions: {
      canBookmark: input.canBookmark ?? false,
      canRequestMatch: input.canRequestMatch ?? false,
    },
    exposure: {
      canViewFull: input.canViewFull ?? true,
    },
  }) as never;

const viewerContext = {
  viewerParticipant: null,
  viewerHasOperatedAssignedDormitory: false,
  serviceState: { seasonState: 'SEASON_POST_MATCH' },
} as never;

describe('roommate-search-availability-notice.presenter', () => {
  it('matched exclusion, actionability, viewer restriction, post-match, detail unavailable, empty result notice를 중복 없이 만든다', () => {
    const notices = buildRoommateSearchAvailabilityNotices({
      viewerContext,
      summaries: [
        summary({ canBookmark: true, canRequestMatch: true }),
        summary({ canViewFull: false }),
      ],
      matchedTargetsExcluded: true,
      filterResultEmpty: true,
    });

    expect(notices.map((notice) => notice.code)).toEqual([
      'MATCHED_TARGETS_EXCLUDED',
      'DISCOVERY_ACTIONABLE_ONLY',
      'SCOPE_RESTRICTED_BY_VIEWER_STATE',
      'POST_MATCH_ACTION_CLOSED',
      'DETAIL_UNAVAILABLE_BY_POLICY',
      'FILTER_RESULT_EMPTY',
    ]);
  });
});
