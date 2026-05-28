import type {
  RoommateSearchAvailabilityNotice,
  RoommateSearchQuery,
  RoommateSearchResponse,
  RoommateSearchScope,
  RoommateSearchSort,
  RoommateSearchSummary,
} from '@repo/shared/roommate-search-contract';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { MatchesService } from '../matches/matches.service.js';
import type {
  CurrentSeasonParticipantRecord,
  SeasonParticipantsService,
} from '../season-participants/season-participants.service.js';
import { currentSeasonParticipantSelect } from '../season-participants/season-participant-records.js';
import { isParticipantRegistered } from '../season-participants/season-participant-policy.js';
import type { SeasonsService } from '../seasons/seasons.service.js';
import { toStoredBedtime, toStoredWakeTime } from '../common/lifestyle/lifestyle.persistence.js';
import { roommateSearchErrors } from './roommate-search.errors.js';
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

const targetParticipantSelect = {
  ...currentSeasonParticipantSelect,
  user: {
    select: {
      id: true,
      deletedAt: true,
    },
  },
} as const;

type TargetParticipantQueryRecord = Prisma.SeasonParticipantGetPayload<{
  select: typeof targetParticipantSelect;
}>;

type SearchMaterializedItem = {
  entry: ResolvedVisibleProfileEntry;
  summary: RoommateSearchSummary;
  cursorBoundary: RoommateSearchCursorBoundary;
};

const DETAIL_ONLY_FILTER_FIELDS = new Set<keyof RoommateSearchQuery>([
  'bedtime',
  'wakeTime',
  'noiseSensitivity',
  'cleanLevel',
  'indoorEating',
  'college',
  'grade',
  'mbti',
  'birthYear',
]);

export function createRoommateSearchOwner(deps: RoommateSearchOwnerDeps) {
  const visibleProfileOwner = createVisibleProfileOwner(deps);
  const tokenOwner = createRoommateSearchTokenOwner();

  async function search(
    authUser: AuthenticatedUserContext,
    query: RoommateSearchQuery,
  ): Promise<RoommateSearchResponse> {
    const now = await deps.prisma.getDatabaseNow();
    const viewerContext = await visibleProfileOwner.loadViewerContext(authUser, now);
    const scopeAvailability = resolveScopeAvailability(viewerContext);
    const scope = query.scope ?? resolveDefaultScope(scopeAvailability);

    if (!isScopeAllowed(scopeAvailability, scope)) {
      throw roommateSearchErrors.invalidQuery(resolveScopeErrorMessage(scope));
    }

    const scopeEntries = await loadVisibleEntries(viewerContext, scope);
    const scopeDiscovery = applyDiscoveryFilter(scopeEntries);
    const scopeItems = scopeDiscovery.entries.map((entry) =>
      toSearchMaterializedItem({ entry, viewerContext, scope, now }),
    );
    const scopeSummaries = scopeItems.map((item) => item.summary);
    const filterCapabilities = resolveFilterCapabilities(scopeSummaries);
    const sortCapabilities = {
      matchScore: false,
    };

    assertFilterAllowed(query, filterCapabilities, scopeSummaries);
    if (query.sort === 'MATCH_SCORE') {
      throw roommateSearchErrors.invalidQuery(
        '매칭 점수 정렬은 cursor pagination deterministic ordering 확정 후 제공됩니다.',
      );
    }

    const filteredEntries = await loadVisibleEntries(viewerContext, scope, query);
    const filteredDiscovery = applyDiscoveryFilter(filteredEntries);
    const filteredItems = filteredDiscovery.entries.map((entry) =>
      toSearchMaterializedItem({ entry, viewerContext, scope, now }),
    );
    const appliedSort = resolveAppliedSort(query);
    const sortedItems = sortSearchMaterializedItems(filteredItems, appliedSort);
    const queryDigest = tokenOwner.buildQueryDigest({ scope, sort: appliedSort, query });
    const pageItems = paginateItems({
      items: sortedItems,
      query,
      viewerContext,
      scope,
      appliedSort,
      queryDigest,
      now,
    });

    return {
      scope,
      appliedSort,
      resultSummary: summarizeResults(scopeSummaries),
      scopeAvailability,
      filterCapabilities,
      sortCapabilities,
      pageInfo: pageItems.pageInfo,
      availabilityNotices: buildAvailabilityNotices({
        viewerContext,
        scopeSummaries,
        matchedTargetsExcluded:
          scopeDiscovery.matchedTargetsExcluded || filteredDiscovery.matchedTargetsExcluded,
      }),
      items: pageItems.items.map((item) => item.summary),
    };
  }

  async function loadVisibleEntries(
    viewerContext: VisibleProfileViewerContext,
    scope: RoommateSearchScope,
    query?: RoommateSearchQuery,
  ): Promise<ResolvedVisibleProfileEntry[]> {
    const candidates = await findCandidateParticipants(viewerContext, scope, query);
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

  function paginateItems(input: {
    items: SearchMaterializedItem[];
    query: RoommateSearchQuery;
    viewerContext: VisibleProfileViewerContext;
    scope: RoommateSearchScope;
    appliedSort: 'NICKNAME';
    queryDigest: string;
    now: Date;
  }) {
    const { items, query, viewerContext, scope, appliedSort, queryDigest, now } = input;
    const seasonId = viewerContext.currentSeasonId;
    if (!seasonId) {
      return { items: [], pageInfo: { hasNextPage: false, nextCursor: null } };
    }

    const startIndex = query.cursor
      ? resolveCursorStartIndex({
          cursor: query.cursor,
          items,
          viewerUserId: viewerContext.viewer.id,
          seasonId,
          scope,
          appliedSort,
          queryDigest,
          now,
        })
      : 0;
    const limit = query.limit ?? 20;
    const page = items.slice(startIndex, startIndex + limit);
    const hasNextPage = startIndex + limit < items.length;
    const lastItem = page.at(-1);
    const nextCursor =
      hasNextPage && lastItem
        ? tokenOwner.signCursor({
            viewerUserId: viewerContext.viewer.id,
            seasonId,
            scope,
            sort: appliedSort,
            queryDigest,
            after: lastItem.cursorBoundary,
            now,
          })
        : null;

    return {
      items: page,
      pageInfo: {
        hasNextPage,
        nextCursor,
      },
    };
  }

  function resolveCursorStartIndex(input: {
    cursor: string;
    items: SearchMaterializedItem[];
    viewerUserId: string;
    seasonId: string;
    scope: RoommateSearchScope;
    appliedSort: 'NICKNAME';
    queryDigest: string;
    now: Date;
  }) {
    try {
      const verified = tokenOwner.verifyCursor({
        token: input.cursor,
        viewerUserId: input.viewerUserId,
        seasonId: input.seasonId,
        scope: input.scope,
        sort: input.appliedSort,
        queryDigest: input.queryDigest,
        now: input.now,
      });
      const firstIndexAfterBoundary = input.items.findIndex((item) =>
        isAfterBoundary(item, verified.boundary),
      );
      return firstIndexAfterBoundary === -1 ? input.items.length : firstIndexAfterBoundary;
    } catch {
      throw roommateSearchErrors.invalidQuery(
        '검색 cursor가 만료되었거나 현재 검색 조건과 일치하지 않습니다.',
      );
    }
  }

  function toSearchMaterializedItem(input: {
    entry: ResolvedVisibleProfileEntry;
    viewerContext: VisibleProfileViewerContext;
    scope: RoommateSearchScope;
    now: Date;
  }): SearchMaterializedItem {
    const summary = toRoommateSearchSummary(input.entry);
    const seasonId = input.viewerContext.currentSeasonId;
    if (!seasonId) {
      return {
        entry: input.entry,
        summary,
        cursorBoundary: toCursorBoundary(input.entry),
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
      cursorBoundary: toCursorBoundary(input.entry),
    };
  }

  async function findCandidateParticipants(
    viewerContext: VisibleProfileViewerContext,
    scope: RoommateSearchScope,
    query?: RoommateSearchQuery,
  ): Promise<TargetParticipantQueryRecord[]> {
    if (!viewerContext.currentSeasonId || viewerContext.serviceState.seasonState === 'OFF_SEASON') {
      return [];
    }

    return deps.prisma.seasonParticipant.findMany({
      where: buildCandidateParticipantWhere(viewerContext, scope, query),
      select: targetParticipantSelect,
      orderBy: [{ profile: { nicknameNormalizedSnapshot: 'asc' } }, { id: 'asc' }],
    });
  }

  return {
    search,
  };
}

function resolveScopeAvailability(viewerContext: VisibleProfileViewerContext) {
  const seasonState = viewerContext.serviceState.seasonState;
  const viewerRegistered = isParticipantRegistered(viewerContext.viewerParticipant);
  const sameBuildingOnly =
    viewerRegistered &&
    viewerHasAssignedDormitory(viewerContext.viewerParticipant, viewerContext) &&
    seasonState !== null &&
    seasonState !== 'OFF_SEASON';

  if (seasonState === null || seasonState === 'OFF_SEASON') {
    return {
      campusMerged: false,
      sameBuildingOnly: false,
    };
  }

  if (seasonState === 'SEASON_OPEN' || seasonState === 'SEASON_POST_MATCH') {
    return {
      campusMerged: true,
      sameBuildingOnly,
    };
  }

  if (viewerRegistered) {
    return {
      campusMerged: false,
      sameBuildingOnly,
    };
  }

  return {
    campusMerged: true,
    sameBuildingOnly: false,
  };
}

function viewerHasAssignedDormitory(
  participant: CurrentSeasonParticipantRecord | null,
  viewerContext: VisibleProfileViewerContext,
) {
  return (
    isParticipantRegistered(participant) &&
    viewerContext.viewerHasOperatedAssignedDormitory &&
    viewerContext.viewerSelection.dormitoryId !== null
  );
}

function resolveDefaultScope(scopeAvailability: {
  campusMerged: boolean;
  sameBuildingOnly: boolean;
}): RoommateSearchScope {
  if (scopeAvailability.campusMerged) {
    return 'CAMPUS_MERGED';
  }
  return 'SAME_BUILDING_ONLY';
}

function isScopeAllowed(
  scopeAvailability: { campusMerged: boolean; sameBuildingOnly: boolean },
  scope: RoommateSearchScope,
) {
  return scope === 'CAMPUS_MERGED'
    ? scopeAvailability.campusMerged
    : scopeAvailability.sameBuildingOnly;
}

function resolveScopeErrorMessage(scope: RoommateSearchScope) {
  return scope === 'CAMPUS_MERGED'
    ? '현재 상태에서는 캠퍼스 통합 범위 검색을 사용할 수 없습니다.'
    : '현재 상태에서는 같은 건물 범위 검색을 사용할 수 없습니다.';
}

function buildCandidateParticipantWhere(
  viewerContext: VisibleProfileViewerContext,
  scope: RoommateSearchScope,
  query?: RoommateSearchQuery,
): Prisma.SeasonParticipantWhereInput {
  const profileWhere = query ? buildSeasonProfileWhere(query) : {};

  return {
    ...(viewerContext.viewerParticipant ? { id: { not: viewerContext.viewerParticipant.id } } : {}),
    seasonId: viewerContext.currentSeasonId ?? '',
    userId: { not: viewerContext.viewer.id },
    user: {
      deletedAt: null,
      campus: viewerContext.viewer.campus,
      gender: viewerContext.viewer.gender,
    },
    participationIntent: 'REGISTERED',
    registeredAt: { not: null },
    declinedAt: null,
    dormitorySelectionState: 'ASSIGNED',
    dormitoryId:
      scope === 'SAME_BUILDING_ONLY' ? viewerContext.viewerSelection.dormitoryId : { not: null },
    participantStatus: { notIn: ['WITHDRAWN', 'EXPIRED'] },
    hiddenByAdminAt: null,
    deactivatedAt: null,
    profile: { is: profileWhere },
  };
}

function buildSeasonProfileWhere(
  query: RoommateSearchQuery,
): Prisma.SeasonParticipantProfileWhereInput {
  return {
    ...(query.college !== undefined ? { collegeCode: query.college } : {}),
    ...(query.grade !== undefined ? { grade: query.grade } : {}),
    ...(query.mbti !== undefined ? { mbti: query.mbti } : {}),
    ...(query.birthYear !== undefined ? { birthYear: query.birthYear } : {}),
    ...(query.smokingBehavior !== undefined ? { smokingBehavior: query.smokingBehavior } : {}),
    ...(query.bedtime !== undefined
      ? {
          bedtime: toStoredBedtime(query.bedtime) as Exclude<
            ReturnType<typeof toStoredBedtime>,
            null
          >,
        }
      : {}),
    ...(query.wakeTime !== undefined
      ? {
          wakeTime: toStoredWakeTime(query.wakeTime) as Exclude<
            ReturnType<typeof toStoredWakeTime>,
            null
          >,
        }
      : {}),
    ...(query.noiseSensitivity !== undefined ? { noiseSensitivity: query.noiseSensitivity } : {}),
    ...(query.cleanLevel !== undefined ? { cleanLevel: query.cleanLevel } : {}),
    ...(query.indoorEating !== undefined ? { indoorEating: query.indoorEating } : {}),
    ...(query.relationshipStyle !== undefined
      ? { relationshipStyle: query.relationshipStyle }
      : {}),
    ...(query.sleepHabit !== undefined
      ? query.sleepHabit === 'HAS'
        ? { sleepHabit: { not: 'NONE' } }
        : { sleepHabit: query.sleepHabit }
      : {}),
  };
}

function hasRequestedFilter(
  query: RoommateSearchQuery,
  fields: ReadonlySet<keyof RoommateSearchQuery>,
) {
  return [...fields].some((field) => query[field] !== undefined);
}

function resolveFilterCapabilities(
  items: RoommateSearchSummary[],
): RoommateSearchResponse['filterCapabilities'] {
  const hasSummaryOnlyTarget = items.some((item) => !item.exposure.canViewFull);
  const hasFullViewTarget = items.some((item) => item.exposure.canViewFull);
  const detailOnlyAllowed = hasFullViewTarget && !hasSummaryOnlyTarget;

  return {
    smokingBehavior: true,
    bedtime: detailOnlyAllowed,
    wakeTime: detailOnlyAllowed,
    noiseSensitivity: detailOnlyAllowed,
    cleanLevel: detailOnlyAllowed,
    sleepHabit: true,
    indoorEating: detailOnlyAllowed,
    relationshipStyle: true,
    college: detailOnlyAllowed,
    grade: detailOnlyAllowed,
    mbti: detailOnlyAllowed,
    birthYear: detailOnlyAllowed,
  };
}

function assertFilterAllowed(
  query: RoommateSearchQuery,
  filterCapabilities: RoommateSearchResponse['filterCapabilities'],
  scopeSummaries: RoommateSearchSummary[],
) {
  if (!hasRequestedFilter(query, DETAIL_ONLY_FILTER_FIELDS)) {
    return;
  }

  const hasSummaryOnlyTarget = scopeSummaries.some((item) => !item.exposure.canViewFull);
  if (hasSummaryOnlyTarget || !filterCapabilities.bedtime) {
    throw roommateSearchErrors.invalidQuery(
      '현재 노출 범위에서는 상세 전용 필터를 사용할 수 없습니다.',
    );
  }
}

function resolveAppliedSort(query: RoommateSearchQuery): 'NICKNAME' {
  if (!query.sort || query.sort === 'NICKNAME') {
    return 'NICKNAME';
  }

  throw roommateSearchErrors.invalidQuery(
    '매칭 점수 정렬은 cursor pagination deterministic ordering 확정 후 제공됩니다.',
  );
}

function applyDiscoveryFilter(entries: ResolvedVisibleProfileEntry[]) {
  const filtered = entries.filter((entry) => !entry.targetMatched);
  return {
    entries: filtered,
    matchedTargetsExcluded: filtered.length !== entries.length,
  };
}

function buildAvailabilityNotices(input: {
  viewerContext: VisibleProfileViewerContext;
  scopeSummaries: RoommateSearchSummary[];
  matchedTargetsExcluded: boolean;
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

  if (
    input.scopeSummaries.some((item) => item.actions.canBookmark || item.actions.canRequestMatch)
  ) {
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

  if (input.scopeSummaries.some((item) => !item.exposure.canViewFull)) {
    add({
      code: 'DETAIL_UNAVAILABLE_BY_POLICY',
      severity: 'INFO',
      message:
        '일부 사용자는 summary만 볼 수 있으며 상세 화면에서는 정책 안내가 표시될 수 있습니다.',
    });
  }

  return [...notices.values()];
}

function toSearchSortKey(entry: ResolvedVisibleProfileEntry) {
  return entry.sourceProfile.nicknameNormalized || entry.sourceProfile.nickname;
}

function toCursorBoundary(entry: ResolvedVisibleProfileEntry): RoommateSearchCursorBoundary {
  return {
    nicknameSortKey: toSearchSortKey(entry),
    participantId: entry.targetParticipant.id,
  };
}

function isAfterBoundary(item: SearchMaterializedItem, boundary: RoommateSearchCursorBoundary) {
  const current = item.cursorBoundary;
  if (current.nicknameSortKey !== boundary.nicknameSortKey) {
    return current.nicknameSortKey > boundary.nicknameSortKey;
  }

  return current.participantId > boundary.participantId;
}

function sortSearchMaterializedItems(items: SearchMaterializedItem[], sort: RoommateSearchSort) {
  if (sort !== 'NICKNAME') {
    throw roommateSearchErrors.invalidQuery(
      '매칭 점수 정렬은 cursor pagination deterministic ordering 확정 후 제공됩니다.',
    );
  }

  return [...items].sort((left, right) => {
    const leftKey = left.cursorBoundary.nicknameSortKey;
    const rightKey = right.cursorBoundary.nicknameSortKey;
    if (leftKey !== rightKey) {
      return leftKey.localeCompare(rightKey, 'ko');
    }

    return left.cursorBoundary.participantId.localeCompare(right.cursorBoundary.participantId);
  });
}

function toRoommateSearchSummary(entry: ResolvedVisibleProfileEntry): RoommateSearchSummary {
  const policy = entry.publicTargetPolicy;
  const base = {
    id: entry.user.id,
    sourceProfile: policy.sourceProfile,
    relation: { type: policy.relation.relationToViewer },
    exposure: {
      listSummaryVisible: true as const,
      detailViewable: policy.exposure.detailViewable,
      canViewFull: policy.exposure.canViewFull,
      scoreVisible: policy.exposure.scoreVisible,
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

  if (!policy.exposure.scoreVisible) {
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
