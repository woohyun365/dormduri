import type { ActiveMatchSummary, ActiveMatchUnmatchProgress } from '@repo/shared/match-contract';
import { buildDirectionalMatchScoreProjection } from './match-score-projection.js';
import { formatKstDate } from '../platform/time/kst-date.js';
import type { CurrentSeasonContext } from '../seasons/ports/season-context.port.js';
import { parseLifestyleOrNull } from '../profiles/profile.mapper.js';

export type { ActiveMatchCommandRecord, ActiveMatchRecord } from './match-selects.js';
import type { ActiveMatchCommandRecord, ActiveMatchRecord } from './match-selects.js';

export function toActiveMatchSummary(
  activeMatch: ActiveMatchRecord,
  viewerParticipantId: string,
): ActiveMatchSummary {
  const viewerIsParticipantA = activeMatch.participantAId === viewerParticipantId;
  const viewerLifestyle = parseLifestyleOrNull(
    viewerIsParticipantA
      ? (activeMatch.participantA.profile ?? null)
      : (activeMatch.participantB.profile ?? null),
  );
  const counterpartLifestyle = parseLifestyleOrNull(
    viewerIsParticipantA
      ? (activeMatch.participantB.profile ?? null)
      : (activeMatch.participantA.profile ?? null),
  );
  const matchScore = buildDirectionalMatchScoreProjection(viewerLifestyle, counterpartLifestyle);

  return {
    id: activeMatch.id,
    seasonId: activeMatch.seasonId,
    counterpartUserId: viewerIsParticipantA
      ? activeMatch.participantB.userId
      : activeMatch.participantA.userId,
    counterpartParticipantId: viewerIsParticipantA
      ? activeMatch.participantBId
      : activeMatch.participantAId,
    status: activeMatch.status,
    startedAt: activeMatch.startedAt.toISOString(),
    endedAt: activeMatch.endedAt?.toISOString() ?? null,
    endReason: activeMatch.endReason as ActiveMatchSummary['endReason'],
    createdFromRequestId: activeMatch.createdFromRequestId,
    ...(typeof matchScore === 'number' ? { matchScore } : {}),
    unmatchProgress: toInactiveUnmatchProgress(),
  };
}

export function toDetailedActiveMatchSummary(
  activeMatch: ActiveMatchCommandRecord,
  viewerParticipantId: string,
  seasonContext: CurrentSeasonContext,
  now: Date,
): ActiveMatchSummary {
  const base = toActiveMatchSummary(activeMatch, viewerParticipantId);
  const viewerPendingRequest = activeMatch.unmatchRequests.find(
    (request) => request.participantId === viewerParticipantId && request.status === 'PENDING',
  );
  const counterpartPendingRequest = activeMatch.unmatchRequests.find(
    (request) => request.participantId !== viewerParticipantId && request.status === 'PENDING',
  );
  const viewerFulfilledRequest = activeMatch.unmatchRequests.find(
    (request) =>
      request.participantId === viewerParticipantId &&
      request.status === 'FULFILLED_BY_MUTUAL_CONSENT',
  );
  const counterpartFulfilledRequest = activeMatch.unmatchRequests.find(
    (request) =>
      request.participantId !== viewerParticipantId &&
      request.status === 'FULFILLED_BY_MUTUAL_CONSENT',
  );
  const unmatchWindowOpen = isUnmatchWindowOpen(activeMatch, seasonContext, now);
  const progressCount =
    (viewerPendingRequest ? 1 : 0) +
    (counterpartPendingRequest ? 1 : 0) +
    (viewerFulfilledRequest ? 1 : 0) +
    (counterpartFulfilledRequest ? 1 : 0);
  const completedByMutualConsent =
    activeMatch.status === 'UNMATCHED' &&
    activeMatch.endReason === 'UNMATCHED_BY_MUTUAL_CONSENT' &&
    progressCount >= 2;
  const progressState: ActiveMatchUnmatchProgress['state'] = completedByMutualConsent
    ? 'COMPLETED'
    : viewerPendingRequest
      ? 'WAITING_FOR_COUNTERPART'
      : counterpartPendingRequest
        ? 'WAITING_FOR_ME'
        : 'NONE';

  return {
    ...base,
    unmatchProgress: {
      state: progressState,
      requestedByViewerAt:
        (
          viewerPendingRequest?.requestedAt ??
          viewerFulfilledRequest?.requestedAt ??
          null
        )?.toISOString() ?? null,
      requestedByCounterpartAt:
        (
          counterpartPendingRequest?.requestedAt ??
          counterpartFulfilledRequest?.requestedAt ??
          null
        )?.toISOString() ?? null,
      progressCount: Math.min(progressCount, 2),
      requiredCount: 2,
      canRequest: activeMatch.status === 'ACTIVE' && unmatchWindowOpen && !viewerPendingRequest,
      canCancel:
        activeMatch.status === 'ACTIVE' && unmatchWindowOpen && Boolean(viewerPendingRequest),
      availableUntil:
        activeMatch.status === 'ACTIVE'
          ? toUnmatchAvailableUntilIso(activeMatch, seasonContext)
          : null,
    },
  };
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

function toInactiveUnmatchProgress(): ActiveMatchUnmatchProgress {
  return {
    state: 'NONE',
    requestedByViewerAt: null,
    requestedByCounterpartAt: null,
    progressCount: 0,
    requiredCount: 2,
    canRequest: false,
    canCancel: false,
    availableUntil: null,
  };
}

function toUnmatchAvailableUntilIso(
  activeMatch: ActiveMatchCommandRecord,
  seasonContext: CurrentSeasonContext,
) {
  const roomSelectionDate = findActiveMatchRoomSelectionDate(activeMatch, seasonContext);
  return roomSelectionDate ? new Date(`${roomSelectionDate}T23:59:59+09:00`).toISOString() : null;
}
