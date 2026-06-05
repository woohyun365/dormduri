import { createBackfillCurrentSeasonParticipantsCommand } from '../lifecycle/backfill-current-season-participants.command.js';
import { createSeasonParticipantContainerOwner } from '../participants/season-participant-container.command.js';
import { createDormitorySelectionReadinessEvaluator } from '../dormitory-selection/dormitory-selection-readiness.evaluator.js';
import { createListCurrentSeasonSelectableDormitoriesQuery } from '../dormitory-selection/list-current-season-selectable-dormitories.query.js';
import { createUpdateDormitorySelectionCommand } from '../dormitory-selection/update-dormitory-selection.command.js';
import { createDeregisterSeasonParticipantCommand } from '../deregistration/deregister-season-participant.command.js';
import type { SeasonParticipantUseCaseDeps } from './season-participant-use-case.deps.js';
import { createGetCurrentSeasonProfileQuery } from '../profile-draft/get-current-season-profile.query.js';
import { createUpsertSeasonProfileDraftCommand } from '../profile-draft/upsert-season-profile-draft.command.js';
import {
  assertSeasonProfileCompleteForRegistration,
  validateSeasonProfileCompleteness,
} from '../profile-draft/season-profile-completeness.policy.js';
import { createFinalizeSeasonRegistrationCommand } from '../registration/finalize-season-registration.command.js';
import { createSeasonRegistrationReadinessEvaluator } from '../registration/season-registration-readiness.evaluator.js';
import { createSeasonParticipantLifecycleEventWriter } from '../lifecycle/season-participant-lifecycle-event.writer.js';

export function createSeasonParticipantWriteOwner(deps: SeasonParticipantUseCaseDeps) {
  const containerOwner = createSeasonParticipantContainerOwner(deps);
  const lifecycleEventWriter = createSeasonParticipantLifecycleEventWriter();
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
  const registrationReadiness = createSeasonRegistrationReadinessEvaluator(
    dormitorySelectionReadiness,
  );
  const registrationFinalizeCommand = createFinalizeSeasonRegistrationCommand(
    deps,
    containerOwner,
    registrationReadiness,
    lifecycleEventWriter,
  );
  const backfillOwner = createBackfillCurrentSeasonParticipantsCommand(deps, lifecycleEventWriter);
  const deregistrationCommand = createDeregisterSeasonParticipantCommand(
    deps,
    lifecycleEventWriter,
  );

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
    finalizeSeasonRegistration: registrationFinalizeCommand.finalizeSeasonRegistration,
    backfillCurrentSeasonParticipants: backfillOwner.backfillCurrentSeasonParticipants,
    deregisterCurrentSeasonParticipation:
      deregistrationCommand.deregisterCurrentSeasonParticipation,
  };
}

export type SeasonParticipantWriteOwner = ReturnType<typeof createSeasonParticipantWriteOwner>;
