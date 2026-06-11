import { Prisma } from '../../generated/prisma/client.js';
import { disposeDueRetentionAccessLogs as disposeDueRetentionAccessLogsSql } from '../../generated/prisma/sql.js';
import type { RetentionAccessLogDisposalResult } from './retention-access-log.types.js';

const DEFAULT_RETENTION_ACCESS_LOG_DISPOSAL_BATCH_SIZE = 100;
const MAX_RETENTION_ACCESS_LOG_DISPOSAL_BATCH_SIZE = 500;

type TypedQueryable = {
  $queryRawTyped<T = unknown>(query: unknown): Promise<T[]>;
};

type RetentionAccessLogClient = TypedQueryable &
  Pick<Prisma.TransactionClient, 'retentionAccessLog'>;

export function clampRetentionAccessLogDisposalBatchSize(batchSize?: number) {
  const requested = batchSize ?? DEFAULT_RETENTION_ACCESS_LOG_DISPOSAL_BATCH_SIZE;
  return Math.max(1, Math.min(requested, MAX_RETENTION_ACCESS_LOG_DISPOSAL_BATCH_SIZE));
}

export async function disposeDueRetentionAccessLogs(
  prisma: RetentionAccessLogClient,
  now: Date,
  options: { batchSize?: number } = {},
): Promise<RetentionAccessLogDisposalResult> {
  const safeBatchSize = clampRetentionAccessLogDisposalBatchSize(options.batchSize);
  const disposedRows = await prisma.$queryRawTyped<disposeDueRetentionAccessLogsSql.Result>(
    disposeDueRetentionAccessLogsSql(now, safeBatchSize),
  );

  const nextDueLog = await prisma.retentionAccessLog.findFirst({
    where: {
      logRetentionDisposedAt: null,
      logRetentionHoldUntil: { not: null, gt: now },
    },
    select: { logRetentionHoldUntil: true },
    orderBy: { logRetentionHoldUntil: 'asc' },
  });

  return {
    processedCount: disposedRows.length,
    nextDueAt: nextDueLog?.logRetentionHoldUntil ?? null,
  };
}
