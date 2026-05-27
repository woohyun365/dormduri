import type {
  PublicTargetEligibilityDecision,
  PublicTargetPolicyTargetInput,
  PublicTargetPolicyViewerInput,
} from './public-target-policy.types.js';

export function resolvePublicTargetEligibility(
  viewer: PublicTargetPolicyViewerInput,
  target: PublicTargetPolicyTargetInput,
): PublicTargetEligibilityDecision {
  if (!viewer.campusOperated) {
    return { publicTarget: false, unavailableReason: 'TARGET_NOT_VISIBLE' };
  }
  if (viewer.seasonState === null) {
    return { publicTarget: false, unavailableReason: 'NO_CURRENT_SEASON' };
  }
  if (viewer.seasonState === 'OFF_SEASON') {
    return { publicTarget: false, unavailableReason: 'OFF_SEASON' };
  }
  if (!target.visible) {
    return { publicTarget: false, unavailableReason: 'TARGET_NOT_VISIBLE' };
  }
  if (!target.registered) {
    return { publicTarget: false, unavailableReason: 'TARGET_NOT_REGISTERED' };
  }
  if (!target.hasSeasonProfile) {
    return { publicTarget: false, unavailableReason: 'TARGET_PROFILE_INCOMPLETE' };
  }
  if (!target.registrationSnapshotExists) {
    return { publicTarget: false, unavailableReason: 'TARGET_REGISTRATION_SNAPSHOT_MISSING' };
  }

  return { publicTarget: true, unavailableReason: null };
}
