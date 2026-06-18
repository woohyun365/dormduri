import type { PublicTargetActionUnavailableReason } from '@repo/shared/profile/contract';
import type {
  PublicTargetActionDecision,
  PublicTargetEligibilityDecision,
  PublicTargetPolicyIntermediate,
  PublicTargetPolicyTargetInput,
  PublicTargetPolicyViewerInput,
} from './public-target-policy.types.js';

export function resolvePublicTargetActions(
  viewer: PublicTargetPolicyViewerInput,
  target: PublicTargetPolicyTargetInput,
  eligibility: PublicTargetEligibilityDecision,
  intermediate: PublicTargetPolicyIntermediate,
): PublicTargetActionDecision {
  const canBookmark = eligibility.publicTarget && intermediate.sameDormitoryDetailViewable;
  const canStartChat =
    eligibility.publicTarget &&
    intermediate.sameDormitoryDetailViewable &&
    (viewer.seasonState === 'SEASON_OPEN' ||
      (viewer.seasonState === 'SEASON_MATCHING' && viewer.currentDormitoryCanMatch));
  const canRequestMatch =
    eligibility.publicTarget &&
    intermediate.sameDormitoryDetailViewable &&
    viewer.seasonState === 'SEASON_MATCHING' &&
    viewer.currentDormitoryCanMatch;

  return {
    canBookmark,
    canRequestMatch,
    canStartChat,
    unavailableReasons: buildActionUnavailableReasons(viewer, target, eligibility, intermediate),
  };
}

function buildActionUnavailableReasons(
  viewer: PublicTargetPolicyViewerInput,
  target: PublicTargetPolicyTargetInput,
  eligibility: PublicTargetEligibilityDecision,
  intermediate: PublicTargetPolicyIntermediate,
): PublicTargetActionUnavailableReason[] {
  const reasons = new Set<PublicTargetActionUnavailableReason>();

  if (!eligibility.publicTarget) {
    reasons.add(
      eligibility.unavailableReason === 'TARGET_DELETED_OR_DEIDENTIFIED'
        ? 'TARGET_DELETED_OR_DEIDENTIFIED'
        : 'TARGET_NOT_PUBLIC',
    );
  }
  if (!viewer.registered) {
    reasons.add('VIEWER_NOT_REGISTERED');
  }
  if (!viewer.seasonProfileComplete) {
    reasons.add('VIEWER_PROFILE_INCOMPLETE');
  }
  if (!viewer.hasOperatedAssignedDormitory) {
    reasons.add('VIEWER_NOT_ASSIGNED');
  }
  if (viewer.matched && !intermediate.matchedPartnerTarget) {
    reasons.add('VIEWER_ALREADY_MATCHED');
  }
  if (target.matched && !intermediate.matchedPartnerTarget) {
    reasons.add('TARGET_ALREADY_MATCHED');
  }
  if (
    eligibility.publicTarget &&
    !intermediate.sameDormitory &&
    !intermediate.matchedPartnerTarget
  ) {
    reasons.add('DIFFERENT_DORMITORY');
  }
  if (viewer.seasonState !== 'SEASON_OPEN' && viewer.seasonState !== 'SEASON_MATCHING') {
    reasons.add('SEASON_NOT_ACTIONABLE');
  }
  if (viewer.seasonState === 'SEASON_MATCHING' && !viewer.currentDormitoryCanMatch) {
    reasons.add('ROOM_SELECTION_CUTOFF');
  }

  return [...reasons];
}
