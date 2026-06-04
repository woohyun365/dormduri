import { resolvePublicTargetActions } from './public-target-action.policy.js';
import type {
  PublicTargetEligibilityDecision,
  PublicTargetPolicyIntermediate,
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

describe('public-target-action.policy', () => {
  it('미등록 viewer는 summary target을 볼 수 있어도 match/chat action reason을 닫는다', () => {
    const result = resolvePublicTargetActions(
      baseViewer({
        registered: false,
        seasonProfileComplete: false,
        selectionState: 'NOT_SELECTED',
        dormitoryId: null,
        hasOperatedAssignedDormitory: false,
      }),
      baseTarget(),
      publicEligibility,
      baseIntermediate({ viewerRegistrationComplete: false, sameDormitoryDetailViewable: false }),
    );

    expect(result).toMatchObject({
      canBookmark: false,
      canRequestMatch: false,
      canStartChat: false,
    });
    expect(result.unavailableReasons).toEqual(
      expect.arrayContaining([
        'VIEWER_NOT_REGISTERED',
        'VIEWER_PROFILE_INCOMPLETE',
        'VIEWER_NOT_ASSIGNED',
      ]),
    );
  });

  it('SEASON_MATCHING same-dormitory full target은 request/chat action을 연다', () => {
    expect(
      resolvePublicTargetActions(
        baseViewer({ seasonState: 'SEASON_MATCHING', currentDormitoryCanMatch: true }),
        baseTarget(),
        publicEligibility,
        baseIntermediate({ sameDormitoryDetailViewable: true }),
      ),
    ).toMatchObject({
      canBookmark: true,
      canRequestMatch: true,
      canStartChat: true,
      unavailableReasons: [],
    });
  });

  it('다른 dormitory target은 summary가 보여도 bookmark/match/chat action을 닫는다', () => {
    expect(
      resolvePublicTargetActions(
        baseViewer({ seasonState: 'SEASON_OPEN' }),
        baseTarget({ dormitoryId: 'taegye' }),
        publicEligibility,
        baseIntermediate({ sameDormitory: false, sameDormitoryDetailViewable: false }),
      ),
    ).toMatchObject({
      canBookmark: false,
      canRequestMatch: false,
      canStartChat: false,
      unavailableReasons: ['DIFFERENT_DORMITORY'],
    });
  });

  it('SEASON_POST_MATCH matched result context는 result-read만 유지하고 신규 action을 닫는다', () => {
    expect(
      resolvePublicTargetActions(
        baseViewer({
          seasonState: 'SEASON_POST_MATCH',
          matched: true,
          matchedPartnerParticipantId: 'target-1',
        }),
        baseTarget({ participantId: 'target-1', matched: true }),
        publicEligibility,
        baseIntermediate({
          matchedPartnerTarget: true,
          matchedPartnerResultReadable: true,
          sameDormitoryDetailViewable: false,
        }),
      ),
    ).toEqual({
      canBookmark: false,
      canRequestMatch: false,
      canStartChat: false,
      unavailableReasons: ['SEASON_NOT_ACTIONABLE'],
    });
  });
});
