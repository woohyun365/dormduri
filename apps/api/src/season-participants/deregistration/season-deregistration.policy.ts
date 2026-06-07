import type { CurrentSeasonContext } from '../../seasons/ports/season-context.port.js';
import { seasonParticipantsErrors } from '../errors/season-participants.errors.js';
import type { CurrentSeasonParticipantRecord } from '../participants/season-participant-records.js';
import { isParticipantRegistered } from '../policies/index.js';

export function assertDeregistrationSeasonContext(
  seasonContext: CurrentSeasonContext | null,
): asserts seasonContext is CurrentSeasonContext {
  if (
    !seasonContext ||
    (seasonContext.state !== 'SEASON_OPEN' && seasonContext.state !== 'SEASON_MATCHING')
  ) {
    throw seasonParticipantsErrors.deregistrationNotAllowed();
  }
}

export function assertParticipantAllowsDeregistration(participant: CurrentSeasonParticipantRecord) {
  if (!isParticipantRegistered(participant)) {
    throw seasonParticipantsErrors.deregistrationNotAllowed();
  }
}

export function assertNoLiveActiveMatch(activeMatch: { id: string } | null) {
  if (activeMatch) {
    throw seasonParticipantsErrors.deregistrationNotAllowed();
  }
}
