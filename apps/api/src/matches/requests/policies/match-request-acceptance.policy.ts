export interface MatchRequestAcceptanceParticipantPolicyInput {
  participationIntent: 'UNDECIDED' | 'REGISTERED' | 'DECLINED';
  registeredAt: Date | null;
  dormitoryId: string | null;
  dormitorySelectionState: 'NOT_SELECTED' | 'SELECTED' | 'UNASSIGNED' | 'ASSIGNED';
  participantStatus: 'NOT_STARTED' | 'DRAFT' | 'ACTIVE' | 'MATCHED' | 'WITHDRAWN' | 'EXPIRED';
  declinedAt: Date | null;
  withdrawnAt: Date | null;
  hiddenByAdminAt: Date | null;
  deactivatedAt: Date | null;
  userDeletedAt: Date | null;
  seasonProfileComplete: boolean;
}

export interface MatchRequestAcceptancePreconditionInput {
  requester: MatchRequestAcceptanceParticipantPolicyInput;
  receiver: MatchRequestAcceptanceParticipantPolicyInput;
  sameDormitory: boolean;
  seasonMatching: boolean;
  roomSelectionOpen: boolean;
  registrationSnapshotCount: number;
}

export type MatchRequestAcceptancePreconditionResult =
  | { kind: 'ACCEPTABLE' }
  | { kind: 'TERMINAL'; terminalReason: 'WITHDRAWN_PARTICIPANT' | 'MATCH_PRECONDITION_FAILED' };

export function isWithdrawnMatchRequestParticipant(
  participant: MatchRequestAcceptanceParticipantPolicyInput,
) {
  return (
    participant.participationIntent === 'DECLINED' ||
    participant.participantStatus === 'WITHDRAWN' ||
    participant.withdrawnAt !== null ||
    participant.declinedAt !== null
  );
}

export function isRegistrationCompleteMatchRequestParticipant(
  participant: MatchRequestAcceptanceParticipantPolicyInput,
) {
  return (
    participant.participationIntent === 'REGISTERED' &&
    participant.registeredAt !== null &&
    participant.dormitorySelectionState === 'ASSIGNED' &&
    participant.dormitoryId !== null &&
    participant.declinedAt === null &&
    participant.withdrawnAt === null &&
    participant.participantStatus !== 'WITHDRAWN' &&
    participant.participantStatus !== 'EXPIRED' &&
    participant.hiddenByAdminAt === null &&
    participant.deactivatedAt === null &&
    participant.userDeletedAt === null &&
    participant.seasonProfileComplete
  );
}

export function resolveMatchRequestAcceptancePrecondition(
  input: MatchRequestAcceptancePreconditionInput,
): MatchRequestAcceptancePreconditionResult {
  if (
    isWithdrawnMatchRequestParticipant(input.requester) ||
    isWithdrawnMatchRequestParticipant(input.receiver)
  ) {
    return { kind: 'TERMINAL', terminalReason: 'WITHDRAWN_PARTICIPANT' };
  }

  if (
    !isRegistrationCompleteMatchRequestParticipant(input.requester) ||
    !isRegistrationCompleteMatchRequestParticipant(input.receiver) ||
    !input.sameDormitory ||
    !input.seasonMatching ||
    !input.roomSelectionOpen ||
    input.registrationSnapshotCount !== 2
  ) {
    return { kind: 'TERMINAL', terminalReason: 'MATCH_PRECONDITION_FAILED' };
  }

  return { kind: 'ACCEPTABLE' };
}
