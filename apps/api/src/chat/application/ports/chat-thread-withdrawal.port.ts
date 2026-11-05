import type { Prisma } from '@repo/database/client';

export const CHAT_THREAD_WITHDRAWAL_PORT = Symbol('CHAT_THREAD_WITHDRAWAL_PORT');

export interface ChatThreadWithdrawalResult {
  updatedThreadIds: string[];
}

export interface ChatThreadWithdrawalPort {
  markOpenDirectThreadsReadOnlyForWithdrawnParticipant(
    tx: Prisma.TransactionClient,
    input: {
      seasonId: string;
      participantId: string;
      now: Date;
    },
  ): Promise<ChatThreadWithdrawalResult>;
}
