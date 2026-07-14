import type {
  RoommateSearchPurpose,
  RoommateSearchScope,
} from '@repo/shared/roommate-search/contract';
import type { CurrentSeasonParticipantRecord } from '../../season-participants/application/season-participants.service.js';
import { isParticipantRegistered } from '../../season-participants/policies/index.js';
import type { VisibleProfileViewerContext } from '../../profiles/contracts/profile-public-target-reader.port.js';
import { roommateSearchErrors } from '../errors/roommate-search.errors.js';

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

  if (seasonState === null || seasonState === 'OFF_SEASON') {
    return {
      campusMerged: false,
      sameBuildingOnly: false,
    };
  }

  return {
    campusMerged: true,
    sameBuildingOnly: true,
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

  if (
    !viewerCanUseActionableSameBuilding(viewerContext) ||
    (viewerContext.serviceState.seasonState === 'SEASON_MATCHING' &&
      viewerHasActiveMatch(viewerContext.viewerParticipant))
  ) {
    return 'BROAD_PREVIEW';
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

function viewerCanUseActionableSameBuilding(viewerContext: VisibleProfileViewerContext) {
  return viewerHasAssignedDormitory(viewerContext.viewerParticipant, viewerContext);
}

function viewerHasActiveMatch(participant: CurrentSeasonParticipantRecord | null) {
  return participant?.participantStatus === 'MATCHED' || participant?.matchedAt != null;
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
