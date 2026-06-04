import { resolvePublicResultRead } from './public-result-read.policy.js';
import type {
  PublicTargetEligibilityDecision,
  PublicTargetPolicyIntermediate,
} from './public-target-policy.types.js';

const publicEligibility: PublicTargetEligibilityDecision = {
  publicTarget: true,
  unavailableReason: null,
};

const baseIntermediate = (
  overrides: Partial<PublicTargetPolicyIntermediate> = {},
): PublicTargetPolicyIntermediate => ({
  viewerRegistrationComplete: true,
  sameDormitory: true,
  matchedPartnerTarget: false,
  matchedPartnerResultReadable: false,
  sameDormitoryDetailViewable: true,
  ...overrides,
});

describe('public-result-read.policy', () => {
  it('matched partner readable intermediate만 CURRENT_MATCHED_PARTNER context를 연다', () => {
    expect(
      resolvePublicResultRead(
        publicEligibility,
        baseIntermediate({ matchedPartnerResultReadable: true }),
      ),
    ).toEqual({ resultReadable: true, context: 'CURRENT_MATCHED_PARTNER' });

    expect(resolvePublicResultRead(publicEligibility, baseIntermediate())).toEqual({
      resultReadable: false,
      context: 'NONE',
    });
  });
});
