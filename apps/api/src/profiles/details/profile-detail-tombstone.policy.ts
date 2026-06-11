import type { PublicProfileTombstoneReason } from '@repo/shared/profile-contract';
import { isParticipantRegistered } from '../../season-participants/policies/index.js';
import type { ProfileViewRecord } from '../contracts/public-profile.presenter.js';
import type {
  PublicProfileTargetCandidate,
  PublicProfileViewerContext,
} from '../targets/public-profile-target.types.js';
import type { resolvePublicTargetPolicy } from '../../season-participants/public-target-policy/index.js';

export function canRenderTombstoneDetail(
  viewerContext: PublicProfileViewerContext,
  publicTargetPolicy: ReturnType<typeof resolvePublicTargetPolicy>,
  hasDetailEntryContext: boolean,
) {
  if (publicTargetPolicy.relation.relationToViewer === 'MATCHED_PARTNER') {
    return true;
  }

  if (!hasDetailEntryContext) {
    return false;
  }

  return viewerContext.serviceState.seasonState !== null;
}

export function resolveProfileDetailTombstoneReason(
  candidate: PublicProfileTargetCandidate,
  sourceProfile: ProfileViewRecord | null,
  eligibilityReason: string | null,
  viewerContext: PublicProfileViewerContext,
  targetSelection: { dormitoryId: string | null },
  hasDetailEntryContext: boolean,
): PublicProfileTombstoneReason {
  if (!hasDetailEntryContext) {
    return 'DETAIL_CONTEXT_NO_LONGER_VALID';
  }

  if (
    candidate.user.deletedAt !== null ||
    eligibilityReason === 'TARGET_DELETED_OR_DEIDENTIFIED' ||
    candidate.participant.hiddenByAdminAt !== null ||
    candidate.participant.deactivatedAt !== null ||
    candidate.participant.participantStatus === 'WITHDRAWN' ||
    candidate.participant.participantStatus === 'EXPIRED' ||
    !sourceProfile ||
    eligibilityReason === 'TARGET_PROFILE_INCOMPLETE' ||
    eligibilityReason === 'TARGET_REGISTRATION_SNAPSHOT_MISSING' ||
    eligibilityReason === 'TARGET_NOT_REGISTERED'
  ) {
    return 'TARGET_NO_LONGER_DISCOVERABLE';
  }

  if (!isParticipantRegistered(viewerContext.viewerParticipant)) {
    return 'DETAIL_REQUIRES_REGISTRATION';
  }

  if (!viewerContext.viewerHasOperatedAssignedDormitory) {
    return 'DETAIL_REQUIRES_ASSIGNED_DORMITORY';
  }

  if (
    viewerContext.viewerSelection.dormitoryId !== null &&
    targetSelection.dormitoryId !== null &&
    viewerContext.viewerSelection.dormitoryId !== targetSelection.dormitoryId
  ) {
    return 'DETAIL_NOT_AVAILABLE_DIFFERENT_DORMITORY';
  }

  return 'DETAIL_CONTEXT_NO_LONGER_VALID';
}
