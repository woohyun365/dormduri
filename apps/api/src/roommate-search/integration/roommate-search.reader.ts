import type {
  RoommateSearchManifestResponse,
  RoommateSearchQuery,
  RoommateSearchResponse,
  RoommateSearchScope,
} from '@repo/shared/roommate-search/contract';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import type {
  ChatThreadSearchMetadata,
  ChatThreadSearchMetadataReaderPort,
} from '../../chat/application/ports/chat-thread-search-metadata-reader.port.js';
import type {
  MatchRequestDirectionLimitMetadata,
  MatchRequestSearchMetadata,
  MatchRequestSearchMetadataReaderPort,
} from '../../matches/application/ports/match-request-search-metadata-reader.port.js';
import type {
  PublicProfileActionCapabilities,
  PublicTargetActionUnavailableReason,
} from '@repo/shared/profile/contract';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import {
  recordDomainMetricSafely,
  type DomainMetricsPort,
} from '../../platform/observability/metrics/domain-metrics.port.js';
import type { BlockVisibilityReaderPort } from '../../social-safety/blocks/application/ports/block-visibility-reader.port.js';
import type { BookmarkSearchMetadataReaderPort } from '../../social-safety/bookmarks/application/ports/bookmark-search-metadata-reader.port.js';
import type {
  ProfilePublicTargetReaderPort,
  ResolvedVisibleProfileEntry,
  VisibleProfileViewerContext,
} from '../../profiles/contracts/profile-public-target-reader.port.js';
import { createRoommateSearchCandidateQuery } from '../candidates/roommate-search-candidate.query.js';
import { filterRoommateSearchDiscoveryEntries } from '../filters/roommate-search-discovery-filter.policy.js';
import {
  assertRoommateSearchQueryAllowed,
  hasEffectiveRoommateSearchFilter,
} from '../filters/roommate-search-query.policy.js';
import { applyRoommateSearchScoreThreshold } from '../filters/roommate-search-score-threshold.policy.js';
import { buildRoommateSearchManifest } from '../manifest/roommate-search-filter-manifest.presenter.js';
import { createRoommateSearchPaginator } from '../pagination/roommate-search-pagination.cursor.js';
import { createRoommateSearchTokenCodec } from '../pagination/roommate-search-token.codec.js';
import { buildRoommateSearchAvailabilityNotices } from '../presentation/roommate-search-availability-notice.presenter.js';
import { createRoommateSearchResponsePresenter } from '../presentation/roommate-search-response.presenter.js';
import {
  resolveRoommateSearchScopeContext,
  shouldExcludeMatchedTargetsFromDiscovery,
} from '../scope/roommate-search-scope.policy.js';
import { sortRoommateSearchItems } from '../sorting/roommate-search-sort.policy.js';

interface RoommateSearchReaderDeps {
  prisma: PrismaService;
  publicProfileTargetReader: ProfilePublicTargetReaderPort;
  bookmarkSearchMetadataReader: BookmarkSearchMetadataReaderPort;
  blockVisibilityReader: BlockVisibilityReaderPort;
  matchRequestSearchMetadataReader: MatchRequestSearchMetadataReaderPort;
  chatThreadSearchMetadataReader: ChatThreadSearchMetadataReaderPort;
  metrics?: DomainMetricsPort;
}

export function createRoommateSearchReader(deps: RoommateSearchReaderDeps) {
  const candidateQuery = createRoommateSearchCandidateQuery({ prisma: deps.prisma });
  const tokenCodec = createRoommateSearchTokenCodec();
  const paginator = createRoommateSearchPaginator(tokenCodec);
  const responsePresenter = createRoommateSearchResponsePresenter(tokenCodec);

  async function search(
    authUser: AuthenticatedUserContext,
    query: RoommateSearchQuery,
  ): Promise<RoommateSearchResponse> {
    const startedAt = performance.now();
    let metricSort = 'unknown';

    try {
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
      metricSort = appliedSort;
      const filteredEntries = await loadVisibleEntries(viewerContext, scope, query);
      const filteredDiscovery = filterRoommateSearchDiscoveryEntries(filteredEntries, {
        excludeMatchedTargets: shouldExcludeMatchedTargetsFromDiscovery(purpose),
      });
      const [
        activeBookmarkMap,
        pendingMatchRequestMap,
        directionLimitMap,
        pendingSentLimitReached,
        cooldownActiveTargetIds,
        activeChatThreadMap,
      ] = await Promise.all([
        loadActiveBookmarkMap(viewerContext, filteredDiscovery.entries),
        loadPendingMatchRequestMap(viewerContext, filteredDiscovery.entries, now),
        loadDirectionLimitMap(viewerContext, filteredDiscovery.entries),
        loadPendingSentLimitReached(viewerContext, filteredDiscovery.entries, now),
        loadDirectionCooldownActiveTargetIds(viewerContext, filteredDiscovery.entries, now),
        loadActiveChatThreadMap(viewerContext, filteredDiscovery.entries),
      ]);
      const filteredItems = filteredDiscovery.entries.map((entry) => {
        const item = responsePresenter.toMaterializedItem({
          entry,
          viewerContext,
          scope,
          purpose,
          now,
        });
        const bookmark = activeBookmarkMap.get(entry.targetParticipant.id);
        const pendingMatchRequest = pendingMatchRequestMap.get(entry.targetParticipant.id);
        const directionLimit = directionLimitMap.get(entry.targetParticipant.id);
        const activeChatThread = activeChatThreadMap.get(entry.targetParticipant.id);
        const actions = applyMatchRequestPreconditionsToActions({
          actions: item.summary.actions,
          directionLimit,
          pendingMatchRequest,
          pendingSentLimitReached,
          directionCooldownActive: cooldownActiveTargetIds.has(entry.targetParticipant.id),
        });
        const exposedActiveChatThread = actions.canStartChat ? activeChatThread : undefined;
        return {
          ...item,
          summary: {
            ...item.summary,
            actions,
            bookmark: bookmark
              ? { bookmarked: true, bookmarkedAt: bookmark.bookmarkedAt.toISOString() }
              : { bookmarked: false },
            pendingMatchRequest: pendingMatchRequest
              ? {
                  id: pendingMatchRequest.requestId,
                  direction: pendingMatchRequest.direction,
                  createdAt: pendingMatchRequest.createdAt.toISOString(),
                  expiresAt: pendingMatchRequest.expiresAt.toISOString(),
                }
              : null,
            activeChatThread: exposedActiveChatThread
              ? {
                  id: exposedActiveChatThread.threadId,
                  threadKind: exposedActiveChatThread.threadKind,
                  status: exposedActiveChatThread.status,
                  lastMessageAt: exposedActiveChatThread.lastMessageAt?.toISOString(),
                }
              : null,
          },
        };
      });
      const scoreThresholdItems = applyRoommateSearchScoreThreshold(filteredItems, query);
      recordRoommateSearchCandidateCount('score_filtered', scoreThresholdItems.length);
      const sortedItems = sortRoommateSearchItems(scoreThresholdItems, appliedSort);
      const queryDigest = tokenCodec.buildQueryDigest({
        scope,
        sort: appliedSort,
        query,
      });
      const pageItems = paginator.paginate({
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

      recordRoommateSearchRequestMetric('success', metricSort, startedAt);
      return {
        scope,
        appliedSort,
        resultSummary: responsePresenter.summarize(filteredSummaries),
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
    } catch (error) {
      recordRoommateSearchRequestMetric('failure', metricSort, startedAt);
      throw error;
    }
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
    const candidates = await candidateQuery.findCandidates({ viewerContext, scope, query });
    recordRoommateSearchCandidateCount('raw', candidates.length);
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
    const unblockedEntries = await filterBlockedEntries(viewerContext, visibleEntries);
    recordRoommateSearchCandidateCount('visible', unblockedEntries.length);
    return unblockedEntries;
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

  async function loadPendingMatchRequestMap(
    viewerContext: VisibleProfileViewerContext,
    entries: ResolvedVisibleProfileEntry[],
    now: Date,
  ): Promise<ReadonlyMap<string, MatchRequestSearchMetadata>> {
    if (
      !viewerContext.currentSeasonId ||
      !viewerContext.viewerParticipant ||
      entries.length === 0
    ) {
      return new Map<string, MatchRequestSearchMetadata>();
    }

    return deps.matchRequestSearchMetadataReader.getLivePendingRequestMetadata({
      seasonId: viewerContext.currentSeasonId,
      viewerParticipantId: viewerContext.viewerParticipant.id,
      targetParticipantIds: entries.map((entry) => entry.targetParticipant.id),
      now,
    });
  }

  async function loadDirectionLimitMap(
    viewerContext: VisibleProfileViewerContext,
    entries: ResolvedVisibleProfileEntry[],
  ): Promise<ReadonlyMap<string, MatchRequestDirectionLimitMetadata>> {
    if (
      !viewerContext.currentSeasonId ||
      !viewerContext.viewerParticipant ||
      entries.length === 0
    ) {
      return new Map<string, MatchRequestDirectionLimitMetadata>();
    }

    return deps.matchRequestSearchMetadataReader.getDirectionLimitReachedMetadata({
      seasonId: viewerContext.currentSeasonId,
      viewerParticipantId: viewerContext.viewerParticipant.id,
      targetParticipantIds: entries.map((entry) => entry.targetParticipant.id),
    });
  }

  async function loadPendingSentLimitReached(
    viewerContext: VisibleProfileViewerContext,
    entries: ResolvedVisibleProfileEntry[],
    now: Date,
  ): Promise<boolean> {
    if (
      !viewerContext.currentSeasonId ||
      !viewerContext.viewerParticipant ||
      entries.length === 0
    ) {
      return false;
    }
    return deps.matchRequestSearchMetadataReader.isPendingSentLimitReached({
      seasonId: viewerContext.currentSeasonId,
      viewerParticipantId: viewerContext.viewerParticipant.id,
      now,
    });
  }

  async function loadDirectionCooldownActiveTargetIds(
    viewerContext: VisibleProfileViewerContext,
    entries: ResolvedVisibleProfileEntry[],
    now: Date,
  ): Promise<ReadonlySet<string>> {
    if (
      !viewerContext.currentSeasonId ||
      !viewerContext.viewerParticipant ||
      entries.length === 0
    ) {
      return new Set();
    }
    return deps.matchRequestSearchMetadataReader.getDirectionCooldownActiveTargetIds({
      seasonId: viewerContext.currentSeasonId,
      viewerParticipantId: viewerContext.viewerParticipant.id,
      targetParticipantIds: entries.map((entry) => entry.targetParticipant.id),
      now,
    });
  }

  async function loadActiveChatThreadMap(
    viewerContext: VisibleProfileViewerContext,
    entries: ResolvedVisibleProfileEntry[],
  ): Promise<ReadonlyMap<string, ChatThreadSearchMetadata>> {
    if (
      !viewerContext.currentSeasonId ||
      !viewerContext.viewerParticipant ||
      entries.length === 0
    ) {
      return new Map<string, ChatThreadSearchMetadata>();
    }

    return deps.chatThreadSearchMetadataReader.getActiveThreadMetadata({
      seasonId: viewerContext.currentSeasonId,
      viewerParticipantId: viewerContext.viewerParticipant.id,
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

  function recordRoommateSearchRequestMetric(outcome: string, sort: string, startedAt: number) {
    const durationSeconds = Math.max(0, performance.now() - startedAt) / 1000;
    recordDomainMetricSafely(deps.metrics, (metrics) => {
      metrics.incrementCounter({
        name: 'api_roommate_search_requests_total',
        labels: { outcome, sort },
      });
      metrics.observeHistogram({
        name: 'api_roommate_search_duration_seconds',
        labels: { outcome, sort },
        value: durationSeconds,
      });
    });
  }

  function recordRoommateSearchCandidateCount(phase: string, count: number) {
    recordDomainMetricSafely(deps.metrics, (metrics) =>
      metrics.observeHistogram({
        name: 'api_roommate_search_candidate_count',
        labels: { phase },
        value: count,
      }),
    );
  }
}

export function applyMatchRequestPreconditionsToActions(input: {
  actions: PublicProfileActionCapabilities;
  directionLimit: MatchRequestDirectionLimitMetadata | undefined;
  pendingMatchRequest: MatchRequestSearchMetadata | undefined;
  pendingSentLimitReached: boolean;
  directionCooldownActive: boolean;
}): PublicProfileActionCapabilities {
  if (!input.actions.canRequestMatch) {
    return input.actions;
  }

  const reason = input.pendingMatchRequest
    ? 'MATCH_REQUEST_ALREADY_PENDING'
    : input.pendingSentLimitReached
      ? 'MATCH_REQUEST_PENDING_LIMIT_REACHED'
      : input.directionLimit
        ? 'MATCH_REQUEST_DIRECTION_LIMIT_REACHED'
        : input.directionCooldownActive
          ? 'MATCH_REQUEST_DIRECTION_COOLDOWN_ACTIVE'
          : null;
  if (!reason) return input.actions;

  return {
    ...input.actions,
    canRequestMatch: false,
    unavailableReasons: appendUnavailableReason(input.actions.unavailableReasons, reason),
  };
}

function appendUnavailableReason(
  reasons: readonly PublicTargetActionUnavailableReason[],
  reason: PublicTargetActionUnavailableReason,
): PublicTargetActionUnavailableReason[] {
  return reasons.includes(reason) ? [...reasons] : [...reasons, reason];
}
