import type {
  RoommateSearchQuery,
  RoommateSearchResponse,
  RoommateSearchScope,
  RoommateSearchSort,
  RoommateSearchSummary,
  RoommateSearchVisibilityMode,
} from '@repo/shared/roommate-search-contract';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { MatchesService } from '../matches/matches.service.js';
import type {
  CurrentSeasonParticipantRecord,
  SeasonParticipantsService,
} from '../season-participants/season-participants.service.js';
import { isParticipantRegistered } from '../season-participants/season-participant-policy.js';
import type { SeasonsService } from '../seasons/seasons.service.js';
import {
  buildUserWithProfileSelect,
  mapUserWithParticipantProjection,
} from '../users/current-user-select.js';
import { toAdditionalProfile } from './profile.mapper.js';
import { toStoredBedtime, toStoredWakeTime } from './profile-lifestyle.persistence.js';
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

    const scopeUsers = await findCandidateUsers(viewerContext, scope);
    const scopeEntries = await visibleProfileOwner.materializeVisibleProfileEntries(
      viewerContext,
      scopeUsers,
    );
    const scopeSummaries = scopeEntries.map(toRoommateSearchSummary);
    const hasFullEntries = scopeSummaries.some((item) => item.canViewFull);
    const lifestyleFilterRequested = hasLifestyleFilter(query);

    const filterCapabilities = {
      smokingBehavior: hasFullEntries,
      bedtime: hasFullEntries,
      wakeTime: hasFullEntries,
      noiseSensitivity: hasFullEntries,
      cleanLevel: hasFullEntries,
      sleepHabit: hasFullEntries,
      indoorEating: hasFullEntries,
      relationshipStyle: hasFullEntries,
      college: true,
      grade: true,
      mbti: true,
      birthYear: true,
    };
    const sortCapabilities = {
      matchScore: hasFullEntries,
    };

    if (lifestyleFilterRequested && !filterCapabilities.smokingBehavior) {
      throw roommateSearchErrors.invalidQuery(
        '현재 노출 범위에서는 생활패턴 기반 필터를 사용할 수 없습니다.',
      );
    }
    if (query.sort === 'MATCH_SCORE' && !sortCapabilities.matchScore) {
      throw roommateSearchErrors.invalidQuery(
        '현재 노출 범위에서는 매칭 점수 정렬을 사용할 수 없습니다.',
      );
    }

    const filteredUsers = await findCandidateUsers(viewerContext, scope, query);
    const filteredEntries = await visibleProfileOwner.materializeVisibleProfileEntries(
      viewerContext,
      filteredUsers,
    );
    const filteredSummaries = filteredEntries
      .map(toRoommateSearchSummary)
      .filter((item) => !lifestyleFilterRequested || item.canViewFull);

    const appliedSort = resolveAppliedSort(query, filteredSummaries, sortCapabilities.matchScore);
    const sortedItems = sortRoommateSearchSummaries(filteredSummaries, appliedSort);

    return {
      scope,
      appliedSort,
      effectiveVisibility: resolveEffectiveVisibility(scopeSummaries),
      scopeCapabilities,
      filterCapabilities,
      sortCapabilities,
      items: sortedItems.slice(query.offset ?? 0, (query.offset ?? 0) + (query.limit ?? 20)),
    };
  }

  async function findCandidateUsers(
    viewerContext: VisibleProfileViewerContext,
    scope: RoommateSearchScope,
    query?: RoommateSearchQuery,
  ) {
    const users = await deps.prisma.user.findMany({
      where: buildCandidateUserWhere(viewerContext, scope, query),
      select: buildUserWithProfileSelect(viewerContext.currentSeasonId),
      orderBy: { id: 'asc' },
    });

    return users.map(mapUserWithParticipantProjection);
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
      campusMerged: true,
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
  return scopeCapabilities.campusMerged ? 'CAMPUS_MERGED' : 'SAME_BUILDING_ONLY';
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

function buildCandidateUserWhere(
  viewerContext: VisibleProfileViewerContext,
  scope: RoommateSearchScope,
  query?: RoommateSearchQuery,
): Prisma.UserWhereInput {
  const baseWhere: Prisma.UserWhereInput = {
    id: { not: viewerContext.viewer.id },
    deletedAt: null,
    campus: viewerContext.viewer.campus,
    gender: viewerContext.viewer.gender,
    profile: { isNot: null },
  };

  if (
    !viewerContext.serviceState.campusOperated ||
    !viewerContext.currentSeasonId ||
    viewerContext.serviceState.seasonState === null ||
    viewerContext.serviceState.seasonState === 'OFF_SEASON'
  ) {
    return {
      ...baseWhere,
      ...(query ? { profile: { is: buildBaseProfileWhere(query) } } : {}),
    };
  }

  const participantWhere: Prisma.SeasonParticipantWhereInput = {
    seasonId: viewerContext.currentSeasonId,
    participationIntent: 'REGISTERED',
    registeredAt: { not: null },
    ...(scope === 'SAME_BUILDING_ONLY'
      ? {
          dormitoryId: viewerContext.viewerSelection.dormitoryId,
          dormitorySelectionState: 'ASSIGNED',
        }
      : {}),
    profile: query ? { is: buildSeasonProfileWhere(query) } : { isNot: null },
  };

  return {
    ...baseWhere,
    seasonParticipants: {
      some: participantWhere,
    },
  };
}

function buildBaseProfileWhere(query: RoommateSearchQuery): Prisma.UserProfileWhereInput {
  return {
    ...(query.college !== undefined ? { collegeCode: query.college } : {}),
    ...(query.grade !== undefined ? { grade: query.grade } : {}),
    ...(query.mbti !== undefined ? { mbti: query.mbti } : {}),
    ...(query.birthYear !== undefined ? { birthYear: query.birthYear } : {}),
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

function hasLifestyleFilter(query: RoommateSearchQuery) {
  return Boolean(
    query.smokingBehavior ||
    query.bedtime ||
    query.wakeTime ||
    query.noiseSensitivity ||
    query.cleanLevel ||
    query.sleepHabit ||
    query.indoorEating ||
    query.relationshipStyle,
  );
}

function hasAnyFilter(query: RoommateSearchQuery) {
  return Boolean(
    hasLifestyleFilter(query) || query.college || query.grade || query.mbti || query.birthYear,
  );
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
    sourceProfile: entry.sourceProfile.source,
    relationToViewer: entry.exposure.relationToViewer,
    actions: entry.exposure.actions,
    nickname: entry.sourceProfile.nickname,
    intro: entry.sourceProfile.intro,
    messageToRoommate: entry.sourceProfile.messageToRoommate,
    additional: toAdditionalProfile(entry.sourceProfile),
  };

  if (entry.exposure.exposureLevel !== 'FULL') {
    return {
      ...base,
      canViewFull: false,
    };
  }

  if (typeof entry.matchScore !== 'number') {
    throw new Error('[roommate-search-owner] FULL summary target must have matchScore');
  }

  return {
    ...base,
    canViewFull: true,
    matchScore: entry.matchScore,
  };
}

function sortRoommateSearchSummaries(items: RoommateSearchSummary[], sort: RoommateSearchSort) {
  if (sort !== 'MATCH_SCORE') {
    return [...items].sort((left, right) => left.nickname.localeCompare(right.nickname, 'ko'));
  }

  return [...items].sort((left, right) => {
    const leftScore = left.canViewFull ? left.matchScore : null;
    const rightScore = right.canViewFull ? right.matchScore : null;

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

function resolveEffectiveVisibility(items: RoommateSearchSummary[]): RoommateSearchVisibilityMode {
  const hasFull = items.some((item) => item.canViewFull);
  const hasLimited = items.some((item) => !item.canViewFull);

  if (hasFull && hasLimited) {
    return 'MIXED_VISIBILITY';
  }
  if (hasFull) {
    return 'FULL_ONLY';
  }
  return 'LIMITED_ONLY';
}
