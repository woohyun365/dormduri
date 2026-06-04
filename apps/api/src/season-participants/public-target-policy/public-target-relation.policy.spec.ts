import { resolvePublicTargetRelation } from './public-target-relation.policy.js';
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

describe('public-target-relation.policy', () => {
  it('matched partner participant만 MATCHED_PARTNER relation이 된다', () => {
    expect(
      resolvePublicTargetRelation(
        baseViewer({ matchedPartnerParticipantId: 'target-1' }),
        baseTarget({ participantId: 'target-1' }),
      ),
    ).toEqual({ relationToViewer: 'MATCHED_PARTNER', matchedPartnerParticipantId: 'target-1' });

    expect(resolvePublicTargetRelation(baseViewer(), baseTarget())).toEqual({
      relationToViewer: 'GENERAL',
      matchedPartnerParticipantId: null,
    });
  });
});
