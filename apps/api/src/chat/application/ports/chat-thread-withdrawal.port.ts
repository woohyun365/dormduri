import type { Prisma } from '../../../generated/prisma/client.js';

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
