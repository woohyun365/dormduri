import { resolvePublicProfileExposure } from './public-profile-exposure.policy.js';
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

describe('public-profile-exposure.policy', () => {
  it('public target이 아니면 list/detail/score exposure를 모두 닫는다', () => {
    expect(
      resolvePublicProfileExposure(
        { publicTarget: false, unavailableReason: 'OFF_SEASON' },
        baseIntermediate(),
      ),
    ).toEqual({
      listSummaryVisible: false,
      detailViewable: false,
      canViewFull: false,
      scoreVisible: false,
    });
  });

  it('summary-only target은 list-summary만 열고 detail/score는 canViewFull에서 파생해 닫는다', () => {
    expect(
      resolvePublicProfileExposure(
        publicEligibility,
        baseIntermediate({ sameDormitoryDetailViewable: false }),
      ),
    ).toEqual({
      listSummaryVisible: true,
      detailViewable: false,
      canViewFull: false,
      scoreVisible: false,
    });
  });

  it('same-dormitory detail 또는 matched result-read target은 full/detail/score exposure를 연다', () => {
    for (const intermediate of [
      baseIntermediate({
        sameDormitoryDetailViewable: true,
        matchedPartnerResultReadable: false,
      }),
      baseIntermediate({
        sameDormitoryDetailViewable: false,
        matchedPartnerResultReadable: true,
      }),
    ]) {
      const result = resolvePublicProfileExposure(publicEligibility, intermediate);

      expect(result).toEqual({
        listSummaryVisible: true,
        detailViewable: true,
        canViewFull: true,
        scoreVisible: true,
      });
      expect(result.detailViewable).toBe(result.canViewFull);
      expect(result.scoreVisible).toBe(result.canViewFull);
    }
  });
});
