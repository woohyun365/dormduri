import { createSeasonParticipantBackfillOwner } from '../season-participant-backfill.owner.js';
import { createSeasonParticipantContainerOwner } from '../participants/season-participant-container.command.js';
import { createDormitorySelectionReadinessEvaluator } from '../dormitory-selection/dormitory-selection-readiness.evaluator.js';
import { createListCurrentSeasonSelectableDormitoriesQuery } from '../dormitory-selection/list-current-season-selectable-dormitories.query.js';
import { createUpdateDormitorySelectionCommand } from '../dormitory-selection/update-dormitory-selection.command.js';
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
  const dormitorySelectionReadiness = createDormitorySelectionReadinessEvaluator(deps);
  const dormitorySelectionQuery = createListCurrentSeasonSelectableDormitoriesQuery(
    deps,
    containerOwner,
    dormitorySelectionReadiness,
  );
  const dormitorySelectionCommand = createUpdateDormitorySelectionCommand(
    deps,
    containerOwner,
    dormitorySelectionReadiness,
  );
  const registrationFinalizeOwner = createSeasonRegistrationFinalizeOwner(
    deps,
    containerOwner,
    dormitorySelectionReadiness,
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
      dormitorySelectionQuery.listSelectableDormitoriesForCurrentSeason,
    hasSelectableDormitoriesForCurrentParticipant:
      dormitorySelectionReadiness.hasSelectableDormitoriesForCurrentParticipant,
    hasSelectableDormitoriesForCurrentUser:
      dormitorySelectionReadiness.hasSelectableDormitoriesForCurrentUser,
    hasValidDormitorySelectionForCurrentParticipant:
      dormitorySelectionReadiness.hasValidDormitorySelectionForCurrentParticipant,
    createOrUpdateDormitorySelection: dormitorySelectionCommand.createOrUpdateDormitorySelection,
    finalizeSeasonRegistration: registrationFinalizeOwner.finalizeSeasonRegistration,
    backfillCurrentSeasonParticipants: backfillOwner.backfillCurrentSeasonParticipants,
    deregisterCurrentSeasonParticipation: deregistrationOwner.deregisterCurrentSeasonParticipation,
  };
}

export type SeasonParticipantWriteOwner = ReturnType<typeof createSeasonParticipantWriteOwner>;
