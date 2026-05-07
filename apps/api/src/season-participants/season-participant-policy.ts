import type { DormitorySelectionState } from '@repo/shared/dormitory-contract';
import type {
  ProfileExposureLevel,
  ProfileRelationToViewer,
  ProfileSource,
  PublicProfileActionCapabilities,
} from '@repo/shared/profile-contract';
import type { SeasonState } from '@repo/shared/season-contract';
import type { CurrentUserResponse, ParticipationIntent } from '@repo/shared/user-contract';
import type { CurrentSeasonContext } from '../seasons/season.types.js';
import { formatKstDate } from '../seasons/season.utils.js';

export interface ParticipantPolicyRecord {
  participationIntent: ParticipationIntent;
  registeredAt: Date | null;
  declinedAt: Date | null;
  dormitoryId: string | null;
  dormitorySelectionState: DormitorySelectionState;
  participantStatus: 'NOT_STARTED' | 'DRAFT' | 'ACTIVE' | 'MATCHED' | 'WITHDRAWN' | 'EXPIRED';
  hiddenByAdminAt: Date | null;
  deactivatedAt: Date | null;
  profile?: { participantId: string } | null;
}

export interface NormalizedSelectionState {
  dormitoryId: string | null;
  dormitorySelectionState: DormitorySelectionState;
}

export interface CurrentUserCapabilityInput {
  campusOperated: boolean;
  seasonState: SeasonState | null;
  participantRegistered: boolean;
  participantMatched: boolean;
  selectionState: DormitorySelectionState;
  hasOperatedAssignedDormitory: boolean;
  nicknameLockedBySeason: boolean;
  nicknameCooldownActive: boolean;
  hasSelectableDormitories: boolean;
  currentDormitoryCanMatch: boolean;
}

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

export function isParticipantRegistered(participant: ParticipantPolicyRecord | null | undefined) {
  return Boolean(
    participant &&
    participant.participationIntent === 'REGISTERED' &&
    participant.registeredAt &&
    !participant.declinedAt &&
    participant.participantStatus !== 'WITHDRAWN' &&
    participant.participantStatus !== 'EXPIRED',
  );
}

export function hasParticipantProfile(participant: ParticipantPolicyRecord | null | undefined) {
  return Boolean(participant?.profile);
}

export function isVisibleRegisteredParticipant(
  participant: ParticipantPolicyRecord | null | undefined,
) {
  return Boolean(
    isParticipantRegistered(participant) &&
    !participant?.hiddenByAdminAt &&
    !participant?.deactivatedAt,
  );
}

export function normalizeSelectionState(input: {
  registered: boolean;
  dormitorySelectionState: DormitorySelectionState;
  dormitoryId: string | null;
}): NormalizedSelectionState {
  if (input.dormitorySelectionState === 'ASSIGNED' && input.dormitoryId) {
    return {
      dormitorySelectionState: 'ASSIGNED',
      dormitoryId: input.dormitoryId,
    };
  }

  return {
    dormitorySelectionState: input.registered ? 'UNASSIGNED' : input.dormitorySelectionState,
    dormitoryId: null,
  };
}

export function hasOperatedAssignedDormitory(
  operatedDormitoryIds: ReadonlySet<string>,
  selectionState: DormitorySelectionState,
  dormitoryId: string | null,
): boolean {
  return (
    selectionState === 'ASSIGNED' && dormitoryId !== null && operatedDormitoryIds.has(dormitoryId)
  );
}

export function canCurrentDormitoryMatch(
  seasonContext: Pick<CurrentSeasonContext, 'state' | 'operatedDormitories' | 'schedule'> | null,
  dormitoryId: string | null,
  now: Date,
): boolean {
  if (!seasonContext || !dormitoryId || seasonContext.state !== 'SEASON_MATCHING') {
    return false;
  }

  const dormitory = seasonContext.operatedDormitories.find(
    (item) => item.dormitoryId === dormitoryId,
  );
  if (!dormitory) {
    return false;
  }

  const today = formatKstDate(now);
  return today >= seasonContext.schedule.matchingStart && today <= dormitory.roomSelectionDate;
}

export function resolveCurrentUserProfileSource(input: {
  campusOperated: boolean;
  seasonState: SeasonState | null;
  participantRegistered: boolean;
  participantProfileExists: boolean;
}): ProfileSource {
  if (!input.campusOperated) {
    return 'USER_PROFILE';
  }

  if (
    input.participantRegistered &&
    input.participantProfileExists &&
    (input.seasonState === 'SEASON_OPEN' || input.seasonState === 'SEASON_MATCHING')
  ) {
    return 'SEASON_PARTICIPANT_PROFILE';
  }

  return 'USER_PROFILE';
}

export function resolveCurrentUserProfileEditability(
  input: CurrentUserCapabilityInput,
): CurrentUserResponse['capabilities']['profileEdit'] {
  const nicknameEditable = !input.nicknameLockedBySeason && !input.nicknameCooldownActive;

  if (!input.campusOperated || input.seasonState === null || input.seasonState === 'OFF_SEASON') {
    return {
      intro: true,
      messageToRoommate: true,
      additional: true,
      lifestyle: true,
      nickname: nicknameEditable,
    };
  }

  if (input.seasonState === 'SEASON_POST_MATCH') {
    return {
      intro: true,
      messageToRoommate: true,
      additional: true,
      lifestyle: true,
      nickname: nicknameEditable,
    };
  }

  if (!input.participantRegistered) {
    return {
      intro: true,
      messageToRoommate: true,
      additional: true,
      lifestyle: true,
      nickname: nicknameEditable,
    };
  }

  if (input.seasonState === 'SEASON_OPEN') {
    return {
      intro: true,
      messageToRoommate: true,
      additional: true,
      lifestyle: false,
      nickname: false,
    };
  }

  return {
    intro: false,
    messageToRoommate: true,
    additional: true,
    lifestyle: false,
    nickname: false,
  };
}

export function buildCurrentUserCapabilities(
  input: CurrentUserCapabilityInput,
): CurrentUserResponse['capabilities'] {
  const profileEdit = resolveCurrentUserProfileEditability(input);
  const activeSeasonPhase =
    input.seasonState === 'SEASON_OPEN' || input.seasonState === 'SEASON_MATCHING';
  const canBrowseProfiles = true;

  return {
    canBrowseProfiles,
    canRegisterParticipation:
      input.campusOperated && activeSeasonPhase && !input.participantRegistered,
    canSelectDormitory:
      input.campusOperated &&
      input.participantRegistered &&
      input.hasSelectableDormitories &&
      input.selectionState !== 'ASSIGNED' &&
      activeSeasonPhase,
    canEditLifestyle: profileEdit.lifestyle,
    canEditNickname: profileEdit.nickname,
    canEditProfileText:
      profileEdit.intro || profileEdit.messageToRoommate || profileEdit.additional,
    canBookmark:
      input.campusOperated &&
      input.participantRegistered &&
      input.hasSelectableDormitories &&
      input.hasOperatedAssignedDormitory &&
      (input.seasonState === 'SEASON_OPEN' ||
        input.seasonState === 'SEASON_MATCHING' ||
        input.seasonState === 'SEASON_POST_MATCH'),
    canRequestMatch:
      input.campusOperated &&
      input.participantRegistered &&
      !input.participantMatched &&
      input.hasOperatedAssignedDormitory &&
      input.seasonState === 'SEASON_MATCHING' &&
      input.currentDormitoryCanMatch,
    canStartChat:
      input.campusOperated &&
      input.participantRegistered &&
      !input.participantMatched &&
      input.hasOperatedAssignedDormitory &&
      (input.seasonState === 'SEASON_OPEN' ||
        (input.seasonState === 'SEASON_MATCHING' && input.currentDormitoryCanMatch)),
    profileEdit,
  };
}

export function resolvePublicExposure(
  viewer: PublicExposureViewerInput,
  target: PublicExposureTargetInput,
): PublicExposureDecision {
  const noActions: PublicProfileActionCapabilities = {
    canBookmark: false,
    canRequestMatch: false,
    canStartChat: false,
  };

  if (
    !viewer.campusOperated ||
    viewer.seasonState === null ||
    viewer.seasonState === 'OFF_SEASON'
  ) {
    return {
      exposureLevel: 'LIMITED',
      sourceProfile: 'USER_PROFILE',
      relationToViewer: 'GENERAL',
      actions: noActions,
    };
  }

  if (!target.visible || !target.registered) {
    return {
      exposureLevel: 'NONE',
      sourceProfile: target.hasSeasonProfile ? 'SEASON_PARTICIPANT_PROFILE' : 'USER_PROFILE',
      relationToViewer: 'GENERAL',
      actions: noActions,
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
