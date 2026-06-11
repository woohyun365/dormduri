import type {
  RoommateSearchManifestResponse,
  RoommateSearchQuery,
  RoommateSearchResponse,
  RoommateSearchScope,
} from '@repo/shared/roommate-search-contract';
import type { AuthenticatedUserContext } from '../auth/application/auth-actor-context.types.js';
import type { PrismaService } from '../platform/database/prisma.service.js';
import type { MatchActiveViewPort } from '../matches/application/ports/match-active-view.port.js';
import type { MatchScoreProjectionPort } from '../matches/application/ports/match-score-projection.port.js';
import type { SeasonParticipantsService } from '../season-participants/application/season-participants.service.js';
import type { SeasonContextPort } from '../seasons/ports/season-context.port.js';
import { buildRoommateSearchAvailabilityNotices } from './roommate-search-availability-notice.owner.js';
import { createRoommateSearchCandidateOwner } from './roommate-search-candidate.owner.js';
import { filterRoommateSearchDiscoveryEntries } from './roommate-search-discovery-filter.owner.js';
import { buildRoommateSearchManifest } from './roommate-search-filter-manifest.owner.js';
import { createRoommateSearchPaginationOwner } from './roommate-search-pagination.owner.js';
import {
  assertRoommateSearchQueryAllowed,
  hasEffectiveRoommateSearchFilter,
} from './roommate-search-query-policy.owner.js';
import { createRoommateSearchResponseOwner } from './roommate-search-response.owner.js';
import { applyRoommateSearchScoreThreshold } from './roommate-search-score-threshold.owner.js';
import { sortRoommateSearchItems } from './roommate-search-score-sort.owner.js';
import {
  resolveRoommateSearchScopeContext,
  shouldExcludeMatchedTargetsFromDiscovery,
} from './roommate-search-scope.owner.js';
import { createRoommateSearchTokenOwner } from './roommate-search-token-owner.js';
import {
  createVisibleProfileOwner,
  type ResolvedVisibleProfileEntry,
  type VisibleProfileViewerContext,
} from './visible-profile-owner.js';

interface RoommateSearchOwnerDeps {
  prisma: PrismaService;
  seasonsService: SeasonContextPort;
  seasonParticipantsService: SeasonParticipantsService;
  matchActiveView: MatchActiveViewPort;
  matchScoreProjection: MatchScoreProjectionPort;
}

export function createRoommateSearchOwner(deps: RoommateSearchOwnerDeps) {
  const visibleProfileOwner = createVisibleProfileOwner(deps);
  const candidateOwner = createRoommateSearchCandidateOwner(deps);
  const tokenOwner = createRoommateSearchTokenOwner();
  const paginationOwner = createRoommateSearchPaginationOwner(tokenOwner);
  const responseOwner = createRoommateSearchResponseOwner(tokenOwner);

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
    const filteredDiscovery = filterRoommateSearchDiscoveryEntries(filteredEntries, {
      excludeMatchedTargets: shouldExcludeMatchedTargetsFromDiscovery(purpose),
    });
    const activeBookmarkMap = await loadActiveBookmarkMap(viewerContext, filteredDiscovery.entries);
    const filteredItems = filteredDiscovery.entries.map((entry) => {
      const item = responseOwner.toMaterializedItem({ entry, viewerContext, scope, purpose, now });
      const bookmark = activeBookmarkMap.get(entry.targetParticipant.id);
      return {
        ...item,
        summary: {
          ...item.summary,
          bookmark: bookmark
            ? { bookmarked: true, bookmarkedAt: bookmark.bookmarkedAt.toISOString() }
            : { bookmarked: false },
        },
      };
    });
    const scoreThresholdItems = applyRoommateSearchScoreThreshold(filteredItems, query);
    const sortedItems = sortRoommateSearchItems(scoreThresholdItems, appliedSort);
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
      resultSummary: responseOwner.summarize(filteredSummaries),
      scopeAvailability,
      manifest,
      pageInfo: pageItems.pageInfo,
      availabilityNotices: buildRoommateSearchAvailabilityNotices({
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
      availabilityNotices: buildRoommateSearchAvailabilityNotices({
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
    const visibleEntries = await visibleProfileOwner.materializeVisibleProfileEntries(
      viewerContext,
      candidates.map((candidate) =>
        visibleProfileOwner.mapTargetParticipantCandidate(
          candidate as unknown as Parameters<
            typeof visibleProfileOwner.mapTargetParticipantCandidate
          >[0],
        ),
      ),
    );
    return filterBlockedEntries(viewerContext, visibleEntries);
  }

  async function filterBlockedEntries(
    viewerContext: VisibleProfileViewerContext,
    entries: ResolvedVisibleProfileEntry[],
  ): Promise<ResolvedVisibleProfileEntry[]> {
    if (entries.length === 0) {
      return entries;
    }

    const targetUserIds = entries.map((entry) => entry.user.id);
    const activeBlocks = await deps.prisma.userBlock.findMany({
      where: {
        unblockedAt: null,
        OR: [
          {
            blockerUserId: viewerContext.viewer.id,
            blockedUserId: { in: targetUserIds },
          },
          {
            blockerUserId: { in: targetUserIds },
            blockedUserId: viewerContext.viewer.id,
          },
        ],
      },
      select: {
        blockerUserId: true,
        blockedUserId: true,
      },
    });
    const blockedTargetUserIds = new Set(
      activeBlocks.map((block) =>
        block.blockerUserId === viewerContext.viewer.id ? block.blockedUserId : block.blockerUserId,
      ),
    );

    return entries.filter((entry) => !blockedTargetUserIds.has(entry.user.id));
  }

  async function loadActiveBookmarkMap(
    viewerContext: VisibleProfileViewerContext,
    entries: ResolvedVisibleProfileEntry[],
  ) {
    if (!viewerContext.currentSeasonId || entries.length === 0) {
      return new Map<string, { bookmarkedAt: Date }>();
    }

    const rows = await deps.prisma.userBookmark.findMany({
      where: {
        viewerUserId: viewerContext.viewer.id,
        seasonId: viewerContext.currentSeasonId,
        targetParticipantId: {
          in: entries.map((entry) => entry.targetParticipant.id),
        },
        deletedAt: null,
        expiredAt: null,
      },
      select: {
        targetParticipantId: true,
        bookmarkedAt: true,
      },
    });

    return new Map(
      rows.map((row) => [row.targetParticipantId, { bookmarkedAt: row.bookmarkedAt }]),
    );
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
