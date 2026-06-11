import type { Prisma } from '../../generated/prisma/client.js';
import { buildChatIdentityLinkReviewPayload } from './retention-review-job.payload.js';

export async function scheduleChatIdentityLinkReviewJobTx(
  tx: Prisma.TransactionClient,
  input: {
    threadId: string;
    dueAt: Date;
    archiveJobId: string;
    retainedIdentityId?: string | null;
    userId?: string | null;
  },
) {
  await tx.retentionReviewJob.upsert({
    where: {
      target_sourceId: {
        target: 'CHAT_IDENTITY_LINK',
        sourceId: input.threadId,
      },
    },
    update: {
      status: 'PENDING',
      dueAt: input.dueAt,
      lastErrorCode: null,
      manualReviewRequired: false,
      payload: buildChatIdentityLinkReviewPayload(input) as Prisma.InputJsonValue,
    },
    create: {
      target: 'CHAT_IDENTITY_LINK',
      sourceId: input.threadId,
      dueAt: input.dueAt,
      payload: buildChatIdentityLinkReviewPayload(input) as Prisma.InputJsonValue,
    },
  });
}
