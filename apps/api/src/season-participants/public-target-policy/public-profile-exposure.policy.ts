import type {
  PublicProfileExposureDecision,
  PublicTargetEligibilityDecision,
  PublicTargetPolicyIntermediate,
} from './public-target-policy.types.js';

export function resolvePublicProfileExposure(
  eligibility: PublicTargetEligibilityDecision,
  intermediate: PublicTargetPolicyIntermediate,
): PublicProfileExposureDecision {
  if (!eligibility.publicTarget) {
    return {
      listSummaryVisible: false,
      detailViewable: false,
      canViewFull: false,
      scoreVisible: false,
    };
  }

  const canViewFull =
    intermediate.matchedPartnerResultReadable || intermediate.sameDormitoryDetailViewable;

  return {
    listSummaryVisible: true,
    detailViewable: canViewFull,
    canViewFull,
    scoreVisible: canViewFull,
  };
}
