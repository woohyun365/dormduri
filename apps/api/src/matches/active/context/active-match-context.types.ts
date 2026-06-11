import type { AuthenticatedRequest } from '../../../auth/application/auth-actor-context.types.js';
import type { ActiveMatchStatus } from '../../../generated/prisma/enums.js';

export interface ActiveMatchContext {
  activeMatchId: string;
  actorUserId: string;
  actorParticipantId: string;
  counterpartParticipantId: string;
  status: ActiveMatchStatus;
  endedAt: Date | null;
}

export interface ActiveMatchDomainContexts {
  activeMatch?: ActiveMatchContext;
}

export interface ActiveMatchContextRequest extends AuthenticatedRequest {
  domainContexts?: ActiveMatchDomainContexts;
}

export function setActiveMatchContext(
  request: ActiveMatchContextRequest,
  activeMatch: ActiveMatchContext,
) {
  request.domainContexts ??= {};
  request.domainContexts.activeMatch = activeMatch;
}

export function getActiveMatchContext(request: ActiveMatchContextRequest) {
  return request.domainContexts?.activeMatch ?? null;
}
