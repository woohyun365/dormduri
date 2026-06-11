import type { Prisma } from '../../../generated/prisma/client.js';

export const MATCH_BLOCK_SIDE_EFFECT_PORT = Symbol('MATCH_BLOCK_SIDE_EFFECT_PORT');

export interface MatchBlockSideEffectInput {
  seasonId: string;
  blockerUserId: string;
  blockedUserId: string;
  occurredAt: Date;
}

export interface MatchBlockSideEffectResult {
  canceledRequestIds: string[];
}

export interface MatchBlockSideEffectPort {
  /**
   * Cancels pending match requests affected by a user block.
   *
   * Social-safety owns the block transaction, but match owns match request
   * state transitions. Active matches are rejected before this port is called.
   */
  cancelPendingRequestsForBlock(
    tx: Prisma.TransactionClient,
    input: MatchBlockSideEffectInput,
  ): Promise<MatchBlockSideEffectResult>;
}
