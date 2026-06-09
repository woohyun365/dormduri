import { Prisma } from '../../generated/prisma/client.js';
import type { RetentionAccessLogDisposalResult } from './retention-access-log.types.js';

export async function disposeDueRetentionAccessLogs(
  prisma: Pick<Prisma.TransactionClient, 'retentionAccessLog'>,
  now: Date,
): Promise<RetentionAccessLogDisposalResult> {
  const result = await prisma.retentionAccessLog.updateMany({
    where: {
      logRetentionDisposedAt: null,
      logRetentionHoldUntil: { not: null, lte: now },
    },
    data: {
      accessedBy: null,
      approvalReference: null,
      purpose: null,
      disclosedFields: Prisma.JsonNull,
      logRetentionDisposedAt: now,
      logRetentionDisposalReason: 'RETENTION_ACCESS_LOG_METADATA_MINIMIZED',
    },
  });

  const nextDueLog = await prisma.retentionAccessLog.findFirst({
    where: {
      logRetentionDisposedAt: null,
      logRetentionHoldUntil: { not: null, gt: now },
    },
    select: { logRetentionHoldUntil: true },
    orderBy: { logRetentionHoldUntil: 'asc' },
  });

  return { processedCount: result.count, nextDueAt: nextDueLog?.logRetentionHoldUntil ?? null };
}
