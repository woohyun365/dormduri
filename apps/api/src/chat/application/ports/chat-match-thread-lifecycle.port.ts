import type { Prisma } from '@repo/database/client';

export const CHAT_MATCH_THREAD_LIFECYCLE_PORT = Symbol('CHAT_MATCH_THREAD_LIFECYCLE_PORT');

export interface ActiveMatchCreatedChatLifecycleInput {
  seasonId: string;
  pairKey: string;
  participantAId: string;
  participantBId: string;
  activeMatchId: string;
  sourceMatchRequestId?: string;
}

export interface ActiveMatchUnmatchedChatLifecycleInput {
  activeMatchId: string;
}

export interface ChatMatchThreadLifecyclePort {
  handleActiveMatchCreated(
    tx: Prisma.TransactionClient,
    input: ActiveMatchCreatedChatLifecycleInput,
    now: Date,
  ): Promise<void>;

  handleActiveMatchUnmatched(
    tx: Prisma.TransactionClient,
    input: ActiveMatchUnmatchedChatLifecycleInput,
    now: Date,
  ): Promise<void>;
}
