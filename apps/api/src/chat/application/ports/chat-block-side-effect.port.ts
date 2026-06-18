import type { Prisma } from '../../../generated/prisma/client.js';

export const CHAT_BLOCK_SIDE_EFFECT_PORT = Symbol('CHAT_BLOCK_SIDE_EFFECT_PORT');

export interface ChatBlockSideEffectInput {
  seasonId: string;
  blockerUserId: string;
  blockedUserId: string;
  sourceBlockId?: string;
  occurredAt: Date;
}

export interface ChatBlockSideEffectResult {
  closedThreadIds: string[];
}

export interface ChatBlockSideEffectPort {
  /**
   * Closes currently open, non-matched direct threads affected by a user block.
   *
   * The caller owns the social-safety block transaction. Chat owns thread
   * lifecycle mutation and realtime outbox append. Unblock must not call an
   * eager reopen method; explicit chat resume/send paths own lazy reopen.
   */
  closeDirectThreadsForBlock(
    tx: Prisma.TransactionClient,
    input: ChatBlockSideEffectInput,
  ): Promise<ChatBlockSideEffectResult>;
}
