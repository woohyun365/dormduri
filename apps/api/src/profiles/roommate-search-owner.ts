import type {
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

const SUMMARY_FILTER_FIELDS = new Set<keyof RoommateSearchQuery>([
  'smokingBehavior',
  'sleepHabit',
  'relationshipStyle',
]);
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

  async function search(
    authUser: AuthenticatedUserContext,
    query: RoommateSearchQuery,
  ): Promise<RoommateSearchResponse> {
    const now = await deps.prisma.getDatabaseNow();
    const viewerContext = await visibleProfileOwner.loadViewerContext(authUser, now);
    const scopeCapabilities = resolveScopeCapabilities(viewerContext);
    const scope = query.scope ?? resolveDefaultScope(scopeCapabilities);

    if (!isScopeAllowed(scopeCapabilities, scope)) {
      throw roommateSearchErrors.invalidQuery(resolveScopeErrorMessage(scope));
    }

    const scopeCandidates = await findCandidateParticipants(viewerContext, scope);
    const scopeEntries = await visibleProfileOwner.materializeVisibleProfileEntries(
      viewerContext,
      scopeCandidates.map((candidate) =>
        visibleProfileOwner.mapTargetParticipantCandidate(
          candidate as unknown as Parameters<
            typeof visibleProfileOwner.mapTargetParticipantCandidate
          >[0],
        ),
      ),
    );
    const scopeSummaries = scopeEntries.map(toRoommateSearchSummary);
    const filterCapabilities = resolveFilterCapabilities(scopeSummaries);
    const sortCapabilities = {
      matchScore: scopeSummaries.some((item) => item.scoreVisible),
    };

    assertFilterAllowed(query, filterCapabilities, scopeSummaries);
    if (query.sort === 'MATCH_SCORE' && !sortCapabilities.matchScore) {
      throw roommateSearchErrors.invalidQuery(
        '현재 노출 범위에서는 매칭 점수 정렬을 사용할 수 없습니다.',
      );
    }

    const filteredCandidates = await findCandidateParticipants(viewerContext, scope, query);
    const filteredEntries = await visibleProfileOwner.materializeVisibleProfileEntries(
      viewerContext,
      filteredCandidates.map((candidate) =>
        visibleProfileOwner.mapTargetParticipantCandidate(
          candidate as unknown as Parameters<
            typeof visibleProfileOwner.mapTargetParticipantCandidate
          >[0],
        ),
      ),
    );
    const filteredSummaries = filteredEntries.map(toRoommateSearchSummary);

    const appliedSort = resolveAppliedSort(query, filteredSummaries, sortCapabilities.matchScore);
    const sortedItems = sortRoommateSearchSummaries(filteredSummaries, appliedSort);

    return {
      scope,
      appliedSort,
      resultSummary: summarizeResults(scopeSummaries),
      scopeCapabilities,
      filterCapabilities,
      sortCapabilities,
      items: sortedItems.slice(query.offset ?? 0, (query.offset ?? 0) + (query.limit ?? 20)),
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
      orderBy: { id: 'asc' },
    });
  }

  return {
    search,
  };
}

function resolveScopeCapabilities(viewerContext: VisibleProfileViewerContext) {
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

  if (seasonState === 'SEASON_OPEN') {
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

function resolveDefaultScope(scopeCapabilities: {
  campusMerged: boolean;
  sameBuildingOnly: boolean;
}): RoommateSearchScope {
  if (scopeCapabilities.campusMerged) {
    return 'CAMPUS_MERGED';
  }
  return 'SAME_BUILDING_ONLY';
}

function isScopeAllowed(
  scopeCapabilities: { campusMerged: boolean; sameBuildingOnly: boolean },
  scope: RoommateSearchScope,
) {
  return scope === 'CAMPUS_MERGED'
    ? scopeCapabilities.campusMerged
    : scopeCapabilities.sameBuildingOnly;
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

function hasAnyFilter(query: RoommateSearchQuery) {
  return (
    hasRequestedFilter(query, SUMMARY_FILTER_FIELDS) ||
    hasRequestedFilter(query, DETAIL_ONLY_FILTER_FIELDS)
  );
}

function resolveFilterCapabilities(
  items: RoommateSearchSummary[],
): RoommateSearchResponse['filterCapabilities'] {
  const hasSummaryOnlyTarget = items.some((item) => !item.canViewFull);
  const hasFullViewTarget = items.some((item) => item.canViewFull);
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

  const hasSummaryOnlyTarget = scopeSummaries.some((item) => !item.canViewFull);
  if (hasSummaryOnlyTarget || !filterCapabilities.bedtime) {
    throw roommateSearchErrors.invalidQuery(
      '현재 노출 범위에서는 상세 전용 필터를 사용할 수 없습니다.',
    );
  }
}

function resolveAppliedSort(
  query: RoommateSearchQuery,
  items: RoommateSearchSummary[],
  canSortByMatchScore: boolean,
): RoommateSearchSort {
  if (query.sort) {
    return query.sort;
  }

  if (!hasAnyFilter(query) && canSortByMatchScore && items.length > 0) {
    return 'MATCH_SCORE';
  }

  return 'NICKNAME';
}

function toRoommateSearchSummary(entry: ResolvedVisibleProfileEntry): RoommateSearchSummary {
  const base = {
    id: entry.user.id,
    sourceProfile: entry.exposure.sourceProfile,
    relationToViewer: entry.exposure.relationToViewer,
    summaryVisible: true as const,
    canViewFull: entry.exposure.canViewFull,
    detailViewable: entry.exposure.detailViewable,
    scoreVisible: entry.exposure.scoreVisible,
    actions: entry.exposure.actions,
    nickname: entry.sourceProfile.nickname,
    intro: entry.sourceProfile.intro,
    smokingBehavior: entry.sourceProfile.lifestyle.smokingBehavior,
    sleepHabit: entry.sourceProfile.lifestyle.sleepHabit,
    relationshipStyle: entry.sourceProfile.lifestyle.relationshipStyle,
  };

  if (!entry.exposure.scoreVisible) {
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

function sortRoommateSearchSummaries(items: RoommateSearchSummary[], sort: RoommateSearchSort) {
  if (sort !== 'MATCH_SCORE') {
    return [...items].sort((left, right) => left.nickname.localeCompare(right.nickname, 'ko'));
  }

  return [...items].sort((left, right) => {
    const leftScore = left.scoreVisible ? left.matchScore : null;
    const rightScore = right.scoreVisible ? right.matchScore : null;

    if (typeof leftScore === 'number' && typeof rightScore === 'number') {
      const scoreDiff = rightScore - leftScore;
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return left.nickname.localeCompare(right.nickname, 'ko');
    }

    if (typeof leftScore === 'number') {
      return -1;
    }
    if (typeof rightScore === 'number') {
      return 1;
    }

    return left.nickname.localeCompare(right.nickname, 'ko');
  });
}

function summarizeResults(items: RoommateSearchSummary[]): RoommateSearchResponse['resultSummary'] {
  return {
    summaryOnlyCount: items.filter((item) => !item.detailViewable).length,
    detailViewableCount: items.filter((item) => item.detailViewable).length,
    scoreVisibleCount: items.filter((item) => item.scoreVisible).length,
  };
}
