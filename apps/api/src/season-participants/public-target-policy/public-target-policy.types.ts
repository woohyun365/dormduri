import type {
  ProfileRelationToViewer,
  ProfileSource,
  PublicProfileActionCapabilities,
  PublicTargetActionUnavailableReason,
  PublicTargetResultReadContext,
} from '@repo/shared/profile-contract';
import type { DormitorySelectionState } from '@repo/shared/dormitory-contract';
import type { SeasonState } from '@repo/shared/season-contract';

export interface PublicTargetPolicyViewerInput {
  campusOperated: boolean;
  seasonState: SeasonState | null;
  registered: boolean;
  matched: boolean;
  seasonProfileComplete: boolean;
  matchedPartnerParticipantId: string | null;
  selectionState: DormitorySelectionState;
  dormitoryId: string | null;
  hasOperatedAssignedDormitory: boolean;
  currentDormitoryCanMatch: boolean;
}

export interface PublicTargetPolicyTargetInput {
  participantId: string | null;
  visible: boolean;
  registered: boolean;
  matched: boolean;
  selectionState: DormitorySelectionState;
  dormitoryId: string | null;
  hasOperatedAssignedDormitory: boolean;
  hasSeasonProfile: boolean;
  seasonProfileComplete: boolean;
  registrationSnapshotExists: boolean;
  deletedOrDeidentified: boolean;
}

export type PublicTargetEligibilityUnavailableReason =
  | 'NO_CURRENT_SEASON'
  | 'OFF_SEASON'
  | 'TARGET_NOT_VISIBLE'
  | 'TARGET_NOT_REGISTERED'
  | 'TARGET_PROFILE_INCOMPLETE'
  | 'TARGET_REGISTRATION_SNAPSHOT_MISSING'
  | 'TARGET_DELETED_OR_DEIDENTIFIED';

export interface PublicTargetEligibilityDecision {
  publicTarget: boolean;
  unavailableReason: PublicTargetEligibilityUnavailableReason | null;
}

export interface PublicTargetRelationDecision {
  relationToViewer: ProfileRelationToViewer;
  matchedPartnerParticipantId: string | null;
}

export interface PublicProfileExposureDecision {
  listSummaryVisible: boolean;
  detailViewable: boolean;
  canViewFull: boolean;
  scoreVisible: boolean;
}

export interface PublicTargetActionDecision extends PublicProfileActionCapabilities {
  unavailableReasons: PublicTargetActionUnavailableReason[];
}

export interface PublicResultReadDecision {
  resultReadable: boolean;
  context: PublicTargetResultReadContext;
}

export interface PublicTargetPolicy {
  sourceProfile: ProfileSource;
  eligibility: PublicTargetEligibilityDecision;
  relation: PublicTargetRelationDecision;
  exposure: PublicProfileExposureDecision;
  actions: PublicTargetActionDecision;
  resultRead: PublicResultReadDecision;
}

export interface PublicTargetPolicyIntermediate {
  viewerRegistrationComplete: boolean;
  sameDormitory: boolean;
  matchedPartnerTarget: boolean;
  matchedPartnerResultReadable: boolean;
  sameDormitoryDetailViewable: boolean;
}
