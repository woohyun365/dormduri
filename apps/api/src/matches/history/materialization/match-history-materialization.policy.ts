import { formatKstDate, subtractDays } from '../../../platform/time/kst-date.js';

type RequestResultSource = {
  status:
    | 'PENDING'
    | 'ACCEPTED'
    | 'REJECTED'
    | 'CANCELLED_BY_REQUESTER'
    | 'CANCELLED_BY_SYSTEM'
    | 'EXPIRED';
  terminalReason:
    | 'ACCEPTED'
    | 'REJECTED_BY_RECEIVER'
    | 'CANCELLED_BY_REQUESTER'
    | 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH'
    | 'EXPIRED'
    | 'WITHDRAWN_PARTICIPANT'
    | 'MATCH_PRECONDITION_FAILED'
    | 'ADMIN_ACTION'
    | null;
};

type SystemCancellationSource = Pick<RequestResultSource, 'terminalReason'> & {
  systemCancellationActiveMatchId: string | null;
  systemCancellationActiveMatch: {
    participantAId: string;
    participantBId: string;
  } | null;
};

export function toRequestEntryResult(
  status: RequestResultSource['status'],
  terminalReason: RequestResultSource['terminalReason'],
): 'REQUEST_REJECTED' | 'REQUEST_CANCELLED' | 'REQUEST_EXPIRED' {
  if (status === 'REJECTED' || terminalReason === 'REJECTED_BY_RECEIVER') {
    return 'REQUEST_REJECTED';
  }

  if (status === 'EXPIRED' || terminalReason === 'EXPIRED') {
    return 'REQUEST_EXPIRED';
  }

  return 'REQUEST_CANCELLED';
}

export function toSeasonEndBoundary(seasonEndDate: Date, now: Date) {
  const seasonEnd = formatKstDate(seasonEndDate);
  const boundary = new Date(`${subtractDays(seasonEnd, -1)}T00:00:00+09:00`);
  return boundary.getTime() <= now.getTime() ? boundary : now;
}

export function resolveHistorySystemCancellation(input: {
  request: SystemCancellationSource;
  viewerParticipantId: string;
  counterpartParticipantId: string;
}): {
  systemCancellationCause: 'VIEWER_MATCHED' | 'COUNTERPART_MATCHED' | null;
  systemCancellationGroupId: string | null;
} {
  const { request, viewerParticipantId, counterpartParticipantId } = input;
  if (
    request.terminalReason !== 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH' ||
    !request.systemCancellationActiveMatchId ||
    !request.systemCancellationActiveMatch
  ) {
    return { systemCancellationCause: null, systemCancellationGroupId: null };
  }

  const participants = new Set([
    request.systemCancellationActiveMatch.participantAId,
    request.systemCancellationActiveMatch.participantBId,
  ]);
  const systemCancellationCause = participants.has(viewerParticipantId)
    ? 'VIEWER_MATCHED'
    : participants.has(counterpartParticipantId)
      ? 'COUNTERPART_MATCHED'
      : null;

  return {
    systemCancellationCause,
    systemCancellationGroupId: systemCancellationCause
      ? request.systemCancellationActiveMatchId
      : null,
  };
}
