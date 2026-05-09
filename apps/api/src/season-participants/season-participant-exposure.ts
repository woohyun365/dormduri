import type {
  ProfileExposureLevel,
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
}

export interface PublicExposureDecision {
  exposureLevel: ProfileExposureLevel | 'NONE';
  sourceProfile: ProfileSource;
  relationToViewer: ProfileRelationToViewer;
  actions: PublicProfileActionCapabilities;
}

const NO_PROFILE_ACTIONS: PublicProfileActionCapabilities = {
  canBookmark: false,
  canRequestMatch: false,
  canStartChat: false,
};

export function resolvePublicExposure(
  viewer: PublicExposureViewerInput,
  target: PublicExposureTargetInput,
): PublicExposureDecision {
  if (
    !viewer.campusOperated ||
    viewer.seasonState === null ||
    viewer.seasonState === 'OFF_SEASON'
  ) {
    return {
      exposureLevel: 'LIMITED',
      sourceProfile: 'USER_PROFILE',
      relationToViewer: 'GENERAL',
      actions: NO_PROFILE_ACTIONS,
    };
  }

  if (!target.visible || !target.registered) {
    return {
      exposureLevel: 'NONE',
      sourceProfile: target.hasSeasonProfile ? 'SEASON_PARTICIPANT_PROFILE' : 'USER_PROFILE',
      relationToViewer: 'GENERAL',
      actions: NO_PROFILE_ACTIONS,
    };
  }

  const seasonSource: ProfileSource = target.hasSeasonProfile
    ? 'SEASON_PARTICIPANT_PROFILE'
    : 'USER_PROFILE';
  const matchedPartnerTarget =
    viewer.matchedPartnerParticipantId !== null &&
    target.participantId === viewer.matchedPartnerParticipantId;
  const sameDormitory =
    viewer.hasOperatedAssignedDormitory &&
    target.hasOperatedAssignedDormitory &&
    viewer.dormitoryId !== null &&
    viewer.dormitoryId === target.dormitoryId;
  const viewerCanBookmark =
    viewer.registered &&
    viewer.hasOperatedAssignedDormitory &&
    (viewer.seasonState === 'SEASON_OPEN' ||
      viewer.seasonState === 'SEASON_MATCHING' ||
      viewer.seasonState === 'SEASON_POST_MATCH');
  const viewerCanChatCandidate =
    viewer.registered &&
    !viewer.matched &&
    sameDormitory &&
    !target.matched &&
    (viewer.seasonState === 'SEASON_OPEN' ||
      (viewer.seasonState === 'SEASON_MATCHING' && viewer.currentDormitoryCanMatch));
  const viewerCanRequestMatch =
    viewer.registered &&
    !viewer.matched &&
    sameDormitory &&
    !target.matched &&
    viewer.seasonState === 'SEASON_MATCHING' &&
    viewer.currentDormitoryCanMatch;

  if (
    matchedPartnerTarget &&
    (viewer.seasonState === 'SEASON_MATCHING' || viewer.seasonState === 'SEASON_POST_MATCH')
  ) {
    return {
      exposureLevel: 'FULL',
      sourceProfile: seasonSource,
      relationToViewer: 'MATCHED_PARTNER',
      actions: {
        canBookmark: viewerCanBookmark,
        canRequestMatch: false,
        canStartChat: false,
      },
    };
  }

  if (viewer.seasonState === 'SEASON_POST_MATCH') {
    return {
      exposureLevel: 'LIMITED',
      sourceProfile: seasonSource,
      relationToViewer: 'GENERAL',
      actions: {
        canBookmark: viewerCanBookmark,
        canRequestMatch: false,
        canStartChat: false,
      },
    };
  }

  const fullExposureAllowed = sameDormitory && !viewer.matched && !target.matched;

  return {
    exposureLevel: fullExposureAllowed ? 'FULL' : 'LIMITED',
    sourceProfile: seasonSource,
    relationToViewer: 'GENERAL',
    actions: {
      canBookmark: viewerCanBookmark,
      canRequestMatch: viewerCanRequestMatch,
      canStartChat: viewerCanChatCandidate,
    },
  };
}
