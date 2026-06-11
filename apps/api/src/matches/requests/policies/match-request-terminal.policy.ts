export type TerminalMatchRequestStatus = 'REJECTED' | 'CANCELLED_BY_REQUESTER';
export type TerminalMatchRequestReason = 'REJECTED_BY_RECEIVER' | 'CANCELLED_BY_REQUESTER';

export function canActorResolveTerminalMatchRequest(input: {
  status: TerminalMatchRequestStatus;
  requesterParticipantId: string;
  receiverParticipantId: string;
  actingParticipantId: string;
}) {
  if (input.status === 'REJECTED') {
    return input.receiverParticipantId === input.actingParticipantId;
  }

  return input.requesterParticipantId === input.actingParticipantId;
}
