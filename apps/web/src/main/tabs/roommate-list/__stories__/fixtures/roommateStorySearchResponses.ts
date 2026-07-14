import type {
  RoommateSearchManifestResponse,
  RoommateSearchResponse,
  RoommateSearchScope,
} from '@repo/shared/roommate-search/contract';
import type { SeasonContextValue } from '@/main/contexts/SeasonContext';
import { createManifest, createSearchResponse } from './roommateStoryBuilders';
import {
  POST_MATCH_CLOSED_ACTIONS,
  NO_RESULT_READ,
  SUMMARY_ONLY_EXPOSURE,
} from './roommateStoryBuilders';
import {
  blockedUserSummary,
  campusPreviewSummary,
  directionLimitReachedSummary,
  emptyIntroSummary,
  errorSummary,
  fullCompatibilitySummaries,
  hayoonSummary,
  jiwooSummary,
  receivedPendingRequestSummary,
  scoreCalculationFailedSummary,
  seasonMatchingChattingSummary,
  seasonMatchingSameDormitorySummaries,
  seasonOpenCampusPreviewSummaries,
  seasonOpenChattingSummary,
  seasonOpenSameDormitorySummaries,
  sentPendingRequestSummary,
  tombstoneSummary,
  viewerAlreadyMatchedSummary,
} from './roommateStoryProfiles';

export const SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY = {
  campusMerged: true,
  sameBuildingOnly: true,
} as const satisfies RoommateSearchResponse['scopeAvailability'];

export const SEASON_MATCHING_NOT_REGISTERED_SCOPE_AVAILABILITY = {
  campusMerged: true,
  sameBuildingOnly: true,
} as const satisfies RoommateSearchResponse['scopeAvailability'];

export const DEREGISTERED_SCOPE_TOGGLE_AVAILABILITY = {
  campusMerged: true,
  sameBuildingOnly: true,
} as const satisfies RoommateSearchResponse['scopeAvailability'];

export const DEREGISTERED_SAME_DORMITORY_EMPTY_STATE = {
  title: '시즌 참여 철회 후 같은 건물 후보를 볼 수 없어요.',
  message: '캠퍼스 전체 요약은 볼 수 있지만, 같은 건물 후보 리스트와 생활패턴 비교는 닫혀요.',
} as const;

export const actionableSearch = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  notices: [{ code: 'DISCOVERY_ACTIONABLE_ONLY', severity: 'INFO' }],
  items: [jiwooSummary, hayoonSummary],
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});

export const fullCompatibilitySearch = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  notices: [{ code: 'DISCOVERY_ACTIONABLE_ONLY', severity: 'INFO' }],
  items: fullCompatibilitySummaries,
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});

export const scoreCalculationFailedSearch = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  items: [scoreCalculationFailedSummary],
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});
export const emptyIntroDetailSearch = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  items: [emptyIntroSummary],
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});

export const seasonMatchingRegisteredSameDormitory = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  notices: [{ code: 'DISCOVERY_ACTIONABLE_ONLY', severity: 'INFO' }],
  items: seasonMatchingSameDormitorySummaries,
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});
export const seasonMatchingRegisteredCampusMerged = createSearchResponse({
  scope: 'CAMPUS_MERGED',
  purpose: 'BROAD_PREVIEW',
  items: seasonOpenCampusPreviewSummaries,
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});
export const seasonMatchingRegisteredChattingSearch = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  notices: [{ code: 'DISCOVERY_ACTIONABLE_ONLY', severity: 'INFO' }],
  items: [seasonMatchingChattingSummary, ...seasonMatchingSameDormitorySummaries.slice(0, 2)],
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});
export const seasonMatchingRegisteredSearchResponses = {
  CAMPUS_MERGED: seasonMatchingRegisteredCampusMerged,
  SAME_BUILDING_ONLY: seasonMatchingRegisteredSameDormitory,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
export const seasonMatchingRegisteredChattingSearchResponses = {
  CAMPUS_MERGED: seasonMatchingRegisteredCampusMerged,
  SAME_BUILDING_ONLY: seasonMatchingRegisteredChattingSearch,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;

export const seasonMatchingActiveMatchedSearch = createSearchResponse({
  scope: 'CAMPUS_MERGED',
  purpose: 'BROAD_PREVIEW',
  items: seasonOpenCampusPreviewSummaries,
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});
export const seasonMatchingActiveMatchedSameDormitory = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'BROAD_PREVIEW',
  notices: [
    {
      code: 'MATCHED_TARGETS_EXCLUDED',
      severity: 'INFO',
      message: '이미 매칭된 상태에서는 새 후보 매칭 행동이 닫혀요.',
    },
  ],
  items: [viewerAlreadyMatchedSummary],
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});
export const seasonMatchingActiveMatchedSearchResponses = {
  CAMPUS_MERGED: seasonMatchingActiveMatchedSearch,
  SAME_BUILDING_ONLY: seasonMatchingActiveMatchedSameDormitory,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;

export const seasonMatchingUnmatchedSearch = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  notices: [{ code: 'DISCOVERY_ACTIONABLE_ONLY', severity: 'INFO' }],
  items: [jiwooSummary, hayoonSummary, directionLimitReachedSummary],
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});
export const seasonMatchingUnmatchedSearchResponses = {
  CAMPUS_MERGED: seasonMatchingRegisteredCampusMerged,
  SAME_BUILDING_ONLY: seasonMatchingUnmatchedSearch,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;

export const seasonMatchingPendingRequestsSearch = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  notices: [{ code: 'DISCOVERY_ACTIONABLE_ONLY', severity: 'INFO' }],
  items: [sentPendingRequestSummary, receivedPendingRequestSummary],
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});

export const seasonMatchingNotRegisteredCampusMerged = createSearchResponse({
  scope: 'CAMPUS_MERGED',
  purpose: 'BROAD_PREVIEW',
  items: seasonOpenCampusPreviewSummaries,
  scopeAvailability: SEASON_MATCHING_NOT_REGISTERED_SCOPE_AVAILABILITY,
});

export const seasonMatchingNotRegisteredCampusMergedEmpty = createSearchResponse({
  scope: 'CAMPUS_MERGED',
  purpose: 'BROAD_PREVIEW',
  items: [],
  scopeAvailability: SEASON_MATCHING_NOT_REGISTERED_SCOPE_AVAILABILITY,
});
export const seasonMatchingNotRegisteredSameDormitoryGate = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'BROAD_PREVIEW',
  items: [],
  scopeAvailability: SEASON_MATCHING_NOT_REGISTERED_SCOPE_AVAILABILITY,
});
export const seasonMatchingNotRegisteredSearchResponses = {
  CAMPUS_MERGED: seasonMatchingNotRegisteredCampusMerged,
  SAME_BUILDING_ONLY: seasonMatchingNotRegisteredSameDormitoryGate,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
export const seasonMatchingNotRegisteredEmptySearchResponses = {
  CAMPUS_MERGED: seasonMatchingNotRegisteredCampusMergedEmpty,
  SAME_BUILDING_ONLY: seasonMatchingNotRegisteredSameDormitoryGate,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;

export const seasonMatchingDeregisteredCampusMerged = createSearchResponse({
  scope: 'CAMPUS_MERGED',
  purpose: 'BROAD_PREVIEW',
  items: seasonOpenCampusPreviewSummaries,
  scopeAvailability: DEREGISTERED_SCOPE_TOGGLE_AVAILABILITY,
});

export const seasonMatchingDeregisteredSameDormitoryGate = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'BROAD_PREVIEW',
  items: [],
  scopeAvailability: DEREGISTERED_SCOPE_TOGGLE_AVAILABILITY,
});

export const seasonMatchingRegisteredEmpty = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  notices: [{ code: 'FILTER_RESULT_EMPTY', severity: 'INFO' }],
  items: [],
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});
export const seasonMatchingRegisteredCampusMergedEmpty = createSearchResponse({
  scope: 'CAMPUS_MERGED',
  purpose: 'BROAD_PREVIEW',
  items: [],
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});
export const seasonMatchingRegisteredEmptySearchResponses = {
  CAMPUS_MERGED: seasonMatchingRegisteredCampusMergedEmpty,
  SAME_BUILDING_ONLY: seasonMatchingRegisteredEmpty,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;

export const campusMergedForUnregistered = createSearchResponse({
  scope: 'CAMPUS_MERGED',
  purpose: 'BROAD_PREVIEW',
  notices: [{ code: 'SCOPE_RESTRICTED_BY_VIEWER_STATE', severity: 'INFO' }],
  items: [campusPreviewSummary],
  scopeAvailability: { campusMerged: true, sameBuildingOnly: false },
});
export const seasonOpenRegisteredCampusMerged = createSearchResponse({
  scope: 'CAMPUS_MERGED',
  purpose: 'BROAD_PREVIEW',
  items: seasonOpenCampusPreviewSummaries,
});
export const seasonOpenRegisteredSameDormitory = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  items: seasonOpenSameDormitorySummaries,
});
export const seasonOpenRegisteredChattingSearch = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  items: [seasonOpenChattingSummary, ...seasonOpenSameDormitorySummaries.slice(0, 2)],
});
export const seasonOpenRegisteredCampusMergedEmpty = createSearchResponse({
  scope: 'CAMPUS_MERGED',
  purpose: 'BROAD_PREVIEW',
  items: [],
});
export const seasonOpenRegisteredSameDormitoryEmpty = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  items: [],
});
export const seasonOpenNotRegisteredCampusMerged = createSearchResponse({
  scope: 'CAMPUS_MERGED',
  purpose: 'BROAD_PREVIEW',
  items: seasonOpenCampusPreviewSummaries,
});
export const seasonOpenNotRegisteredSameDormitoryGate = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'BROAD_PREVIEW',
  items: [],
});

export const seasonOpenDeregisteredCampusMerged = createSearchResponse({
  scope: 'CAMPUS_MERGED',
  purpose: 'BROAD_PREVIEW',
  items: seasonOpenCampusPreviewSummaries,
  scopeAvailability: DEREGISTERED_SCOPE_TOGGLE_AVAILABILITY,
});

export const seasonOpenDeregisteredSameDormitoryGate = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'BROAD_PREVIEW',
  items: [],
  scopeAvailability: DEREGISTERED_SCOPE_TOGGLE_AVAILABILITY,
});
export const seasonOpenRegisteredSearchResponses = {
  CAMPUS_MERGED: seasonOpenRegisteredCampusMerged,
  SAME_BUILDING_ONLY: seasonOpenRegisteredSameDormitory,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
export const seasonOpenRegisteredEmptySearchResponses = {
  CAMPUS_MERGED: seasonOpenRegisteredCampusMergedEmpty,
  SAME_BUILDING_ONLY: seasonOpenRegisteredSameDormitoryEmpty,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
export const seasonOpenNotRegisteredSearchResponses = {
  CAMPUS_MERGED: seasonOpenNotRegisteredCampusMerged,
  SAME_BUILDING_ONLY: seasonOpenNotRegisteredSameDormitoryGate,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
export const seasonOpenDeregisteredSearchResponses = {
  CAMPUS_MERGED: seasonOpenDeregisteredCampusMerged,
  SAME_BUILDING_ONLY: seasonOpenDeregisteredSameDormitoryGate,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
export const seasonMatchingDeregisteredSearchResponses = {
  CAMPUS_MERGED: seasonMatchingDeregisteredCampusMerged,
  SAME_BUILDING_ONLY: seasonMatchingDeregisteredSameDormitoryGate,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
export const POST_MATCH_NOT_REGISTERED_SAME_DORMITORY_EMPTY_STATE = {
  title: '시즌 등록 이력이 있어야 목록을 볼 수 있어요.',
  message: '같은 건물 시즌 참여자 목록은 시즌 참여한 사용자에게만 열려요.',
} as const;

export const postMatchSameDormitorySummaries = seasonOpenSameDormitorySummaries
  .slice(0, 6)
  .map((summary, index) => {
    const {
      matchScore: _matchScore,
      detailEntryToken: _detailEntryToken,
      ...summaryWithoutDetail
    } = summary;
    void _matchScore;
    void _detailEntryToken;

    return {
      ...summaryWithoutDetail,
      exposure: SUMMARY_ONLY_EXPOSURE,
      actions: POST_MATCH_CLOSED_ACTIONS,
      resultRead: NO_RESULT_READ,
      profileSummary: {
        ...summary.profileSummary,
        intro:
          index % 2 === 0
            ? `${summary.profileSummary.nickname}님은 같은 건물에서 시즌에 참여했던 사용자예요. 결과 정리 기간에는 요약만 확인할 수 있어요.`
            : `${summary.profileSummary.nickname}님의 공개 요약을 확인해 보세요. 새 요청과 상세 비교는 매칭 기간에만 열려요.`,
      },
      bookmark: { bookmarked: false },
    };
  });

export const postMatchCampusMerged = createSearchResponse({
  scope: 'CAMPUS_MERGED',
  purpose: 'BROAD_PREVIEW',
  notices: [{ code: 'POST_MATCH_ACTION_CLOSED', severity: 'INFO' }],
  items: seasonOpenCampusPreviewSummaries.slice(0, 6),
});
export const postMatchSameDormitory = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'POST_MATCH_COHORT_REVIEW',
  notices: [{ code: 'POST_MATCH_ACTION_CLOSED', severity: 'INFO' }],
  items: postMatchSameDormitorySummaries,
});
export const postMatchCampusMergedEmpty = createSearchResponse({
  scope: 'CAMPUS_MERGED',
  purpose: 'BROAD_PREVIEW',
  notices: [{ code: 'POST_MATCH_ACTION_CLOSED', severity: 'INFO' }],
  items: [],
});
export const postMatchSameDormitoryEmpty = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'POST_MATCH_COHORT_REVIEW',
  notices: [{ code: 'POST_MATCH_ACTION_CLOSED', severity: 'INFO' }],
  items: [],
});
export const postMatchNotRegisteredSameDormitoryGate = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'POST_MATCH_COHORT_REVIEW',
  notices: [{ code: 'POST_MATCH_ACTION_CLOSED', severity: 'INFO' }],
  items: [],
});
export const postMatchDeregisteredSameDormitoryGate = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'POST_MATCH_COHORT_REVIEW',
  notices: [{ code: 'POST_MATCH_ACTION_CLOSED', severity: 'INFO' }],
  items: [],
  scopeAvailability: DEREGISTERED_SCOPE_TOGGLE_AVAILABILITY,
});
export const postMatchDeregisteredCampusMerged = createSearchResponse({
  scope: 'CAMPUS_MERGED',
  purpose: 'BROAD_PREVIEW',
  notices: [{ code: 'POST_MATCH_ACTION_CLOSED', severity: 'INFO' }],
  items: seasonOpenCampusPreviewSummaries.slice(0, 6),
  scopeAvailability: DEREGISTERED_SCOPE_TOGGLE_AVAILABILITY,
});
export const postMatchRegisteredSearchResponses = {
  CAMPUS_MERGED: postMatchCampusMerged,
  SAME_BUILDING_ONLY: postMatchSameDormitory,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
export const postMatchNotRegisteredSearchResponses = {
  CAMPUS_MERGED: postMatchCampusMerged,
  SAME_BUILDING_ONLY: postMatchNotRegisteredSameDormitoryGate,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
export const postMatchDeregisteredSearchResponses = {
  CAMPUS_MERGED: postMatchDeregisteredCampusMerged,
  SAME_BUILDING_ONLY: postMatchDeregisteredSameDormitoryGate,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
export const postMatchEmptySearchResponses = {
  CAMPUS_MERGED: postMatchCampusMergedEmpty,
  SAME_BUILDING_ONLY: postMatchSameDormitoryEmpty,
} as const satisfies Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
export const tombstoneSearch = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  notices: [{ code: 'DETAIL_UNAVAILABLE_BY_POLICY', severity: 'WARNING' }],
  items: [tombstoneSummary],
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});
export const errorDetailSearch = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  items: [errorSummary],
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});
export const blockedUserActionClosedSearch = createSearchResponse({
  scope: 'SAME_BUILDING_ONLY',
  purpose: 'ACTIONABLE_DETAIL_DISCOVERY',
  notices: [{ code: 'DISCOVERY_ACTIONABLE_ONLY', severity: 'WARNING' }],
  items: [blockedUserSummary],
  scopeAvailability: SEASON_MATCHING_REGISTERED_SCOPE_AVAILABILITY,
});

export function withSeasonBoundSearchManifest(
  response: RoommateSearchResponse,
  seasonContext: SeasonContextValue,
): RoommateSearchResponse {
  return {
    ...response,
    manifest: createManifest(response.scope, response.manifest.purpose, seasonContext),
  };
}

export function withSeasonBoundManifestResponse(
  response: RoommateSearchManifestResponse,
  seasonContext: SeasonContextValue,
): RoommateSearchManifestResponse {
  return {
    ...response,
    manifest: createManifest(response.scope, response.manifest.purpose, seasonContext),
  };
}

export function withSeasonBoundScopeResponses(
  responses: Partial<Record<RoommateSearchScope, RoommateSearchResponse>> | undefined,
  seasonContext: SeasonContextValue,
): Partial<Record<RoommateSearchScope, RoommateSearchResponse>> | undefined {
  if (!responses) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(responses).map(([scope, response]) => [
      scope,
      withSeasonBoundSearchManifest(response, seasonContext),
    ]),
  ) as Partial<Record<RoommateSearchScope, RoommateSearchResponse>>;
}
