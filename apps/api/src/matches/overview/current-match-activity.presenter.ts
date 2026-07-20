import type { CurrentMatchActivityEntry } from '@repo/shared/match/contract';
import { resolvePublicCounterpartNickname } from '../../privacy/deidentification/deidentified-display.policy.js';
import {
  resolveHistorySystemCancellation,
  toRequestEntryResult,
} from '../history/materialization/match-history-materialization.policy.js';
import type {
  CurrentActivityActiveMatchRecord,
  MatchOverviewRequestRecord,
} from './current-match-activity.select.js';

export function toCurrentMatchActivity(input: {
  readonly viewerParticipantId: string;
  readonly requests: readonly MatchOverviewRequestRecord[];
  readonly activeMatches: readonly CurrentActivityActiveMatchRecord[];
}): CurrentMatchActivityEntry[] {
  const requestEntries = input.requests.flatMap((request) => {
    if (request.status === 'PENDING' || request.status === 'ACCEPTED') return [];
    const viewerRequested = request.requesterParticipantId === input.viewerParticipantId;
    const counterpart = viewerRequested
      ? request.receiverParticipant
      : request.requesterParticipant;
    const cancellation = resolveHistorySystemCancellation({
      request,
      viewerParticipantId: input.viewerParticipantId,
      counterpartParticipantId: viewerRequested
        ? request.receiverParticipantId
        : request.requesterParticipantId,
    });

    return [
      {
        id: `request:${request.id}`,
        counterpartParticipantId: viewerRequested
          ? request.receiverParticipantId
          : request.requesterParticipantId,
        counterpartNickname: publicNickname(counterpart),
        stage: viewerRequested ? 'SENT_REQUEST' : 'RECEIVED_REQUEST',
        result: toRequestEntryResult(request.status, request.terminalReason),
        direction: viewerRequested ? 'SENT' : 'RECEIVED',
        occurredAt: (request.terminalAt ?? request.acceptedAt ?? request.createdAt).toISOString(),
        requestTerminalReason: request.terminalReason,
        ...cancellation,
        activeMatchEndReason: null,
      } satisfies CurrentMatchActivityEntry,
    ];
  });

  const matchEntries = input.activeMatches.map((activeMatch) => {
    const viewerIsParticipantA = activeMatch.participantAId === input.viewerParticipantId;
    const counterpart = viewerIsParticipantA ? activeMatch.participantB : activeMatch.participantA;
    const counterpartParticipantId = viewerIsParticipantA
      ? activeMatch.participantBId
      : activeMatch.participantAId;
    const viewerRequested =
      activeMatch.createdFromRequest.requesterParticipantId === input.viewerParticipantId;
    const matchedSuccess =
      activeMatch.status === 'ACTIVE' ||
      activeMatch.status === 'SEASON_ENDED' ||
      activeMatch.endReason === 'SEASON_ENDED';

    return {
      id: `match:${activeMatch.id}`,
      counterpartParticipantId,
      counterpartNickname: publicNickname(counterpart),
      stage: 'MATCH',
      result: matchedSuccess ? 'MATCHED_SUCCESS' : 'UNMATCHED_AFTER_SUCCESS',
      direction: viewerRequested ? 'SENT' : 'RECEIVED',
      occurredAt: (matchedSuccess
        ? activeMatch.startedAt
        : (activeMatch.endedAt ?? activeMatch.startedAt)
      ).toISOString(),
      requestTerminalReason: 'ACCEPTED',
      systemCancellationCause: null,
      systemCancellationGroupId: null,
      activeMatchEndReason: matchedSuccess ? null : activeMatch.endReason,
    } satisfies CurrentMatchActivityEntry;
  });

  return [...requestEntries, ...matchEntries].toSorted((left, right) => {
    const timeDifference =
      new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime();
    if (timeDifference !== 0) return timeDifference;
    const stageDifference = activityStagePriority(left.stage) - activityStagePriority(right.stage);
    return stageDifference !== 0 ? stageDifference : left.id.localeCompare(right.id);
  });
}

function publicNickname(
  participant:
    | MatchOverviewRequestRecord['requesterParticipant']
    | CurrentActivityActiveMatchRecord['participantA'],
) {
  return resolvePublicCounterpartNickname({
    deletedAt: participant.user?.deletedAt,
    nicknameSnapshot: participant.profile?.nicknameSnapshot,
  });
}

function activityStagePriority(stage: CurrentMatchActivityEntry['stage']) {
  return stage === 'MATCH' ? 0 : 1;
}
