import type { ProfileSource } from '@repo/shared/profile-contract';
import {
  isParticipantRegistered,
  normalizeSelectionState,
  type ParticipantPolicyRecord,
} from './season-participant-policy.js';
import type {
  CanonicalProfileSource,
  CanonicalSelectionState,
  CurrentSeasonParticipantProfileRecord,
  CurrentSeasonParticipantRecord,
  ParticipantBackfillSeed,
  UserProfileRecord,
} from './season-participant-records.js';

export function createSeasonParticipantSourceOwner() {
  return {
    selectCanonicalSelection(
      user: Pick<ParticipantBackfillSeed, 'dormitoryId' | 'dormitorySelectionState'>,
      participant: Pick<
        CurrentSeasonParticipantRecord,
        | 'dormitoryId'
        | 'dormitorySelectionState'
        | 'participationIntent'
        | 'registeredAt'
        | 'declinedAt'
        | 'participantStatus'
      > | null,
    ): CanonicalSelectionState {
      if (!participant) {
        return {
          dormitoryId: user.dormitoryId,
          dormitorySelectionState: user.dormitorySelectionState,
          source: 'USER',
        };
      }

      const selection = normalizeSelectionState({
        registered: isParticipantRegistered(participant as ParticipantPolicyRecord),
        dormitorySelectionState: participant.dormitorySelectionState,
        dormitoryId: participant.dormitoryId,
      });

      return {
        dormitoryId: selection.dormitoryId,
        dormitorySelectionState: selection.dormitorySelectionState,
        source: 'SEASON_PARTICIPANT',
      };
    },

    selectCanonicalProfile(
      baseProfile: UserProfileRecord,
      participantProfile: CurrentSeasonParticipantProfileRecord | null,
    ): CanonicalProfileSource {
      return this.selectProfileBySource(
        baseProfile,
        participantProfile,
        participantProfile ? 'SEASON_PARTICIPANT_PROFILE' : 'USER_PROFILE',
      );
    },

    selectProfileBySource(
      baseProfile: UserProfileRecord,
      participantProfile: CurrentSeasonParticipantProfileRecord | null,
      source: ProfileSource,
    ): CanonicalProfileSource {
      if (source === 'SEASON_PARTICIPANT_PROFILE' && participantProfile) {
        return {
          source,
          nickname: participantProfile.nicknameSnapshot,
          nicknameNormalized: participantProfile.nicknameNormalizedSnapshot,
          lifestyle: participantProfile.lifestyle,
          intro: participantProfile.intro,
          messageToRoommate: participantProfile.messageToRoommate,
          collegeCode: participantProfile.collegeCode,
          grade: participantProfile.grade,
          mbti: participantProfile.mbti,
          birthYear: participantProfile.birthYear,
        };
      }

      return {
        source: 'USER_PROFILE',
        nickname: baseProfile.nickname,
        nicknameNormalized: baseProfile.nicknameNormalized,
        lifestyle: baseProfile.lifestyle,
        intro: baseProfile.intro,
        messageToRoommate: baseProfile.messageToRoommate,
        collegeCode: baseProfile.collegeCode,
        grade: baseProfile.grade,
        mbti: baseProfile.mbti,
        birthYear: baseProfile.birthYear,
      };
    },

    pickCurrentSeasonParticipant(
      participants: CurrentSeasonParticipantRecord[] | null | undefined,
    ): CurrentSeasonParticipantRecord | null {
      return participants?.[0] ?? null;
    },
  };
}
