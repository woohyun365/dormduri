import { createDormitorySelectionOwner } from './dormitory-selection.owner.js';
import { createSeasonParticipantBackfillOwner } from './season-participant-backfill.owner.js';
import { createSeasonParticipantContainerOwner } from './season-participant-container.owner.js';
import { createSeasonParticipantDeregistrationOwner } from './season-participant-deregistration.owner.js';
import type { SeasonParticipantOwnerDeps } from './season-participant-owner-deps.js';
import { createSeasonProfileDraftOwner } from './season-profile-draft.owner.js';
import { createSeasonRegistrationFinalizeOwner } from './season-registration-finalize.owner.js';

export function createSeasonParticipantWriteOwner(deps: SeasonParticipantOwnerDeps) {
  const containerOwner = createSeasonParticipantContainerOwner(deps);
  const profileDraftOwner = createSeasonProfileDraftOwner(deps, containerOwner);
  const dormitorySelectionOwner = createDormitorySelectionOwner(deps, containerOwner);
  const registrationFinalizeOwner = createSeasonRegistrationFinalizeOwner(
    deps,
    containerOwner,
    dormitorySelectionOwner,
  );
  const backfillOwner = createSeasonParticipantBackfillOwner(deps);
  const deregistrationOwner = createSeasonParticipantDeregistrationOwner(deps);

  return {
    ensureCurrentSeasonParticipant: containerOwner.ensureCurrentSeasonParticipant,
    findCurrentSeasonParticipant: containerOwner.findCurrentSeasonParticipant,
    getCurrentSeasonProfile: profileDraftOwner.getCurrentSeasonProfile,
    createOrUpdateSeasonProfileDraft: profileDraftOwner.createOrUpdateSeasonProfileDraft,
    validateSeasonProfileCompleteness: profileDraftOwner.validateSeasonProfileCompleteness,
    assertSeasonProfileCompleteForRegistration:
      profileDraftOwner.assertSeasonProfileCompleteForRegistration,
    listSelectableDormitoriesForCurrentSeason:
      dormitorySelectionOwner.listSelectableDormitoriesForCurrentSeason,
    hasSelectableDormitoriesForCurrentParticipant:
      dormitorySelectionOwner.hasSelectableDormitoriesForCurrentParticipant,
    hasSelectableDormitoriesForCurrentUser:
      dormitorySelectionOwner.hasSelectableDormitoriesForCurrentUser,
    hasValidDormitorySelectionForCurrentParticipant:
      dormitorySelectionOwner.hasValidDormitorySelectionForCurrentParticipant,
    createOrUpdateDormitorySelection: dormitorySelectionOwner.createOrUpdateDormitorySelection,
    finalizeSeasonRegistration: registrationFinalizeOwner.finalizeSeasonRegistration,
    backfillCurrentSeasonParticipants: backfillOwner.backfillCurrentSeasonParticipants,
    deregisterCurrentSeasonParticipation: deregistrationOwner.deregisterCurrentSeasonParticipation,
  };
}

export type SeasonParticipantWriteOwner = ReturnType<typeof createSeasonParticipantWriteOwner>;
