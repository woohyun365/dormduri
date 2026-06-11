import type { Prisma } from '../../../generated/prisma/client.js';

export const MATCH_PARTICIPANT_WITHDRAWAL_PORT = Symbol('MATCH_PARTICIPANT_WITHDRAWAL_PORT');

export interface MatchParticipantWithdrawalInput {
  seasonId: string;
  participantId: string;
  now: Date;
}

export interface MatchParticipantWithdrawalResult {
  canceledPendingMatchRequests: number;
}

export interface MatchParticipantWithdrawalPort {
  /**
   * Cancels pending match requests affected by season participant withdrawal.
   *
   * Season-participants owns the withdrawal transaction, but matches owns match
   * request state transitions. The caller must pass the active transaction
   * client so participant withdrawal, pending request cancellation, chat
   * withdrawal side effects, and lifecycle event recording stay atomic.
   */
  cancelPendingRequestsForWithdrawnParticipant(
    tx: Prisma.TransactionClient,
    input: MatchParticipantWithdrawalInput,
  ): Promise<MatchParticipantWithdrawalResult>;
}
