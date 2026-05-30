import type {
  RoommateSearchPurpose,
  RoommateSearchScope,
} from '@repo/shared/roommate-search-contract';
import type { CurrentSeasonParticipantRecord } from '../season-participants/season-participants.service.js';
import { isParticipantRegistered } from '../season-participants/season-participant-policy.js';
import type { VisibleProfileViewerContext } from './visible-profile-owner.js';
import { roommateSearchErrors } from './roommate-search.errors.js';

export interface RoommateSearchScopeAvailability {
  campusMerged: boolean;
  sameBuildingOnly: boolean;
}

export interface RoommateSearchScopeContext {
  scopeAvailability: RoommateSearchScopeAvailability;
  scope: RoommateSearchScope;
  purpose: RoommateSearchPurpose;
}

export function resolveRoommateSearchScopeAvailability(
  viewerContext: VisibleProfileViewerContext,
): RoommateSearchScopeAvailability {
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

export function resolveRoommateSearchScopeContext(
  viewerContext: VisibleProfileViewerContext,
  requestedScope: RoommateSearchScope | undefined,
): RoommateSearchScopeContext {
  const scopeAvailability = resolveRoommateSearchScopeAvailability(viewerContext);
  const scope = requestedScope ?? resolveDefaultScope(scopeAvailability);

  if (!isScopeAllowed(scopeAvailability, scope)) {
    throw roommateSearchErrors.invalidQuery(resolveScopeErrorMessage(scope));
  }

  return {
    scopeAvailability,
    scope,
    purpose: resolveRoommateSearchPurpose(viewerContext, scope),
  };
}

export function resolveRoommateSearchPurpose(
  viewerContext: VisibleProfileViewerContext,
  scope: RoommateSearchScope,
): RoommateSearchPurpose {
  if (scope === 'CAMPUS_MERGED') {
    return 'BROAD_PREVIEW';
  }

  if (viewerContext.serviceState.seasonState === 'SEASON_POST_MATCH') {
    return 'POST_MATCH_COHORT_REVIEW';
  }

  return 'ACTIONABLE_DETAIL_DISCOVERY';
}

export function shouldExcludeMatchedTargetsFromDiscovery(purpose: RoommateSearchPurpose) {
  return purpose !== 'POST_MATCH_COHORT_REVIEW';
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

function resolveDefaultScope(
  scopeAvailability: RoommateSearchScopeAvailability,
): RoommateSearchScope {
  if (scopeAvailability.campusMerged) {
    return 'CAMPUS_MERGED';
  }
  return 'SAME_BUILDING_ONLY';
}

function isScopeAllowed(
  scopeAvailability: RoommateSearchScopeAvailability,
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
