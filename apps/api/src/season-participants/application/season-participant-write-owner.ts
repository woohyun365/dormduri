import { createDormitorySelectionOwner } from '../dormitory-selection.owner.js';
import { createSeasonParticipantBackfillOwner } from '../season-participant-backfill.owner.js';
import { createSeasonParticipantContainerOwner } from '../participants/season-participant-container.command.js';
import { createSeasonParticipantDeregistrationOwner } from '../season-participant-deregistration.owner.js';
import type { SeasonParticipantOwnerDeps } from '../season-participant-owner-deps.js';
import { createGetCurrentSeasonProfileQuery } from '../profile-draft/get-current-season-profile.query.js';
import { createUpsertSeasonProfileDraftCommand } from '../profile-draft/upsert-season-profile-draft.command.js';
import {
  assertSeasonProfileCompleteForRegistration,
  validateSeasonProfileCompleteness,
} from '../profile-draft/season-profile-completeness.policy.js';
import { createSeasonRegistrationFinalizeOwner } from '../season-registration-finalize.owner.js';

export function createSeasonParticipantWriteOwner(deps: SeasonParticipantOwnerDeps) {
  const containerOwner = createSeasonParticipantContainerOwner(deps);
  const profileDraftQuery = createGetCurrentSeasonProfileQuery(deps, containerOwner);
  const profileDraftCommand = createUpsertSeasonProfileDraftCommand(deps, containerOwner);
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
    getCurrentSeasonProfile: profileDraftQuery.getCurrentSeasonProfile,
    createOrUpdateSeasonProfileDraft: profileDraftCommand.createOrUpdateSeasonProfileDraft,
    validateSeasonProfileCompleteness,
    assertSeasonProfileCompleteForRegistration,
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
