import type { CurrentSeasonContext } from '../../../seasons/ports/season-context.port.js';
import { formatKstDate } from '../../../platform/time/kst-date.js';
import type { ActiveMatchCommandRecord } from '../persistence/active-match.select.js';

export function assertUnmatchActorAllowed(
  activeMatch: ActiveMatchCommandRecord,
  participantId: string,
  errorFactory: () => Error,
) {
  if (!canParticipantActOnActiveMatch(activeMatch, participantId)) {
    throw errorFactory();
  }
}

export function canParticipantActOnActiveMatch(
  activeMatch: ActiveMatchCommandRecord,
  participantId: string,
) {
  return (
    activeMatch.status === 'ACTIVE' &&
    activeMatch.endedAt === null &&
    (activeMatch.participantAId === participantId || activeMatch.participantBId === participantId)
  );
}

export function assertCurrentSeasonActiveMatch(
  activeMatch: ActiveMatchCommandRecord,
  currentSeasonId: string,
  errorFactory: () => Error,
) {
  if (activeMatch.seasonId !== currentSeasonId) {
    throw errorFactory();
  }
}

export function assertUnmatchWindowOpen(
  activeMatch: ActiveMatchCommandRecord,
  seasonContext: CurrentSeasonContext,
  now: Date,
  errorFactory: () => Error,
) {
  if (!isUnmatchWindowOpen(activeMatch, seasonContext, now)) {
    throw errorFactory();
  }
}

export function findActiveMatchRoomSelectionDate(
  activeMatch: ActiveMatchCommandRecord,
  seasonContext: CurrentSeasonContext,
) {
  if (
    activeMatch.participantA.dormitorySelectionState !== 'ASSIGNED' ||
    activeMatch.participantB.dormitorySelectionState !== 'ASSIGNED' ||
    !activeMatch.participantA.dormitoryId ||
    !activeMatch.participantB.dormitoryId ||
    activeMatch.participantA.dormitoryId !== activeMatch.participantB.dormitoryId
  ) {
    return null;
  }

  return (
    seasonContext.operatedDormitories.find(
      (item) => item.dormitoryId === activeMatch.participantA.dormitoryId,
    )?.roomSelectionDate ?? null
  );
}

export function isUnmatchWindowOpen(
  activeMatch: ActiveMatchCommandRecord,
  seasonContext: CurrentSeasonContext,
  now: Date,
) {
  const roomSelectionDate = findActiveMatchRoomSelectionDate(activeMatch, seasonContext);
  if (!roomSelectionDate || seasonContext.state !== 'SEASON_MATCHING') {
    return false;
  }

  return formatKstDate(now) <= roomSelectionDate;
}

export function findViewerPendingUnmatchRequest(
  activeMatch: ActiveMatchCommandRecord,
  participantId: string,
) {
  return activeMatch.unmatchRequests.find(
    (request) => request.participantId === participantId && request.status === 'PENDING',
  );
}

export function countPendingUnmatchRequests(activeMatch: ActiveMatchCommandRecord) {
  return activeMatch.unmatchRequests.filter((request) => request.status === 'PENDING').length;
}
