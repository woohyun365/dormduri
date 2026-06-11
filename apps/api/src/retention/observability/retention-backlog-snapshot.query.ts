import type {
  RetentionBacklogSnapshot,
  RetentionObservabilitySweepInput,
} from './retention-observability.types.js';

export async function collectRetentionBacklogSnapshot(
  prisma: RetentionObservabilitySweepInput['prisma'],
  now: Date,
): Promise<RetentionBacklogSnapshot> {
  const [
    archiveDueCount,
    archiveManualReviewRows,
    retentionReviewDueCount,
    retentionReviewManualReviewRows,
    retainedVaultObjectCount,
    disposedVaultObjectCount,
    retainedIdentityDisposalDueCount,
    accessLogDisposalDueCount,
  ] = await Promise.all([
    prisma.archiveJob.count({
      where: {
        status: { in: ['PENDING', 'RETRY_SCHEDULED'] },
        nextRunAt: { lte: now },
      },
    }),
    prisma.archiveJob.findMany({
      where: {
        OR: [{ status: 'FAILED_MANUAL_REVIEW' }, { manualReviewRequired: true }],
      },
      select: { attemptCount: true, maxAttempts: true, lastErrorCode: true },
    }),
    prisma.retentionReviewJob.count({
      where: {
        status: { in: ['PENDING', 'RETRY_SCHEDULED'] },
        dueAt: { lte: now },
      },
    }),
    prisma.retentionReviewJob.findMany({
      where: {
        OR: [{ status: 'FAILED_MANUAL_REVIEW' }, { manualReviewRequired: true }],
      },
      select: { attemptCount: true, maxAttempts: true, lastErrorCode: true },
    }),
    prisma.retainedVaultObject.count({ where: { state: 'RETAINED' } }),
    prisma.retainedVaultObject.count({ where: { state: 'DISPOSED' } }),
    prisma.retainedIdentity.count({
      where: {
        retentionDisposedAt: null,
        holds: {
          some: {},
          every: {
            OR: [{ releasedAt: { not: null } }, { holdUntil: { not: null, lte: now } }],
          },
        },
      },
    }),
    prisma.retentionAccessLog.count({
      where: {
        logRetentionDisposedAt: null,
        logRetentionHoldUntil: { not: null, lte: now },
      },
    }),
  ]);

  const manualRows = [...archiveManualReviewRows, ...retentionReviewManualReviewRows];
  return {
    archiveDueCount,
    archiveManualReviewCount: archiveManualReviewRows.length,
    archiveRetryExhaustedCount: archiveManualReviewRows.filter(isRetryExhausted).length,
    retentionReviewDueCount,
    retentionReviewManualReviewCount: retentionReviewManualReviewRows.length,
    retainedVaultObjectCount,
    disposedVaultObjectCount,
    retainedIdentityDisposalDueCount,
    accessLogDisposalDueCount,
    keyUnavailableCount: manualRows.filter(hasKeyUnavailableError).length,
  };
}

function isRetryExhausted(row: { attemptCount: number; maxAttempts: number }) {
  return row.attemptCount >= row.maxAttempts;
}

function hasKeyUnavailableError(row: { lastErrorCode: string | null }) {
  return row.lastErrorCode?.includes('KEY_UNAVAILABLE') ?? false;
}
