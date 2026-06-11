export interface MatchRequestCreationParticipantPolicyInput {
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

export interface MatchRequestCreationActionPolicyInput {
  requesterCanRequestMatch: boolean;
  targetCanRequestMatch: boolean;
}

export interface PreparedMatchRequestParticipantPolicyInput {
  requesterReady: boolean;
  receiverReady: boolean;
  requesterDormitoryId: string | null;
  receiverDormitoryId: string | null;
  operationOperated: boolean;
  roomSelectionOpen: boolean;
  registrationSnapshotCount: number;
}

export function isMatchRequestCreationParticipantReady(
  participant: MatchRequestCreationParticipantPolicyInput,
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

export function canStartMatchRequestCreation(input: MatchRequestCreationActionPolicyInput) {
  return input.requesterCanRequestMatch && input.targetCanRequestMatch;
}

export function canPersistPreparedMatchRequest(input: PreparedMatchRequestParticipantPolicyInput) {
  return (
    input.requesterReady &&
    input.receiverReady &&
    input.requesterDormitoryId !== null &&
    input.requesterDormitoryId === input.receiverDormitoryId &&
    input.operationOperated &&
    input.roomSelectionOpen &&
    input.registrationSnapshotCount === 2
  );
}
