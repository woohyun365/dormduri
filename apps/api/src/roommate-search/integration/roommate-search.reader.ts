import type {
  RoommateSearchManifestResponse,
  RoommateSearchQuery,
  RoommateSearchResponse,
  RoommateSearchScope,
} from '@repo/shared/roommate-search/contract';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import type { BlockVisibilityReaderPort } from '../../social-safety/blocks/application/ports/block-visibility-reader.port.js';
import type { BookmarkSearchMetadataReaderPort } from '../../social-safety/bookmarks/application/ports/bookmark-search-metadata-reader.port.js';
import type {
  ProfilePublicTargetReaderPort,
  ResolvedVisibleProfileEntry,
  VisibleProfileViewerContext,
} from '../../profiles/contracts/profile-public-target-reader.port.js';
import { createRoommateSearchCandidateOwner } from '../candidates/roommate-search-candidate.query.js';
import { filterRoommateSearchDiscoveryEntries } from '../filters/roommate-search-discovery-filter.policy.js';
import {
  assertRoommateSearchQueryAllowed,
  hasEffectiveRoommateSearchFilter,
} from '../filters/roommate-search-query.policy.js';
import { applyRoommateSearchScoreThreshold } from '../filters/roommate-search-score-threshold.policy.js';
import { buildRoommateSearchManifest } from '../manifest/roommate-search-filter-manifest.presenter.js';
import { createRoommateSearchPaginationOwner } from '../pagination/roommate-search-pagination.cursor.js';
import { createRoommateSearchTokenOwner } from '../pagination/roommate-search-token.codec.js';
import { buildRoommateSearchAvailabilityNotices } from '../presentation/roommate-search-availability-notice.presenter.js';
import { createRoommateSearchResponseOwner } from '../presentation/roommate-search-response.presenter.js';
import {
  resolveRoommateSearchScopeContext,
  shouldExcludeMatchedTargetsFromDiscovery,
} from '../scope/roommate-search-scope.policy.js';
import { sortRoommateSearchItems } from '../sorting/roommate-search-score-sort.policy.js';

interface RoommateSearchReaderDeps {
  prisma: PrismaService;
  publicProfileTargetReader: ProfilePublicTargetReaderPort;
  bookmarkSearchMetadataReader: BookmarkSearchMetadataReaderPort;
  blockVisibilityReader: BlockVisibilityReaderPort;
}

export function createRoommateSearchReader(deps: RoommateSearchReaderDeps) {
  const candidateOwner = createRoommateSearchCandidateOwner({ prisma: deps.prisma });
  const tokenOwner = createRoommateSearchTokenOwner();
  const paginationOwner = createRoommateSearchPaginationOwner(tokenOwner);
  const responseOwner = createRoommateSearchResponseOwner(tokenOwner);

  async function search(
    authUser: AuthenticatedUserContext,
    query: RoommateSearchQuery,
  ): Promise<RoommateSearchResponse> {
    const now = await deps.prisma.getDatabaseNow();
    const viewerContext = await deps.publicProfileTargetReader.loadViewerContext(authUser, now);
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
    const viewerContext = await deps.publicProfileTargetReader.loadViewerContext(authUser, now);
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
    const visibleEntries = await deps.publicProfileTargetReader.materializeVisibleProfileEntries(
      viewerContext,
      candidates.map((candidate) =>
        deps.publicProfileTargetReader.mapTargetParticipantCandidate(
          candidate as unknown as Parameters<
            typeof deps.publicProfileTargetReader.mapTargetParticipantCandidate
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

    const blockedTargetUserIds = await deps.blockVisibilityReader.getExcludedTargetUserIds({
      viewerUserId: viewerContext.viewer.id,
      targetUserIds: entries.map((entry) => entry.user.id),
    });

    return entries.filter((entry) => !blockedTargetUserIds.has(entry.user.id));
  }

  async function loadActiveBookmarkMap(
    viewerContext: VisibleProfileViewerContext,
    entries: ResolvedVisibleProfileEntry[],
  ) {
    if (!viewerContext.currentSeasonId || entries.length === 0) {
      return new Map<string, { bookmarkedAt: Date }>();
    }

    return deps.bookmarkSearchMetadataReader.getActiveBookmarkMetadata({
      viewerUserId: viewerContext.viewer.id,
      seasonId: viewerContext.currentSeasonId,
      targetParticipantIds: entries.map((entry) => entry.targetParticipant.id),
    });
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
