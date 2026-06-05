import { resolvePublicProfileExposure } from './public-profile-exposure.policy.js';
import { resolvePublicResultRead } from './public-result-read.policy.js';
import { resolvePublicTargetActions } from './public-target-action.policy.js';
import { resolvePublicTargetEligibility } from './public-target-eligibility.policy.js';
import { resolvePublicTargetRelation } from './public-target-relation.policy.js';
import type {
  PublicTargetPolicy,
  PublicTargetPolicyIntermediate,
  PublicTargetPolicyTargetInput,
  PublicTargetPolicyViewerInput,
} from './public-target-policy.types.js';

const SEASON_PROFILE_SOURCE = 'SEASON_PARTICIPANT_PROFILE' as const;

export function resolvePublicTargetPolicy(
  viewer: PublicTargetPolicyViewerInput,
  target: PublicTargetPolicyTargetInput,
): PublicTargetPolicy {
  const eligibility = resolvePublicTargetEligibility(viewer, target);
  const relation = resolvePublicTargetRelation(viewer, target);
  const intermediate = buildIntermediate(viewer, target);
  const exposure = resolvePublicProfileExposure(eligibility, intermediate);
  const resultRead = resolvePublicResultRead(eligibility, intermediate);
  const actions = resolvePublicTargetActions(viewer, target, eligibility, intermediate);

  return {
    sourceProfile: SEASON_PROFILE_SOURCE,
    eligibility,
    relation,
    exposure,
    actions,
    resultRead,
  };
}

function buildIntermediate(
  viewer: PublicTargetPolicyViewerInput,
  target: PublicTargetPolicyTargetInput,
): PublicTargetPolicyIntermediate {
  const matchedPartnerTarget =
    viewer.matchedPartnerParticipantId !== null &&
    target.participantId === viewer.matchedPartnerParticipantId;
  const sameDormitory =
    viewer.hasOperatedAssignedDormitory &&
    target.hasOperatedAssignedDormitory &&
    viewer.dormitoryId !== null &&
    viewer.dormitoryId === target.dormitoryId;
  const viewerRegistrationComplete =
    viewer.registered && viewer.seasonProfileComplete && viewer.hasOperatedAssignedDormitory;
  const matchedPartnerResultReadable =
    matchedPartnerTarget &&
    (viewer.seasonState === 'SEASON_MATCHING' || viewer.seasonState === 'SEASON_POST_MATCH');
  const sameDormitoryDetailViewable =
    viewerRegistrationComplete &&
    sameDormitory &&
    !viewer.matched &&
    !target.matched &&
    (viewer.seasonState === 'SEASON_OPEN' || viewer.seasonState === 'SEASON_MATCHING');

  return {
    viewerRegistrationComplete,
    sameDormitory,
    matchedPartnerTarget,
    matchedPartnerResultReadable,
    sameDormitoryDetailViewable,
  };
}
