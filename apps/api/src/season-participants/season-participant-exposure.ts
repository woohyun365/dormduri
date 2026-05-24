import type {
  ProfileRelationToViewer,
  ProfileSource,
  PublicProfileActionCapabilities,
} from '@repo/shared/profile-contract';
import type { SeasonState } from '@repo/shared/season-contract';
import type { DormitorySelectionState } from '@repo/shared/dormitory-contract';

export interface PublicExposureViewerInput {
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

export interface PublicExposureTargetInput {
  participantId: string | null;
  visible: boolean;
  registered: boolean;
  matched: boolean;
  selectionState: DormitorySelectionState;
  dormitoryId: string | null;
  hasOperatedAssignedDormitory: boolean;
  hasSeasonProfile: boolean;
  registrationSnapshotExists: boolean;
}

export interface PublicExposureDecision {
  summaryVisible: boolean;
  detailViewable: boolean;
  canViewFull: boolean;
  scoreVisible: boolean;
  sourceProfile: ProfileSource;
  relationToViewer: ProfileRelationToViewer;
  actions: PublicProfileActionCapabilities;
}

const SEASON_PROFILE_SOURCE: ProfileSource = 'SEASON_PARTICIPANT_PROFILE';

const NO_PROFILE_ACTIONS: PublicProfileActionCapabilities = {
  canBookmark: false,
  canRequestMatch: false,
  canStartChat: false,
};

function hiddenExposure(): PublicExposureDecision {
  return {
    summaryVisible: false,
    detailViewable: false,
    canViewFull: false,
    scoreVisible: false,
    sourceProfile: SEASON_PROFILE_SOURCE,
    relationToViewer: 'GENERAL',
    actions: NO_PROFILE_ACTIONS,
  };
}

export function resolvePublicExposure(
  viewer: PublicExposureViewerInput,
  target: PublicExposureTargetInput,
): PublicExposureDecision {
  if (
    !viewer.campusOperated ||
    viewer.seasonState === null ||
    viewer.seasonState === 'OFF_SEASON'
  ) {
    return hiddenExposure();
  }

  if (
    !target.visible ||
    !target.registered ||
    !target.hasSeasonProfile ||
    !target.registrationSnapshotExists
  ) {
    return hiddenExposure();
  }

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
  const viewerCanBookmark =
    viewerRegistrationComplete &&
    (viewer.seasonState === 'SEASON_OPEN' ||
      viewer.seasonState === 'SEASON_MATCHING' ||
      viewer.seasonState === 'SEASON_POST_MATCH');
  const matchedPartnerDetail =
    matchedPartnerTarget &&
    (viewer.seasonState === 'SEASON_MATCHING' || viewer.seasonState === 'SEASON_POST_MATCH');
  const sameDormitoryDetail =
    viewerRegistrationComplete &&
    sameDormitory &&
    !viewer.matched &&
    !target.matched &&
    (viewer.seasonState === 'SEASON_OPEN' || viewer.seasonState === 'SEASON_MATCHING');
  const canViewFull = matchedPartnerDetail || sameDormitoryDetail;
  // canViewFull is the authoritative domain capability; response/UI flags derive from it.
  const detailViewable = canViewFull;
  const scoreVisible = canViewFull;
  const viewerCanChatCandidate =
    sameDormitoryDetail &&
    (viewer.seasonState === 'SEASON_OPEN' ||
      (viewer.seasonState === 'SEASON_MATCHING' && viewer.currentDormitoryCanMatch));
  const viewerCanRequestMatch =
    sameDormitoryDetail &&
    viewer.seasonState === 'SEASON_MATCHING' &&
    viewer.currentDormitoryCanMatch;

  return {
    summaryVisible: true,
    detailViewable,
    canViewFull,
    scoreVisible,
    sourceProfile: SEASON_PROFILE_SOURCE,
    relationToViewer: matchedPartnerDetail ? 'MATCHED_PARTNER' : 'GENERAL',
    actions: {
      canBookmark: viewerCanBookmark,
      canRequestMatch: viewerCanRequestMatch,
      canStartChat: viewerCanChatCandidate,
    },
  };
}
