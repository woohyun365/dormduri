import type {
  DormitorySelectionDraftResponse,
  SelectableDormitoriesResponse,
  SelectableDormitory,
} from '@repo/shared/season-contract';
import type { CurrentSeasonContext } from '../../seasons/season.types.js';
import type { CurrentSeasonParticipantRecord } from '../participants/season-participant-records.js';
import {
  buildCompletionForParticipant,
  buildCompletionForSeasonActionSnapshot,
} from '../capabilities/season-participation-capability.mapper.js';
import { resolveSeasonProfileState } from '../profile-draft/season-profile-draft.mapper.js';

export function buildSelectableDormitoriesResponse(input: {
  seasonContext: CurrentSeasonContext;
  participant: CurrentSeasonParticipantRecord | null;
  items: SelectableDormitory[];
  now: Date;
}): SelectableDormitoriesResponse {
  return {
    seasonId: input.seasonContext.season.id,
    seasonState: input.seasonContext.state,
    profileState: resolveSeasonProfileState(input.participant),
    completion: input.participant
      ? buildCompletionForParticipant(
          input.participant,
          input.seasonContext,
          input.now,
          input.items,
        )
      : buildCompletionForSeasonActionSnapshot({
          seasonContext: input.seasonContext,
          profileComplete: false,
          dormitorySelectionReady: false,
          hasSelectableDormitories: input.items.length > 0,
        }),
    items: input.items,
  };
}

export function buildDormitorySelectionDraftResponse(input: {
  participant: CurrentSeasonParticipantRecord;
  selectedDormitory: SelectableDormitory;
  seasonContext: CurrentSeasonContext;
  now: Date;
}): DormitorySelectionDraftResponse {
  return {
    seasonId: input.participant.seasonId,
    participantId: input.participant.id,
    dormitorySelectionState: 'SELECTED',
    dormitoryId: input.selectedDormitory.id,
    profileState: resolveSeasonProfileState(input.participant),
    completion: buildCompletionForParticipant(input.participant, input.seasonContext, input.now, [
      input.selectedDormitory,
    ]),
  };
}
