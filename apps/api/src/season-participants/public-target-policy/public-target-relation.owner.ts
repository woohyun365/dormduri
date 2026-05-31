import type {
  PublicTargetPolicyTargetInput,
  PublicTargetPolicyViewerInput,
  PublicTargetRelationDecision,
} from './public-target-policy.types.js';

export function resolvePublicTargetRelation(
  viewer: PublicTargetPolicyViewerInput,
  target: PublicTargetPolicyTargetInput,
): PublicTargetRelationDecision {
  const matchedPartnerTarget =
    viewer.matchedPartnerParticipantId !== null &&
    target.participantId === viewer.matchedPartnerParticipantId;

  return {
    relationToViewer: matchedPartnerTarget ? 'MATCHED_PARTNER' : 'GENERAL',
    matchedPartnerParticipantId: matchedPartnerTarget ? target.participantId : null,
  };
}
