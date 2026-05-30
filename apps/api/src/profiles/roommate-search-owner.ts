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
import { PROFILE_MBTI_VALUES } from '@repo/shared/profile-contract';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { MatchesService } from '../matches/matches.service.js';
import type { SeasonParticipantsService } from '../season-participants/season-participants.service.js';
import { currentSeasonParticipantSelect } from '../season-participants/season-participant-records.js';
import { isParticipantRegistered } from '../season-participants/season-participant-policy.js';
import type { SeasonsService } from '../seasons/seasons.service.js';
import { toStoredBedtime, toStoredWakeTime } from '../common/lifestyle/lifestyle.persistence.js';
import { roommateSearchErrors } from './roommate-search.errors.js';
import { buildRoommateSearchManifest } from './roommate-search-filter-manifest.owner.js';
import {
  assertRoommateSearchQueryAllowed,
  hasEffectiveRoommateSearchFilter,
} from './roommate-search-query-policy.owner.js';
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

export function createRoommateSearchOwner(deps: RoommateSearchOwnerDeps) {
  const visibleProfileOwner = createVisibleProfileOwner(deps);
  const tokenOwner = createRoommateSearchTokenOwner();

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

    const appliedSort = assertNicknameSort(queryPolicy.appliedSort);
    const filteredEntries = await loadVisibleEntries(viewerContext, scope, query);
    const filteredDiscovery = applyDiscoveryFilter(filteredEntries, {
      excludeMatchedTargets: shouldExcludeMatchedTargetsFromDiscovery(purpose),
    });
    const filteredItems = filteredDiscovery.entries.map((entry) =>
      toSearchMaterializedItem({ entry, viewerContext, scope, purpose, now }),
    );
    const sortedItems = sortSearchMaterializedItems(filteredItems, appliedSort);
    const queryDigest = tokenOwner.buildQueryDigest({
      scope,
      sort: appliedSort,
      query,
    });
    const pageItems = paginateItems({
      items: sortedItems,
      query,
      viewerContext,
      scope,
      appliedSort,
      queryDigest,
      now,
    });
    const filteredSummaries = filteredItems.map((item) => item.summary);

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
          hasEffectiveRoommateSearchFilter(query) && filteredDiscovery.entries.length === 0,
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
    purpose: RoommateSearchPurpose;
    now: Date;
  }): SearchMaterializedItem {
    const summary = toRoommateSearchSummary(input.entry, input.purpose);
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

function buildCandidateParticipantWhere(
  viewerContext: VisibleProfileViewerContext,
  scope: RoommateSearchScope,
  query?: RoommateSearchQuery,
): Prisma.SeasonParticipantWhereInput {
  const profileWhere = query ? buildSeasonProfileWhere(query, viewerContext) : {};

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
  viewerContext: VisibleProfileViewerContext,
): Prisma.SeasonParticipantProfileWhereInput {
  const mbtiWhere = buildMbtiWhere(query);
  const ageBandWhere = buildAgeBandWhere(query, viewerContext.seasonReferenceYear);

  return {
    ...(query.college !== undefined ? { collegeCode: toStringNullableFilter(query.college) } : {}),
    ...(query.grade !== undefined ? { grade: toStringNullableFilter(query.grade) } : {}),
    ...(mbtiWhere ? { mbti: mbtiWhere } : {}),
    ...(ageBandWhere ? { OR: ageBandWhere } : {}),
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

function buildMbtiWhere(query: RoommateSearchQuery): Prisma.StringNullableFilter | null {
  const traits = query.mbtiTraits;
  if (!traits) {
    return null;
  }

  const selectedTraits: string[] = [];
  if (traits.energy) {
    selectedTraits.push(traits.energy);
  }
  if (traits.perception) {
    selectedTraits.push(traits.perception);
  }
  if (traits.decision) {
    selectedTraits.push(traits.decision);
  }
  if (traits.lifestyle) {
    selectedTraits.push(traits.lifestyle);
  }
  if (selectedTraits.length === 0) {
    return null;
  }

  const matchingValues = PROFILE_MBTI_VALUES.filter((value) =>
    selectedTraits.every((trait) => value.includes(trait)),
  );
  return { in: [...matchingValues] };
}

function buildAgeBandWhere(
  query: RoommateSearchQuery,
  seasonReferenceYear: number | null,
): Prisma.SeasonParticipantProfileWhereInput[] | null {
  if (!query.ageBand || !seasonReferenceYear) {
    return null;
  }

  return query.ageBand.values.map((value) => {
    if (value === '25_PLUS') {
      return { birthYear: { lte: seasonReferenceYear - 25 } };
    }

    return { birthYear: seasonReferenceYear - Number(value) };
  });
}

function toStringNullableFilter(filter: { operator: 'INCLUDE' | 'EXCLUDE'; values: string[] }) {
  return filter.operator === 'INCLUDE' ? { in: filter.values } : { notIn: filter.values };
}

function assertNicknameSort(sort: RoommateSearchSort): 'NICKNAME' {
  if (sort === 'NICKNAME') {
    return sort;
  }

  throw roommateSearchErrors.invalidQuery(
    '매칭 점수 정렬은 score projection cursor 구현 후 제공됩니다.',
  );
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
