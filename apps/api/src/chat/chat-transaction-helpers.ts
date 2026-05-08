import type { Prisma } from '../generated/prisma/client.js';
import { acquireTransactionAdvisoryLock } from '../generated/prisma/sql.js';

export async function acquireConversationThreadPairLock(
  tx: Prisma.TransactionClient,
  seasonId: string,
  pairKey: string,
) {
  await tx.$queryRawTyped(
    acquireTransactionAdvisoryLock('conversation_thread_pair', `${seasonId}:${pairKey}`),
  );
}

export async function acquireConversationThreadLeaveLock(
  tx: Prisma.TransactionClient,
  threadId: string,
) {
  await tx.$queryRawTyped(acquireTransactionAdvisoryLock('conversation_thread_leave', threadId));
}
