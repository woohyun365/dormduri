import type { AuthenticatedRequest } from '../auth/authenticated-user.guard.js';
import type { CurrentSeasonParticipantRecord } from './season-participants.service.js';

export interface CurrentSeasonParticipantDomainContexts {
  currentSeasonParticipant?: CurrentSeasonParticipantRecord;
}

export interface CurrentSeasonParticipantContextRequest extends AuthenticatedRequest {
  domainContexts?: CurrentSeasonParticipantDomainContexts;
}

export function setCurrentSeasonParticipantContext(
  request: CurrentSeasonParticipantContextRequest,
  participant: CurrentSeasonParticipantRecord,
) {
  request.domainContexts ??= {};
  request.domainContexts.currentSeasonParticipant = participant;
}

export function getCurrentSeasonParticipantContext(
  request: CurrentSeasonParticipantContextRequest,
) {
  return request.domainContexts?.currentSeasonParticipant ?? null;
}
