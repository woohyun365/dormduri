import type { ActiveMatchSummary, ActiveMatchUnmatchProgress } from '@repo/shared/match/contract';
import type { RoommateSearchSummary } from '@repo/shared/roommate-search/contract';
import { buildDirectionalMatchScoreProjection } from '../../scoring/match-score-projection.js';
import type { CurrentSeasonContext } from '../../../seasons/ports/season-context.port.js';
import { parseLifestyleOrNull } from '../../../profiles/contracts/public-profile.presenter.js';
import { resolvePublicCounterpartNickname } from '../../../privacy/deidentification/deidentified-display.policy.js';
import {
  findActiveMatchRoomSelectionDate,
  isUnmatchWindowOpen,
} from '../policies/active-match-unmatch.policy.js';

export {
  findActiveMatchRoomSelectionDate,
  isUnmatchWindowOpen,
} from '../policies/active-match-unmatch.policy.js';
export type {
  ActiveMatchCommandRecord,
  ActiveMatchRecord,
} from '../persistence/active-match.select.js';
import type {
  ActiveMatchCommandRecord,
  ActiveMatchRecord,
} from '../persistence/active-match.select.js';

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
  const matchScoreValue = typeof matchScore === 'number' ? matchScore : undefined;
  const counterpartParticipant = viewerIsParticipantA
    ? activeMatch.participantB
    : activeMatch.participantA;
  const counterpartNickname = resolveActiveMatchCounterpartNickname(counterpartParticipant);

  return {
    id: activeMatch.id,
    seasonId: activeMatch.seasonId,
    counterpartUserId: counterpartParticipant.userId,
    counterpartParticipantId: viewerIsParticipantA
      ? activeMatch.participantBId
      : activeMatch.participantAId,
    counterpartNickname,
    counterpartSummary: toActiveMatchCounterpartSummary(counterpartParticipant, matchScoreValue),
    status: activeMatch.status,
    startedAt: activeMatch.startedAt.toISOString(),
    endedAt: activeMatch.endedAt?.toISOString() ?? null,
    endReason: activeMatch.endReason,
    createdFromRequestId: activeMatch.createdFromRequestId,
    ...(typeof matchScoreValue === 'number' ? { matchScore: matchScoreValue } : {}),
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

type ActiveMatchParticipantRecord =
  | ActiveMatchRecord['participantA']
  | ActiveMatchRecord['participantB']
  | ActiveMatchCommandRecord['participantA']
  | ActiveMatchCommandRecord['participantB'];

function toActiveMatchCounterpartSummary(
  participant: ActiveMatchParticipantRecord,
  matchScore: number | undefined,
): RoommateSearchSummary {
  return {
    id: participant.userId,
    sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
    relation: { type: 'MATCHED_PARTNER' },
    exposure: {
      listSummaryVisible: true,
      detailViewable: true,
      canViewFull: true,
      scoreVisible: typeof matchScore === 'number',
    },
    actions: {
      canBookmark: false,
      canRequestMatch: false,
      canStartChat: true,
      unavailableReasons: ['VIEWER_ALREADY_MATCHED'],
    },
    resultRead: {
      resultReadable: true,
      context: 'CURRENT_MATCHED_PARTNER',
    },
    profileSummary: {
      nickname: resolveActiveMatchCounterpartNickname(participant),
      intro: participant.profile?.intro ?? '',
      smokingBehavior: participant.profile?.smokingBehavior ?? null,
      sleepHabit: participant.profile?.sleepHabit ?? null,
      relationshipStyle: participant.profile?.relationshipStyle ?? null,
    },
    ...(typeof matchScore === 'number' ? { matchScore } : {}),
  };
}

function resolveActiveMatchCounterpartNickname(participant: ActiveMatchParticipantRecord) {
  return resolvePublicCounterpartNickname({
    deletedAt: participant.user?.deletedAt,
    nicknameSnapshot: participant.profile?.nicknameSnapshot,
  });
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
