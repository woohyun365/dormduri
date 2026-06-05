import {
  isParticipantRegistered,
  normalizeSelectionState,
  type ParticipantPolicyRecord,
} from '../policies/index.js';
import type {
  CanonicalSelectionState,
  CurrentSeasonParticipantRecord,
} from './season-participant-records.js';

export function createSeasonParticipantSourceOwner() {
  return {
    selectCanonicalSelection(
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
          dormitoryId: null,
          dormitorySelectionState: 'NOT_SELECTED',
          source: 'SEASON_PARTICIPANT',
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

    pickCurrentSeasonParticipant(
      participants: CurrentSeasonParticipantRecord[] | null | undefined,
    ): CurrentSeasonParticipantRecord | null {
      return participants?.[0] ?? null;
    },
  };
}

export type SeasonParticipantSourceOwner = ReturnType<typeof createSeasonParticipantSourceOwner>;
