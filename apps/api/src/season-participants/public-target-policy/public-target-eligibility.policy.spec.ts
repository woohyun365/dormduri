import { resolvePublicTargetEligibility } from './public-target-eligibility.policy.js';
import type {
  PublicTargetPolicyTargetInput,
  PublicTargetPolicyViewerInput,
} from './public-target-policy.types.js';

const baseViewer = (
  overrides: Partial<PublicTargetPolicyViewerInput> = {},
): PublicTargetPolicyViewerInput => ({
  campusOperated: true,
  seasonState: 'SEASON_OPEN',
  registered: true,
  matched: false,
  seasonProfileComplete: true,
  matchedPartnerParticipantId: null,
  selectionState: 'ASSIGNED',
  dormitoryId: 'dasan',
  hasOperatedAssignedDormitory: true,
  currentDormitoryCanMatch: false,
  ...overrides,
});

const baseTarget = (
  overrides: Partial<PublicTargetPolicyTargetInput> = {},
): PublicTargetPolicyTargetInput => ({
  participantId: 'target-1',
  visible: true,
  registered: true,
  matched: false,
  selectionState: 'ASSIGNED',
  dormitoryId: 'dasan',
  hasOperatedAssignedDormitory: true,
  hasSeasonProfile: true,
  seasonProfileComplete: true,
  registrationSnapshotExists: true,
  deletedOrDeidentified: false,
  ...overrides,
});

describe('public-target-eligibility.policy', () => {
  it('OFF_SEASON에는 public target 자체를 닫는다', () => {
    expect(
      resolvePublicTargetEligibility(baseViewer({ seasonState: 'OFF_SEASON' }), baseTarget()),
    ).toEqual({
      publicTarget: false,
      unavailableReason: 'OFF_SEASON',
    });
  });

  it('registration snapshot이 없는 target은 public summary/detail 대상이 아니다', () => {
    expect(
      resolvePublicTargetEligibility(
        baseViewer(),
        baseTarget({ registrationSnapshotExists: false }),
      ),
    ).toEqual({
      publicTarget: false,
      unavailableReason: 'TARGET_REGISTRATION_SNAPSHOT_MISSING',
    });
  });

  it('visible registered target도 profile이 없거나 incomplete하면 profile incomplete reason으로 닫는다', () => {
    for (const target of [
      baseTarget({ hasSeasonProfile: false, seasonProfileComplete: false }),
      baseTarget({ hasSeasonProfile: true, seasonProfileComplete: false }),
    ]) {
      expect(resolvePublicTargetEligibility(baseViewer(), target)).toEqual({
        publicTarget: false,
        unavailableReason: 'TARGET_PROFILE_INCOMPLETE',
      });
    }
  });

  it('registration complete + visible + profile snapshot target만 public target이다', () => {
    expect(resolvePublicTargetEligibility(baseViewer(), baseTarget())).toEqual({
      publicTarget: true,
      unavailableReason: null,
    });
  });
});
