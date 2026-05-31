import type {
  PublicResultReadDecision,
  PublicTargetEligibilityDecision,
  PublicTargetPolicyIntermediate,
} from './public-target-policy.types.js';

export function resolvePublicResultRead(
  eligibility: PublicTargetEligibilityDecision,
  intermediate: PublicTargetPolicyIntermediate,
): PublicResultReadDecision {
  if (!eligibility.publicTarget || !intermediate.matchedPartnerResultReadable) {
    return { resultReadable: false, context: 'NONE' };
  }

  return { resultReadable: true, context: 'CURRENT_MATCHED_PARTNER' };
}
