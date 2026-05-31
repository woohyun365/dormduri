import type {
  RoommateSearchAvailabilityNotice,
  RoommateSearchManifestResponse,
  RoommateSearchPurpose,
  RoommateSearchQuery,
  RoommateSearchResponse,
  RoommateSearchScope,
  RoommateSearchSort,
  RoommateSearchSummary,
} from '@repo/shared/roommate-search-contract';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import type { MatchesService } from '../matches/matches.service.js';
import type { SeasonParticipantsService } from '../season-participants/season-participants.service.js';
import { isParticipantRegistered } from '../season-participants/season-participant-policy.js';
import type { SeasonsService } from '../seasons/seasons.service.js';
import { createRoommateSearchCandidateOwner } from './roommate-search-candidate.owner.js';
import { buildRoommateSearchManifest } from './roommate-search-filter-manifest.owner.js';
import { createRoommateSearchPaginationOwner } from './roommate-search-pagination.owner.js';
import {
  assertRoommateSearchQueryAllowed,
  hasEffectiveRoommateSearchFilter,
} from './roommate-search-query-policy.owner.js';
import { sortRoommateSearchItems } from './roommate-search-score-sort.owner.js';
import {
  resolveRoommateSearchScopeContext,
  shouldExcludeMatchedTargetsFromDiscovery,
} from './roommate-search-scope.owner.js';
import {
  createRoommateSearchTokenOwner,
  type RoommateSearchCursorBoundary,
} from './roommate-search-token-owner.js';
import {
  createVisibleProfileOwner,
  type ResolvedVisibleProfileEntry,
  type VisibleProfileViewerContext,
} from './visible-profile-owner.js';

interface RoommateSearchOwnerDeps {
  prisma: PrismaService;
  seasonsService: SeasonsService;
  seasonParticipantsService: SeasonParticipantsService;
  matchesService: MatchesService;
}

type SearchMaterializedItem = {
  entry: ResolvedVisibleProfileEntry;
  summary: RoommateSearchSummary;
  cursorBoundary: RoommateSearchCursorBoundary;
};

export function createRoommateSearchOwner(deps: RoommateSearchOwnerDeps) {
  const visibleProfileOwner = createVisibleProfileOwner(deps);
  const candidateOwner = createRoommateSearchCandidateOwner(deps);
  const tokenOwner = createRoommateSearchTokenOwner();
  const paginationOwner = createRoommateSearchPaginationOwner(tokenOwner);

  async function search(
    authUser: AuthenticatedUserContext,
    query: RoommateSearchQuery,
  ): Promise<RoommateSearchResponse> {
    const now = await deps.prisma.getDatabaseNow();
    const viewerContext = await visibleProfileOwner.loadViewerContext(authUser, now);
    const { scopeAvailability, scope, purpose } = resolveRoommateSearchScopeContext(
      viewerContext,
      query.scope,
    );
    const activeCollegeOptions = await loadActiveCollegeOptions(viewerContext);
    const manifest = buildRoommateSearchManifest({
      viewerContext,
      scope,
      purpose,
      appliedSort: 'NICKNAME',
      activeCollegeOptions,
    });
    const queryPolicy = assertRoommateSearchQueryAllowed({ query, manifest });

    const appliedSort = queryPolicy.appliedSort;
    const filteredEntries = await loadVisibleEntries(viewerContext, scope, query);
    const filteredDiscovery = applyDiscoveryFilter(filteredEntries, {
      excludeMatchedTargets: shouldExcludeMatchedTargetsFromDiscovery(purpose),
    });
    const filteredItems = filteredDiscovery.entries.map((entry) =>
      toSearchMaterializedItem({ entry, viewerContext, scope, purpose, now }),
    );
    const scoreThresholdItems = applyScoreThresholdFilter(filteredItems, query);
    const sortedItems = sortSearchMaterializedItems(scoreThresholdItems, appliedSort);
    const queryDigest = tokenOwner.buildQueryDigest({
      scope,
      sort: appliedSort,
      query,
    });
    const pageItems = paginationOwner.paginate({
      items: sortedItems,
      query,
      viewerUserId: viewerContext.viewer.id,
      seasonId: viewerContext.currentSeasonId,
      scope,
      appliedSort,
      queryDigest,
      now,
    });
    const filteredSummaries = scoreThresholdItems.map((item) => item.summary);

    return {
      scope,
      appliedSort,
      resultSummary: summarizeResults(filteredSummaries),
      scopeAvailability,
      manifest,
      pageInfo: pageItems.pageInfo,
      availabilityNotices: buildAvailabilityNotices({
        viewerContext,
        summaries: filteredSummaries,
        matchedTargetsExcluded: filteredDiscovery.matchedTargetsExcluded,
        filterResultEmpty:
          hasEffectiveRoommateSearchFilter(query) && scoreThresholdItems.length === 0,
      }),
      items: pageItems.items.map((item) => item.summary),
    };
  }

  async function getManifest(
    authUser: AuthenticatedUserContext,
    query: Pick<RoommateSearchQuery, 'scope'>,
  ): Promise<RoommateSearchManifestResponse> {
    const now = await deps.prisma.getDatabaseNow();
    const viewerContext = await visibleProfileOwner.loadViewerContext(authUser, now);
    const { scopeAvailability, scope, purpose } = resolveRoommateSearchScopeContext(
      viewerContext,
      query.scope,
    );
    const activeCollegeOptions = await loadActiveCollegeOptions(viewerContext);
    const manifest = buildRoommateSearchManifest({
      viewerContext,
      scope,
      purpose,
      appliedSort: 'NICKNAME',
      activeCollegeOptions,
    });

    return {
      scope,
      scopeAvailability,
      manifest,
      availabilityNotices: buildAvailabilityNotices({
        viewerContext,
        summaries: [],
        matchedTargetsExcluded: false,
        filterResultEmpty: false,
      }),
    };
  }

  async function loadVisibleEntries(
    viewerContext: VisibleProfileViewerContext,
    scope: RoommateSearchScope,
    query?: RoommateSearchQuery,
  ): Promise<ResolvedVisibleProfileEntry[]> {
    const candidates = await candidateOwner.findCandidates({ viewerContext, scope, query });
    return visibleProfileOwner.materializeVisibleProfileEntries(
      viewerContext,
      candidates.map((candidate) =>
        visibleProfileOwner.mapTargetParticipantCandidate(
          candidate as unknown as Parameters<
            typeof visibleProfileOwner.mapTargetParticipantCandidate
          >[0],
        ),
      ),
    );
  }

  function toSearchMaterializedItem(input: {
    entry: ResolvedVisibleProfileEntry;
    viewerContext: VisibleProfileViewerContext;
    scope: RoommateSearchScope;
    purpose: RoommateSearchPurpose;
    now: Date;
  }): SearchMaterializedItem {
    const summary = toRoommateSearchSummary(input.entry, input.purpose);
    const seasonId = input.viewerContext.currentSeasonId;
    if (!seasonId) {
      return {
        entry: input.entry,
        summary,
        cursorBoundary: toCursorBoundary(summary, input.entry),
      };
    }

    return {
      entry: input.entry,
      summary: {
        ...summary,
        detailEntryToken: tokenOwner.signDetailEntryToken({
          viewerUserId: input.viewerContext.viewer.id,
          targetUserId: input.entry.user.id,
          targetParticipantId: input.entry.targetParticipant.id,
          seasonId,
          issuedScope: input.scope,
          issuedRelation: summary.relation.type,
          issuedExposure: {
            listSummaryVisible: true,
            canViewFull: summary.exposure.canViewFull,
            detailViewable: summary.exposure.detailViewable,
            scoreVisible: summary.exposure.scoreVisible,
          },
          now: input.now,
        }),
      },
      cursorBoundary: toCursorBoundary(summary, input.entry),
    };
  }

  async function loadActiveCollegeOptions(viewerContext: VisibleProfileViewerContext) {
    const colleges = await deps.prisma.collegeMaster.findMany({
      where: {
        campusCode: viewerContext.viewer.campus,
        isActive: true,
      },
      select: {
        code: true,
        nameKo: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });

    return colleges.map((college) => ({
      code: college.code,
      label: college.nameKo,
    }));
  }

  return {
    search,
    getManifest,
  };
}

function applyDiscoveryFilter(
  entries: ResolvedVisibleProfileEntry[],
  input: { excludeMatchedTargets: boolean },
) {
  const filtered = input.excludeMatchedTargets
    ? entries.filter((entry) => !entry.targetMatched)
    : entries;
  return {
    entries: filtered,
    matchedTargetsExcluded: filtered.length !== entries.length,
  };
}

function applyScoreThresholdFilter(
  items: SearchMaterializedItem[],
  query: RoommateSearchQuery,
): SearchMaterializedItem[] {
  if (query.minScore === undefined) {
    return items;
  }

  const minScore = query.minScore;
  return items.filter(
    (item) =>
      item.summary.exposure.scoreVisible &&
      typeof item.summary.matchScore === 'number' &&
      item.summary.matchScore >= minScore,
  );
}

function buildAvailabilityNotices(input: {
  viewerContext: VisibleProfileViewerContext;
  summaries: RoommateSearchSummary[];
  matchedTargetsExcluded: boolean;
  filterResultEmpty: boolean;
}): RoommateSearchAvailabilityNotice[] {
  const notices = new Map<string, RoommateSearchAvailabilityNotice>();
  const add = (notice: RoommateSearchAvailabilityNotice) => notices.set(notice.code, notice);

  if (input.matchedTargetsExcluded) {
    add({
      code: 'MATCHED_TARGETS_EXCLUDED',
      severity: 'INFO',
      message: '이미 매칭이 완료된 사용자는 신규 후보 목록에서 제외됩니다.',
    });
  }

  if (input.summaries.some((item) => item.actions.canBookmark || item.actions.canRequestMatch)) {
    add({
      code: 'DISCOVERY_ACTIONABLE_ONLY',
      severity: 'INFO',
      message: '룸메이트 찾기는 현재 신규 후보 탐색 기준으로 정렬됩니다.',
    });
  }

  if (
    !isParticipantRegistered(input.viewerContext.viewerParticipant) ||
    !input.viewerContext.viewerHasOperatedAssignedDormitory
  ) {
    add({
      code: 'SCOPE_RESTRICTED_BY_VIEWER_STATE',
      severity: 'INFO',
      message: '현재 등록 또는 기숙사 배정 상태에 따라 사용할 수 있는 검색 범위가 제한됩니다.',
    });
  }

  if (input.viewerContext.serviceState.seasonState === 'SEASON_POST_MATCH') {
    add({
      code: 'POST_MATCH_ACTION_CLOSED',
      severity: 'INFO',
      message: '포스트매치 기간에는 신규 매칭/채팅 action이 닫힙니다.',
    });
  }

  if (input.summaries.some((item) => !item.exposure.canViewFull)) {
    add({
      code: 'DETAIL_UNAVAILABLE_BY_POLICY',
      severity: 'INFO',
      message:
        '일부 사용자는 summary만 볼 수 있으며 상세 화면에서는 정책 안내가 표시될 수 있습니다.',
    });
  }

  if (input.filterResultEmpty) {
    add({
      code: 'FILTER_RESULT_EMPTY',
      severity: 'INFO',
      message: '조건에 맞는 룸메이트 후보가 없습니다.',
    });
  }

  return [...notices.values()];
}

function toSearchSortKey(entry: ResolvedVisibleProfileEntry) {
  return entry.sourceProfile.nicknameNormalized || entry.sourceProfile.nickname;
}

function toCursorBoundary(
  summary: RoommateSearchSummary,
  entry: ResolvedVisibleProfileEntry,
): RoommateSearchCursorBoundary {
  const base = {
    nicknameSortKey: toSearchSortKey(entry),
    participantId: entry.targetParticipant.id,
  };
  if (typeof summary.matchScore !== 'number') {
    return base;
  }

  return {
    ...base,
    matchScore: summary.matchScore,
  };
}

function sortSearchMaterializedItems(items: SearchMaterializedItem[], sort: RoommateSearchSort) {
  return sortRoommateSearchItems(items, sort);
}

function toRoommateSearchSummary(
  entry: ResolvedVisibleProfileEntry,
  purpose: RoommateSearchPurpose,
): RoommateSearchSummary {
  const policy = entry.publicTargetPolicy;
  const scoreVisible =
    purpose === 'POST_MATCH_COHORT_REVIEW' ? false : policy.exposure.scoreVisible;
  const base = {
    id: entry.user.id,
    sourceProfile: policy.sourceProfile,
    relation: { type: policy.relation.relationToViewer },
    exposure: {
      listSummaryVisible: true as const,
      detailViewable: policy.exposure.detailViewable,
      canViewFull: policy.exposure.canViewFull,
      scoreVisible,
    },
    actions: policy.actions,
    resultRead: policy.resultRead,
    profileSummary: {
      nickname: entry.sourceProfile.nickname,
      intro: entry.sourceProfile.intro,
      smokingBehavior: entry.sourceProfile.lifestyle.smokingBehavior,
      sleepHabit: entry.sourceProfile.lifestyle.sleepHabit,
      relationshipStyle: entry.sourceProfile.lifestyle.relationshipStyle,
    },
  };

  if (!scoreVisible) {
    return base;
  }

  if (typeof entry.matchScore !== 'number') {
    throw new Error('[roommate-search-owner] score-visible summary target must have matchScore');
  }

  return {
    ...base,
    matchScore: entry.matchScore,
  };
}

function summarizeResults(items: RoommateSearchSummary[]): RoommateSearchResponse['resultSummary'] {
  return {
    summaryOnlyCount: items.filter((item) => !item.exposure.detailViewable).length,
    detailViewableCount: items.filter((item) => item.exposure.detailViewable).length,
    scoreVisibleCount: items.filter((item) => item.exposure.scoreVisible).length,
  };
}
